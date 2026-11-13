import assert from "node:assert/strict";
import { test } from "node:test";

import {
  VAULT_MAX_RECORDS,
  createVault,
  changePassphrase,
  maskSecret,
  mergeVaultRecords,
  sealRecords,
  unlockVault,
  validateVaultData,
  validateVaultRecord,
  vaultDomain,
} from "../lib/vault.ts";

function record(overrides = {}) {
  return {
    id: overrides.id ?? "id-1",
    kind: overrides.kind ?? "site",
    title: overrides.title ?? "Banco do trabalho",
    url: overrides.url ?? "https://banco.exemplo.com",
    username: overrides.username ?? "ana@exemplo.com",
    secret: overrides.secret ?? "S3nh@Secreta",
    notes: overrides.notes ?? "",
    providerId: overrides.providerId ?? "",
    favorite: overrides.favorite ?? false,
    createdAt: overrides.createdAt ?? 1,
    updatedAt: overrides.updatedAt ?? 1,
  };
}

test("createVault encrypts the records and only stores ciphertext", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  assert.equal(stored.version, 1);
  assert.ok(stored.salt && stored.iv && stored.data);
  assert.equal(
    JSON.stringify(stored).includes("S3nh@Secreta"),
    false,
    "o segredo não pode aparecer no envelope",
  );
});

test("unlockVault returns the records with the right master passphrase", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  const data = await unlockVault(stored, "senha-mestra-123");
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].title, "Banco do trabalho");
  assert.equal(data.records[0].secret, "S3nh@Secreta");
});

test("unlockVault refuses a wrong master passphrase", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  await assert.rejects(
    () => unlockVault(stored, "outra-senha"),
    /Senha mestra incorreta/,
  );
});

test("sealRecords keeps the same passphrase after new records", async () => {
  await createVault("senha-mestra-123", [record()]);
  const resealed = await sealRecords([
    record(),
    record({ id: "id-2", title: "Outro site" }),
  ]);
  const data = await unlockVault(resealed, "senha-mestra-123");
  assert.equal(data.records.length, 2);
});

test("changePassphrase re-encrypts with the new passphrase", async () => {
  await createVault("senha-mestra-123", [record()]);
  const next = await changePassphrase([record()], "nova-senha-456");
  const data = await unlockVault(next, "nova-senha-456");
  assert.equal(data.records.length, 1);
  await assert.rejects(() => unlockVault(next, "senha-mestra-123"));
});

test("validateVaultRecord rejects malformed records", () => {
  assert.throws(() => validateVaultRecord(null), /fora do padrão/);
  assert.throws(() => validateVaultRecord({ ...record(), title: "  " }));
  assert.throws(() => validateVaultRecord({ ...record(), secret: 123 }));
  assert.throws(() => validateVaultRecord({ ...record(), createdAt: "hoje" }));
});

test("validateVaultData rejects an incompatible payload", () => {
  assert.throws(() => validateVaultData(null), /conteúdo inesperado/);
  assert.throws(() => validateVaultData({ version: 9, records: [] }), /incompatível/);
  const records = Array.from({ length: VAULT_MAX_RECORDS + 1 }, (_, index) =>
    record({ id: `id-${index}` }),
  );
  assert.throws(
    () => validateVaultData({ version: 1, records }),
    /Limite/,
  );
});

test("mergeVaultRecords keeps the stored records and skips duplicates", () => {
  const current = [record()];
  const imported = [
    record(),
    record({ id: "id-2", title: "Outro site", url: "https://outro.exemplo.com" }),
  ];
  const merged = mergeVaultRecords(current, imported);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "id-1");
  assert.equal(merged[1].title, "Outro site");
});

test("maskSecret keeps only the last four characters", () => {
  assert.equal(maskSecret(""), "");
  assert.equal(maskSecret("abc"), "••••");
  assert.equal(maskSecret("S3nh@Secreta"), "••••••reta");
});

test("vaultDomain reads the hostname without the www prefix", () => {
  assert.equal(vaultDomain("https://www.figma.com/app"), "figma.com");
  assert.equal(vaultDomain(""), "");
  assert.equal(vaultDomain("não é uma url"), "não é uma url");
});

test("findVaultLogin matches the site host, ignoring www and API keys", async () => {
  const { findVaultLogin } = await import("../lib/vault.ts");
  const site = {
    id: "v1",
    kind: "site",
    title: "GitHub",
    url: "https://www.github.com/login",
    username: "nei",
    secret: "segredo",
    notes: "",
    providerId: "",
    favorite: false,
    createdAt: 1,
    updatedAt: 1,
  };
  const api = { ...site, id: "v2", kind: "api", url: "https://github.com" };
  const noUser = { ...site, id: "v3", username: "" };
  const records = [api, noUser, site];

  assert.equal(findVaultLogin(records, "https://github.com/")?.id, "v1");
  assert.equal(findVaultLogin(records, "https://www.github.com/x")?.id, "v1");
  assert.equal(findVaultLogin(records, "https://github.com.br/"), undefined);
  assert.equal(findVaultLogin(records, "https://gist.github.com/"), undefined);
  assert.equal(findVaultLogin(null, "https://github.com/"), undefined);
  assert.equal(findVaultLogin(records, ""), undefined);
});

test("passphrase tolerates mobile keyboards: accents and stray spaces", async () => {
  const { createVault, unlockVault, lockVault } = await import("../lib/vault.ts");

  // Accents typed as NFD (common on phones) must open an NFC-created vault.
  const accented = await createVault("coração-forte-1");
  lockVault();
  const opened = await unlockVault(accented, "coração-forte-1".normalize("NFD"));
  assert.equal(opened.records.length, 0);

  // A trailing space added by the keyboard still opens the vault.
  const spaced = await createVault("senha-forte-1 ");
  lockVault();
  await assert.doesNotReject(unlockVault(spaced, "senha-forte-1"));
  lockVault();
  await assert.doesNotReject(unlockVault(spaced, "  senha-forte-1 "));

  // Case still matters.
  lockVault();
  await assert.rejects(
    unlockVault(spaced, "Senha-forte-1"),
    /Senha mestra incorreta/,
  );
});
