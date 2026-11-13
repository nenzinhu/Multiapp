import assert from "node:assert/strict";
import { test } from "node:test";

import { StoreError } from "../lib/server/accounts.ts";
import { openDatabase } from "../lib/server/db.ts";
import { hashPassword, verifyPassword } from "../lib/server/password.ts";
import { createSqliteStorage } from "../lib/server/sqlite-store.ts";

function freshStore() {
  const db = openDatabase(":memory:");
  return { db, storage: createSqliteStorage(db) };
}

function link(overrides = {}) {
  return {
    id: overrides.id ?? "id-1",
    name: overrides.name ?? "ChatGPT",
    url: overrides.url ?? "https://chatgpt.com/",
    category: overrides.category ?? "Inteligência artificial",
    favorite: overrides.favorite ?? false,
    createdAt: overrides.createdAt ?? 1,
    lastOpened: overrides.lastOpened ?? 0,
  };
}

test("password hash round-trips and never stores the secret", () => {
  const stored = hashPassword("senha-segura-42");
  assert.match(stored, /^scrypt\$/);
  assert.ok(!stored.includes("senha-segura-42"));
  assert.equal(verifyPassword("senha-segura-42", stored), true);
  assert.equal(verifyPassword("senha-segura-43", stored), false);
});

test("two hashes of the same password differ (unique salts)", () => {
  assert.notEqual(hashPassword("mesma-senha"), hashPassword("mesma-senha"));
});

test("tampered or unknown hashes are rejected without throwing", () => {
  assert.equal(verifyPassword("x", "not-a-hash"), false);
  assert.equal(verifyPassword("x", "scrypt$1$1$1$a$b"), false);
  const stored = hashPassword("senha-segura-42");
  assert.equal(verifyPassword("senha-segura-42", `${stored}tamper`), false);
});

test("accented passwords match after normalization", () => {
  const stored = hashPassword("coração1");
  assert.equal(verifyPassword("coração1".normalize("NFD"), stored), true);
});

test("users are unique regardless of letter case and keep their spelling", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({
    username: "Ana.Silva",
    password: "senha-forte-1",
  });
  assert.equal(user.username, "Ana.Silva");
  await assert.rejects(
    storage.createUser({ username: "ana.silva", password: "outra-senha-2" }),
    (error) => error instanceof StoreError && error.status === 409,
  );
});

test("username and password rules explain what to fix", async () => {
  const { storage } = freshStore();
  async function status(input) {
    try {
      await storage.createUser(input);
      return 0;
    } catch (error) {
      return error.status;
    }
  }
  assert.equal(await status({ username: "ab", password: "senha-forte-1" }), 400);
  assert.equal(await status({ username: "ana silva", password: "senha-forte-1" }), 400);
  assert.equal(await status({ username: "ana", password: "curta" }), 400);
  assert.equal(await status({ username: "ana", password: "ana" }), 400);
  assert.equal(await status({ username: "ana", password: "senha-forte-1" }), 0);
});

test("sign in requires the exact pair and hides which field failed", async () => {
  const { storage } = freshStore();
  await storage.createUser({ username: "bruno", password: "senha-forte-1" });
  assert.equal(
    (await storage.authenticateUser({ username: "Bruno", password: "senha-forte-1" }))
      .username,
    "bruno",
  );
  for (const input of [
    { username: "bruno", password: "senha-forte-2" },
    { username: "ninguem", password: "senha-forte-1" },
    { username: "", password: "" },
  ]) {
    await assert.rejects(
      storage.authenticateUser(input),
      (error) =>
        error instanceof StoreError &&
        error.status === 401 &&
        !/bruno|ningu[ée]m/i.test(error.message),
    );
  }
});

test("sessions resolve the user and can be deleted", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "carla", password: "senha-forte-1" });
  const { token, maxAge } = await storage.createSession(user.id);
  assert.ok(maxAge > 0);
  assert.equal((await storage.findSessionUser(token)).id, user.id);
  assert.equal(await storage.findSessionUser("outro-token"), null);
  await storage.deleteSession(token);
  assert.equal(await storage.findSessionUser(token), null);
});

test("expired sessions stop working", async () => {
  const { db, storage } = freshStore();
  const user = await storage.createUser({ username: "diego", password: "senha-forte-1" });
  const { token } = await storage.createSession(user.id);
  db.prepare("UPDATE sessions SET expires_at = 1").run();
  assert.equal(await storage.findSessionUser(token), null);
});

test("the first collection is empty and starts at revision 0", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "elisa", password: "senha-forte-1" });
  const stored = await storage.readCollection(user.id);
  assert.equal(stored.revision, 0);
  assert.deepEqual(stored.collection.links, []);
});

test("writing the collection bumps the revision and normalizes the payload", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "fabio", password: "senha-forte-1" });
  const saved = await storage.writeCollection(
    user.id,
    { version: 1, categories: ["Design"], links: [link({ url: "figma.com" })] },
    0,
  );
  assert.equal(saved.revision, 1);
  assert.equal(saved.collection.links[0].url, "https://figma.com/");
  const stored = await storage.readCollection(user.id);
  assert.equal(stored.collection.links[0].name, "ChatGPT");
});

