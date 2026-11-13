import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ImportError,
  mergeImportedRecords,
  parsePasswordFile,
} from "../lib/password-import.ts";

const CHROME_CSV = `\uFEFFname,url,username,password,note
"GitHub","https://github.com/login","nei@exemplo.com","s3nha,com,virgula","nota ""importante"""
"App Android","android://abc==/com.app/","user","pass",""
"Sem Senha","https://example.com","user","",""
"Duplicado","https://github.com","nei@exemplo.com","s3nha,com,virgula",""
`.replace(/"/g, '"');

test("chrome/edge csv: quotes, commas, android scheme and duplicates", () => {
  const result = parsePasswordFile(CHROME_CSV, "Chrome Passwords.csv");
  assert.equal(result.source, "chrome");
  assert.equal(result.total, 4);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].url, "https://github.com/login");
  assert.equal(result.records[0].username, "nei@exemplo.com");
  assert.equal(result.records[0].secret, "s3nha,com,virgula");
  assert.equal(result.records[0].notes, 'nota "importante"');
  assert.equal(result.skippedInvalid, 2);
  assert.equal(result.skippedDuplicates, 1);
  assert.ok(result.reasons.length > 0);
  assert.deepEqual(result.sample, [
    { title: "GitHub", host: "github.com", username: "nei@exemplo.com" },
  ]);
});

test("lastpass csv keeps the folder in the notes", () => {
  const csv = `url,username,password,extra,name,grouping,fav
"https://mail.google.com","nei","segredo","2fa ativo","Gmail","Trabalho","1"
`.replace(/"/g, '"');
  const result = parsePasswordFile(csv);
  assert.equal(result.source, "lastpass");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, "Gmail");
  assert.equal(result.records[0].favorite, true);
  assert.match(result.records[0].notes, /2fa ativo/);
  assert.match(result.records[0].notes, /Pasta: Trabalho/);
});

test("bitwarden csv maps login columns", () => {
  const csv = `folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp
"Pessoal","1","login","Notion","","","0","https://notion.so","nei","senha-notion",""
`;
  const result = parsePasswordFile(csv);
  assert.equal(result.source, "bitwarden");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, "Notion");
  assert.equal(result.records[0].secret, "senha-notion");
});

test("generic semicolon csv with portuguese headers", () => {
  const csv = `site;usuario;senha;nome
figma.com;nei@exemplo.com;senha-figma;Figma
`;
  const result = parsePasswordFile(csv);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].url, "https://figma.com/");
  assert.equal(result.records[0].title, "Figma");
});

test("bitwarden json: login items only, notes skipped", () => {
  const json = JSON.stringify({
    encrypted: false,
    items: [
      {
        type: 1,
        name: "GitHub",
        favorite: true,
        notes: "conta pessoal",
        login: { username: "nei", password: "segredo", uris: [{ uri: "https://github.com" }] },
      },
      { type: 2, name: "Nota segura", notes: "sem login", secureNote: { type: 0 } },
    ],
  });
  const result = parsePasswordFile(json, "bitwarden_export.json");
  assert.equal(result.source, "bitwarden");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, "GitHub");
  assert.equal(result.records[0].favorite, true);
  assert.equal(result.skippedInvalid, 1);
});

test("encrypted bitwarden json is refused with an explanation", () => {
  assert.throws(
    () => parsePasswordFile(JSON.stringify({ encrypted: true, data: "..." })),
    (error) => error instanceof ImportError && /criptografado/.test(error.message),
  );
});

test("multiapp vault backup ignores api keys", () => {
  const json = JSON.stringify({
    version: 1,
    records: [
      { id: "a", kind: "site", title: "Site", url: "https://site.test", username: "u", secret: "s", notes: "", providerId: "", favorite: false, createdAt: 1, updatedAt: 1 },
      { id: "b", kind: "api", title: "Chave", url: "https://api.test", username: "", secret: "sk-1", notes: "", providerId: "openai", favorite: false, createdAt: 1, updatedAt: 1 },
    ],
  });
  const result = parsePasswordFile(json);
  assert.equal(result.source, "multiapp");
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].title, "Site");
});

test("generic json array and empty/garbage inputs", () => {
  const result = parsePasswordFile(
    JSON.stringify([{ url: "https://a.test", username: "u", password: "p" }]),
  );
  assert.equal(result.source, "generic");
  assert.equal(result.records.length, 1);
  assert.throws(() => parsePasswordFile("   "), /vazio/);
  assert.throws(() => parsePasswordFile("{nope}"), /JSON inválido/);
  assert.throws(() => parsePasswordFile("nome,cor\nfoo,bar"), /Nenhuma senha de site válida/);
});

test("mergeImportedRecords skips existing host+user and respects the cap", () => {
  const existing = [
    { id: "x", kind: "site", title: "GitHub", url: "https://github.com/", username: "nei", secret: "antiga", notes: "", providerId: "", favorite: false, createdAt: 1, updatedAt: 1 },
  ];
  const imported = [
    { id: "y", kind: "site", title: "GitHub", url: "https://github.com/login", username: "NEI", secret: "nova", notes: "", providerId: "", favorite: false, createdAt: 2, updatedAt: 2 },
    { id: "z", kind: "site", title: "Figma", url: "https://figma.com/", username: "nei", secret: "s", notes: "", providerId: "", favorite: false, createdAt: 2, updatedAt: 2 },
  ];
  const merged = mergeImportedRecords(existing, imported);
  assert.equal(merged.added, 1);
  assert.equal(merged.duplicates, 1);
  assert.equal(merged.records.length, 2);
  assert.equal(merged.records[1].title, "Figma");
});
