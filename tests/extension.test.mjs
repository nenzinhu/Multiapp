import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";

import { createVault } from "../lib/vault.ts";
import {
  decryptEnvelopeWithKey,
  exportKey,
  importKey,
  normalizePassphrase,
  openVaultEnvelope,
  parseVaultEnvelope,
} from "../extension/lib/vault-crypto.js";
import {
  findSiteLogins,
  hostMatches,
  siteHost,
} from "../extension/lib/site-match.js";

const run = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const extensionDir = path.join(root, "extension");

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

test("a extensão abre o envelope selado pelo app", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  const { records, key } = await openVaultEnvelope(stored, "senha-mestra-123");
  assert.equal(records.length, 1);
  assert.equal(records[0].secret, "S3nh@Secreta");
  assert.equal(records[0].username, "ana@exemplo.com");
  assert.equal(records[0].url, "https://banco.exemplo.com");
  assert.equal(records[0].kind, "site");
  assert.ok(key, "a chave derivada volta junto com os registros");
});

test("senha mestra errada é recusada sem alterar nada", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  await assert.rejects(
    () => openVaultEnvelope(stored, "outra-senha"),
    /Senha mestra incorreta/,
  );
});

test("espaço acidental e acento decomposto abrem o mesmo cofre", async () => {
  const stored = await createVault("café-com-leite", [record()]);
  const withSpace = await openVaultEnvelope(stored, "  café-com-leite  ");
  assert.equal(withSpace.records.length, 1);
  const decomposed = await openVaultEnvelope(stored, "cafe\u0301-com-leite");
  assert.equal(decomposed.records[0].secret, "S3nh@Secreta");
  assert.equal(normalizePassphrase("  café  "), "café");
});

test("a chave guardada na memória decifra sem a senha mestra", async () => {
  const stored = await createVault("senha-mestra-123", [record()]);
  const opened = await openVaultEnvelope(stored, "senha-mestra-123");
  const raw = await exportKey(opened.key);
  const records = await decryptEnvelopeWithKey(stored, await importKey(raw));
  assert.deepEqual(records, opened.records);
});

test("envelope inválido não derruba a extensão", () => {
  assert.equal(parseVaultEnvelope(null), null);
  assert.equal(parseVaultEnvelope({ version: 2, salt: "a", iv: "b", data: "c" }), null);
  assert.equal(parseVaultEnvelope({ version: 1, salt: "", iv: "", data: "" }), null);
  const parsed = parseVaultEnvelope({
    version: 1,
    salt: "a",
    iv: "b",
    data: "c",
    updatedAt: 12,
  });
  assert.equal(parsed?.updatedAt, 12);
});

test("host do site ignora www, esquema, caminho e maiúsculas", () => {
  assert.equal(siteHost("https://www.Exemplo.com.br/login?x=1"), "exemplo.com.br");
  assert.equal(siteHost("exemplo.com"), "exemplo.com");
  assert.equal(siteHost("http://localhost:3000/cofre"), "localhost");
  assert.equal(siteHost("ftp://exemplo.com"), "");
  assert.equal(siteHost(""), "");
});

test("a credencial só combina com o próprio domínio", () => {
  const cases = [
    ["https://www.exemplo.com", "https://exemplo.com/entrar", true],
    ["https://exemplo.com", "https://www.exemplo.com", true],
    ["https://login.exemplo.com", "https://app.exemplo.com", true],
    ["https://exemplo.com", "https://exemplo.com.malicioso.net", false],
    ["https://exemplo.com", "https://naoexemplo.com", false],
    ["https://exemplo.com", "https://exemplo.com.br", false],
    ["https://exemplo.com", "http://localhost:3000", false],
    ["http://localhost:3000", "http://localhost:3000/login", true],
    ["https://exemplo.co.ao", "https://outro.co.ao", false],
    ["https://sub.exemplo.co.ao", "https://exemplo.co.ao", true],
    ["127.0.0.1", "127.0.0.1", true],
    ["127.0.0.1", "127.0.0.2", false],
  ];
  for (const [credential, page, expected] of cases)
    assert.equal(
      hostMatches(credential, page),
      expected,
      `${credential} × ${page}`,
    );
});

test("só credenciais de site com usuário e segredo entram no preenchimento", () => {
  const records = [
    record({ id: "a", url: "https://www.exemplo.com", favorite: false, updatedAt: 5 }),
    record({ id: "b", url: "https://exemplo.com", favorite: true, updatedAt: 1 }),
    record({ id: "c", url: "https://exemplo.com", username: "", updatedAt: 9 }),
    record({ id: "d", url: "https://exemplo.com", secret: "", updatedAt: 9 }),
    record({ id: "e", kind: "api", url: "https://exemplo.com", updatedAt: 9 }),
    record({ id: "f", url: "https://outro-site.com", updatedAt: 9 }),
  ];
  const matches = findSiteLogins(records, "https://exemplo.com/entrar");
  assert.deepEqual(
    matches.map((match) => match.id),
    ["b", "a"],
    "favorita primeiro, depois a mais recente",
  );
  assert.deepEqual(
    findSiteLogins(records, "https://desconhecido.com").length,
    0,
  );
  assert.deepEqual(findSiteLogins(null, "https://exemplo.com"), []);
});


async function extensionFiles(dir = extensionDir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      files.push(...(await extensionFiles(path.join(dir, entry.name), name)));
    else files.push(name);
  }
  return files;
}

test("o manifesto é V3 e aponta para arquivos que existem", async () => {
  const manifest = JSON.parse(
    await readFile(path.join(extensionDir, "manifest.json"), "utf8"),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.type, "module");
  assert.ok(manifest.permissions.includes("storage"));
  assert.deepEqual(manifest.content_scripts[0].matches, [
    "http://*/*",
    "https://*/*",
  ]);
  const referenced = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    ...manifest.content_scripts.flatMap((script) => script.js),
  ];
  for (const file of new Set(referenced))
    await stat(path.join(extensionDir, file));

  const popup = await readFile(
    path.join(extensionDir, manifest.action.default_popup),
    "utf8",
  );
  assert.match(popup, /src="popup\.js"/);
  assert.match(popup, /href="popup\.css"/);
});

test("todo JavaScript da extensão passa na checagem de sintaxe", async () => {
  const scripts = (await extensionFiles()).filter((file) => file.endsWith(".js"));
  assert.ok(scripts.length >= 5);
  for (const file of scripts)
    await run(process.execPath, ["--check", path.join(extensionDir, file)]);
});

test("o ZIP servido em /extensao acompanha a pasta extension/", async () => {
  const zipPath = path.join(root, "public", "extension", "multiapp-cofre.zip");
  const zip = await readFile(zipPath, "latin1");
  for (const file of await extensionFiles())
    assert.ok(
      zip.includes(`multiapp-cofre/${file}`),
      `${file} não está no ZIP: rode "npm run ext:zip"`,
    );
});
