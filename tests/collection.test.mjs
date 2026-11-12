import assert from "node:assert/strict";
import { test } from "node:test";

import {
  UNCATEGORIZED,
  filterLinks,
  initialCollection,
  mergeBackup,
  normalizeUrl,
  suggestedName,
  validateBackup,
} from "../lib/collection.ts";

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

test("normalizeUrl adds https and keeps the address", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("  https://example.com/path  "), "https://example.com/path");
  assert.equal(normalizeUrl("localhost:3000"), "https://localhost:3000/");
});

test("normalizeUrl rejects unsafe schemes and credentials", () => {
  assert.throws(() => normalizeUrl("javascript:alert(1)"), /http ou https/);
  assert.throws(() => normalizeUrl("https://user:pass@example.com"), /sem usuário e senha/);
  assert.throws(() => normalizeUrl("   "), /URL válida/);
});

test("normalizeUrl accepts host ports followed by a query or fragment", () => {
  for (const [input, expected] of [
    ["localhost:3000?view=all", "https://localhost:3000/?view=all"],
    ["example.com:8080#section", "https://example.com:8080/#section"],
    ["example.com:8080/path?q=1#section", "https://example.com:8080/path?q=1#section"],
  ]) {
    assert.equal(normalizeUrl(input), expected);
  }
  assert.throws(() => normalizeUrl("javascript:123#section"));
  assert.throws(() => normalizeUrl("example.com:99999?view=all"));
});

test("suggestedName uses the domain label", () => {
  assert.equal(suggestedName("https://www.figma.com/"), "Figma");
  assert.equal(suggestedName("https://chatgpt.com/"), "Chatgpt");
});

test("filterLinks matches names, urls and categories without accents", () => {
  const links = [
    link({ id: "a", name: "Notion", url: "https://notion.so/", category: "Produtividade" }),
    link({ id: "b", name: "Figma", url: "https://figma.com/", category: "Design" }),
  ];
  assert.equal(filterLinks(links, { query: "produtiv", view: "all", category: "", sort: "newest" }).length, 1);
  assert.equal(filterLinks(links, { query: "figma", view: "all", category: "", sort: "newest" })[0].id, "b");
  assert.equal(filterLinks(links, { query: "", view: "all", category: "Design", sort: "newest" }).length, 1);
});

test("filterLinks honors favorites and recent views", () => {
  const links = [
    link({ id: "a", favorite: true }),
    link({ id: "b", lastOpened: 5 }),
    link({ id: "c" }),
  ];
  const favorites = filterLinks(links, { query: "", view: "favorites", category: "", sort: "newest" });
  assert.deepEqual(favorites.map((item) => item.id), ["a"]);
  const recent = filterLinks(links, { query: "", view: "recent", category: "", sort: "newest" });
  assert.deepEqual(recent.map((item) => item.id), ["b"]);
});

test("validateBackup rejects malformed payloads and normalizes valid ones", () => {
  assert.throws(() => validateBackup(null), /Arquivo inválido/);
  assert.throws(() => validateBackup({ version: 2, links: [], categories: [] }), /Backup incompatível/);
  assert.throws(
    () => validateBackup({ version: 1, links: [link({ url: "javascript:alert(1)" })], categories: [] }),
    /http ou https/,
  );
  const valid = validateBackup({
    version: 1,
    categories: ["Design"],
    links: [link({ url: "example.com", category: "Inexistente" })],
  });
  assert.equal(valid.categories[0], "Design");
  assert.equal(valid.links[0].url, "https://example.com/");
  assert.equal(valid.links[0].category, UNCATEGORIZED);
});

test("mergeBackup keeps existing links and appends new ones", () => {
  const current = { version: 1, categories: ["Design"], links: [link({ id: "a", url: "https://a.test/" })] };
  const imported = {
    version: 1,
    categories: ["Trabalho"],
    links: [
      link({ id: "b", url: "https://a.test/" }),
      link({ id: "c", url: "https://b.test/", category: "Trabalho" }),
    ],
  };
  const merged = mergeBackup(current, imported);
  assert.equal(merged.links.length, 2);
  assert.equal(merged.links[0].id, "a");
  assert.notEqual(merged.links[1].id, "c");
  assert.deepEqual(merged.categories, ["Design", "Trabalho"]);
});

test("validateBackup preserves category assignments after trimming whitespace", () => {
  const valid = validateBackup({
    version: 1,
    categories: [" Design ", "Design"],
    links: [link({ category: " Design " })],
  });
  assert.deepEqual(valid.categories, ["Design"]);
  assert.equal(valid.links[0].category, "Design");
  assert.equal(filterLinks(valid.links, {
    query: "", view: "all", category: "Design", sort: "name",
  }).length, 1);
});

test("initialCollection ships an editable starter selection", () => {
  const starter = initialCollection();
  assert.equal(starter.version, 1);
  assert.equal(starter.links.length, 8);
  assert.ok(starter.categories.includes("Produtividade"));
});

test("search combines category, domain and favorite commands", () => {
  const options = { query: '#design @figma.com is:favorito', view: 'all', category: '', sort: 'name' };
  const links = [link({id:'a',name:'Figma',url:'https://figma.com/',category:'Design',favorite:true}),link({id:'b',url:'https://other.com/figma.com',category:'Design',favorite:true})];
  assert.deepEqual(filterLinks(links,options).map(x=>x.id),['a']);
  assert.equal(filterLinks(links,{...options,query:'is:nunca'}).length,2);
});

test("forgotten ordering puts never opened apps first without mutating input", () => {
  const links=[link({id:'recent',lastOpened:100}),link({id:'never',lastOpened:0}),link({id:'old',lastOpened:20})];
  assert.deepEqual(filterLinks(links,{query:'',view:'all',category:'',sort:'forgotten'}).map(x=>x.id),['never','old','recent']);
  assert.equal(links[0].id,'recent');
});

test("tracking cleanup preserves functional parameters and fragment", async () => {
  const { cleanTrackingUrl }=await import('../lib/collection.ts');
  assert.equal(cleanTrackingUrl('example.com/watch?v=123&utm_source=news&fbclid=abc#play'),'https://example.com/watch?v=123#play');
  assert.equal(cleanTrackingUrl('example.com/?ref=invite&token=123'),'https://example.com/?ref=invite&token=123');
});

test("Markdown export escapes labels and keeps links on one line", async () => {
  const { linksToMarkdown }=await import('../lib/collection.ts');
  assert.equal(linksToMarkdown([link({name:'[Meu] app\nlegal',url:'https://example.com/a(b)'})]),'- [\\[Meu\\] app legal](<https://example.com/a(b)>)');
  assert.equal(linksToMarkdown([]),'');
});