test("a stale revision is rejected instead of overwriting another device", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "gabi", password: "senha-forte-1" });
  await storage.writeCollection(user.id, { version: 1, categories: [], links: [link()] }, 0);
  await assert.rejects(
    storage.writeCollection(user.id, { version: 1, categories: [], links: [] }, 0),
    (error) => error instanceof StoreError && error.code === "revision-conflict",
  );
  const current = await storage.readCollection(user.id);
  assert.equal(current.revision, 1);
  assert.equal(current.collection.links.length, 1);
});

test("invalid collections are rejected and leave the stored copy intact", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "helio", password: "senha-forte-1" });
  await storage.writeCollection(user.id, { version: 1, categories: [], links: [link()] }, 0);
  await assert.rejects(
    storage.writeCollection(
      user.id,
      { version: 1, categories: [], links: [link({ url: "javascript:alert(1)" })] },
      1,
    ),
    /http ou https/,
  );
  const stored = await storage.readCollection(user.id);
  assert.equal(stored.collection.links.length, 1);
});

test("each account keeps its own collection", async () => {
  const { storage } = freshStore();
  const ana = await storage.createUser({ username: "ana", password: "senha-forte-1" });
  const bia = await storage.createUser({ username: "bia", password: "senha-forte-1" });
  await storage.writeCollection(
    ana.id,
    { version: 1, categories: [], links: [link({ id: "ana-1", url: "https://ana.test/" })] },
    0,
  );
  assert.equal((await storage.readCollection(bia.id)).revision, 0);
  assert.equal((await storage.readCollection(bia.id)).collection.links.length, 0);
  assert.equal((await storage.readCollection(ana.id)).collection.links[0].id, "ana-1");
});

test("the same credentials read the same collection from a new session", async () => {
  const { storage } = freshStore();
  const created = await storage.createUser({ username: "ivo", password: "senha-forte-1" });
  const first = await storage.createSession(created.id);
  await storage.writeCollection(
    created.id,
    { version: 1, categories: [], links: [link({ id: "sync-1", url: "https://sync.test/" })] },
    0,
  );
  // A second device signs in with the same pair and pulls the account copy.
  const again = await storage.authenticateUser({
    username: "ivo",
    password: "senha-forte-1",
  });
  const second = await storage.createSession(again.id);
  const sessionUser = await storage.findSessionUser(second.token);
  const pulled = await storage.readCollection(sessionUser.id);
  assert.equal(pulled.collection.links[0].id, "sync-1");
  assert.notEqual(first.token, second.token);
});


test("vault envelope syncs with a revision and can be deleted", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "vault.sync", password: "senha-forte-1" });
  assert.equal(await storage.readVault(user.id), null);

  const envelope = { version: 1, salt: "salt-1", iv: "iv-1", data: "cifrado", updatedAt: 100 };
  const saved = await storage.writeVault(user.id, envelope, 0);
  assert.equal(saved.revision, 1);

  const read = await storage.readVault(user.id);
  assert.deepEqual(read.envelope, envelope);
  assert.equal(read.revision, 1);

  await assert.rejects(
    storage.writeVault(user.id, envelope, 0),
    (error) => error instanceof StoreError && error.code === "revision-conflict",
  );

  const newer = { ...envelope, data: "cifrado-2", updatedAt: 200 };
  const second = await storage.writeVault(user.id, newer, 1);
  assert.equal(second.revision, 2);
  assert.equal((await storage.readVault(user.id)).envelope.data, "cifrado-2");

  await storage.deleteVault(user.id);
  assert.equal(await storage.readVault(user.id), null);
});

test("vault envelopes are rejected when malformed or too large", async () => {
  const { storage } = freshStore();
  const user = await storage.createUser({ username: "vault.bad", password: "senha-forte-1" });
  const bad = [
    null,
    { version: 2, salt: "s", iv: "i", data: "d", updatedAt: 1 },
    { version: 1, salt: "", iv: "i", data: "d", updatedAt: 1 },
    { version: 1, salt: "s", iv: "i", data: "d", updatedAt: "agora" },
    { version: 1, salt: "s", iv: "i", data: "d" },
  ];
  for (const envelope of bad)
    await assert.rejects(storage.writeVault(user.id, envelope, 0));

  const huge = {
    version: 1,
    salt: "s",
    iv: "i",
    data: "x".repeat(4 * 1024 * 1024 + 1),
    updatedAt: 1,
  };
  await assert.rejects(storage.writeVault(user.id, huge, 0), /4 MB/);
});

test("each account has its own vault copy", async () => {
  const { storage } = freshStore();
  const ana = await storage.createUser({ username: "vault.ana", password: "senha-forte-1" });
  const bia = await storage.createUser({ username: "vault.bia", password: "senha-forte-1" });
  await storage.writeVault(
    ana.id,
    { version: 1, salt: "s", iv: "i", data: "segredo-de-ana", updatedAt: 1 },
    0,
  );
  assert.equal(await storage.readVault(bia.id), null);
  assert.equal((await storage.readVault(ana.id)).envelope.data, "segredo-de-ana");
});
