import assert from "node:assert/strict";
import { test } from "node:test";

import {
  declaredIcons,
  hostFromDomain,
} from "../app/api/favicon/route.ts";

test("hostFromDomain only accepts bare public hostnames", () => {
  assert.equal(hostFromDomain("figma.com"), "figma.com");
  assert.equal(hostFromDomain("  WWW.Figma.com.  "), "www.figma.com");
  for (const invalid of [
    null,
    "",
    "localhost",
    "figma",
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "[::1]",
    "figma.com:3000",
    "user:pass@figma.com",
    "figma.com/path",
    "https://figma.com/",
  ])
    assert.equal(hostFromDomain(invalid), null, String(invalid));
});

test("declaredIcons prefers touch icons and ignores mask icons", () => {
  const html = `<!doctype html><html><head>
    <link rel="stylesheet" href="/app.css">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="icon" sizes="32x32" href="/favicon-32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="https://cdn.example.com/touch.png">
    <link rel="mask-icon" href="/mask.svg" color="#123">
    <link rel="shortcut icon" href="/favicon.ico">
  </head></html>`;

  assert.deepEqual(declaredIcons(html, "https://example.com/"), [
    "https://cdn.example.com/touch.png",
    "https://example.com/favicon.svg",
    "https://example.com/favicon-32.png",
    "https://example.com/favicon.ico",
  ]);
});

test("declaredIcons skips unsafe and repeated values", () => {
  const html = `
    <link rel="icon" href="javascript:alert(1)">
    <link rel="icon" href="data:image/png;base64,AAAA">
    <link rel="icon" href="//cdn.example.com/a.png?x=1&amp;y=2">
    <link rel="icon" href="//cdn.example.com/a.png?x=1&amp;y=2">
    <link rel="icon" href="https://user:pass@example.com/private.png">`;

  assert.deepEqual(declaredIcons(html, "https://example.com/"), [
    "https://cdn.example.com/a.png?x=1&y=2",
  ]);
  assert.deepEqual(declaredIcons("<html><head></head></html>", "https://x.test/"), []);
});
