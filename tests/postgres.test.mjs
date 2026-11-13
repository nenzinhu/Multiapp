import assert from "node:assert/strict";
import { test } from "node:test";

import { Pool } from "pg";

import { StoreError } from "../lib/server/accounts.ts";
import {
  createPostgresStorage,
  parseDatabaseUrl,
} from "../lib/server/postgres-store.ts";

const URL = process.env.TEST_DATABASE_URL?.trim();
const skip = URL ? false : "defina TEST_DATABASE_URL para testar o Postgres";
const SCHEMA = "multiapp_test";

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

test("parseDatabaseUrl accepts unescaped @ inside the password", () => {
  const config = parseDatabaseUrl(
    "postgresql://postgres.abc:senha@comArroba9@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
  );
  assert.equal(config.host, "aws-1-us-east-1.pooler.supabase.com");
  assert.equal(config.port, 6543);
  assert.equal(config.user, "postgres.abc");
  assert.equal(config.password, "senha@comArroba9");
  assert.equal(config.database, "postgres");
  assert.equal(config.ssl, true);

  const encoded = parseDatabaseUrl(
    "postgres://user:p%40ss@db.example.com:5432/app?sslmode=disable",
  );
  assert.equal(encoded.password, "p@ss");
  assert.equal(encoded.port, 5432);
  assert.equal(encoded.database, "app");
  assert.equal(encoded.ssl, false);
});

test("postgres: accounts, sessions and snapshots round trip", { skip }, async (t) => {
  const config = parseDatabaseUrl(URL);
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    options: `-c search_path=${SCHEMA}`,
    max: 2,
  });

  await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
  await pool.query(`CREATE SCHEMA ${SCHEMA}`);
  t.after(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.end();
  });

  const storage = createPostgresStorage(pool);

  const user = await storage.createUser({ username: "Maria.Teste", password: "senha-forte-1" });
  assert.equal(user.username, "Maria.Teste");
  await assert.rejects(
    storage.createUser({ username: "maria.teste", password: "outra-senha-2" }),
    (error) => error instanceof StoreError && error.status === 409,
  );
  await assert.rejects(
    storage.authenticateUser({ username: "maria.teste", password: "errada-123" }),
    (error) => error instanceof StoreError && error.status === 401,
  );

  const signedIn = await storage.authenticateUser({
    username: "maria.teste",
    password: "senha-forte-1",
  });
  assert.equal(signedIn.id, user.id);

  const first = await storage.createSession(user.id);
  assert.equal((await storage.findSessionUser(first.token)).id, user.id);

  const initial = await storage.readCollection(user.id);
  assert.equal(initial.revision, 0);

  const saved = await storage.writeCollection(
    user.id,
    { version: 1, categories: ["Trabalho"], links: [link({ url: "notion.so" })] },
    0,
  );
  assert.equal(saved.revision, 1);
  assert.equal(saved.collection.links[0].url, "https://notion.so/");

  await assert.rejects(
    storage.writeCollection(user.id, { version: 1, categories: [], links: [] }, 0),
    (error) => error instanceof StoreError && error.code === "revision-conflict",
  );

  // A second device with its own session reads the same snapshot.
  const second = await storage.createSession(user.id);
  const device = await storage.findSessionUser(second.token);
  const pulled = await storage.readCollection(device.id);
  assert.equal(pulled.collection.links[0].name, "ChatGPT");
  assert.equal(pulled.revision, 1);

  const another = await storage.createUser({ username: "outra", password: "senha-forte-1" });
  assert.equal((await storage.readCollection(another.id)).revision, 0);

  await storage.deleteSession(first.token);
  assert.equal(await storage.findSessionUser(first.token), null);
});

test("parseDatabaseUrl forgives a pasted KEY=value and surrounding quotes", () => {
  const fromPanel = parseDatabaseUrl(
    'DATABASE_URL="postgresql://postgres.abc:senha@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"',
  );
  assert.equal(fromPanel.host, "aws-1-us-east-1.pooler.supabase.com");
  assert.equal(fromPanel.port, 6543);
  assert.equal(fromPanel.password, "senha");
});

test("parseDatabaseUrl explains a URL that lost the @ before the host", () => {
  assert.throws(
    () =>
      parseDatabaseUrl(
        "postgresql://postgres.abc:***Nei@6280760aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
      ),
    /perdeu o '@' entre a senha e o host/,
  );
});

test("parseDatabaseUrl keeps the full password when it contains @", () => {
  const config = parseDatabaseUrl(
    "postgresql://postgres.abc:***Nei@6280760@aws-1-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require",
  );
  assert.equal(config.password, "***Nei@6280760");
  assert.equal(config.host, "aws-1-us-east-1.pooler.supabase.com");
});
