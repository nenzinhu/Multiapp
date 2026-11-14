/**
 * Verificação de ponta a ponta da extensão, num Chromium de verdade.
 *
 *   node scripts/verify-extension.mjs
 *
 * Sobe um site de login local, instala `extension/` com `--load-extension`,
 * desbloqueia o cofre pelo popup e confere se usuário e senha entram no
 * formulário sozinhos. Sem dependências: fala com o Chromium pelo CDP usando o
 * `WebSocket` do Node.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveVaultKey,
  randomSalt,
  sealRecords,
  toBase64,
} from "../extension/lib/vault-crypto.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const extensionDir = path.join(root, "extension");
const SITE_PORT = 8099;
const CDP_PORT = 9222;
const MASTER = "senha-mestra-de-teste";
const USERNAME = "ana@exemplo.com";
const SECRET = "S3nh@Secreta";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assert(condition, message) {
  if (!condition) throw new Error(`FALHOU: ${message}`);
  console.log(`✔ ${message}`);
}

const LOGIN_PAGE = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Site de teste</title></head><body>
<h1>Entrar</h1>
<form method="get" action="/logado">
  <label>Usuário <input type="text" name="usuario" autocomplete="username"></label>
  <label>Senha <input type="password" name="senha" autocomplete="current-password"></label>
  <button type="submit">Entrar</button>
</form></body></html>`;

function appPage(envelope) {
  const sealed = JSON.stringify(JSON.stringify(envelope));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="multiapp-vault" content="1"><title>Multiapp de teste</title></head>
<body><p>Cofre de teste</p>
<script>localStorage.setItem("multiapp.vault.v1", ${sealed});</script></body></html>`;
}

/** Cliente mínimo do Chrome DevTools Protocol. */
async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (!data.id || !pending.has(data.id)) return;
    const handlers = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) handlers.reject(new Error(data.error.message));
    else handlers.resolve(data.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      pending.set(nextId, { resolve, reject });
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
  await send("Runtime.enable");
  return {
    async evaluate(expression) {
      const result = await send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (result.exceptionDetails)
        throw new Error(result.exceptionDetails.text ?? "erro na página");
      return result.result?.value;
    },
    close: () => socket.close(),
  };
}

async function targets() {
  const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
  return response.json();
}

async function waitForTarget(predicate, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = (await targets().catch(() => [])).find(predicate);
    if (found) return found;
    await sleep(200);
  }
  return null;
}

async function openTab(url) {
  const response = await fetch(
    `http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`,
    { method: "PUT" },
  );
  return response.json();
}

async function main() {
  const salt = randomSalt();
  const key = await deriveVaultKey(MASTER, salt);
  const envelope = await sealRecords(
    [
      {
        id: "site-1",
        kind: "site",
        title: "Site de teste",
        url: `http://127.0.0.1:${SITE_PORT}`,
        username: USERNAME,
        secret: SECRET,
        notes: "",
        providerId: "",
        favorite: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    key,
    toBase64(salt),
  );

  const server = createServer((request, response) => {
    const url = request.url ?? "/";
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    if (url.startsWith("/cofre")) response.end(appPage(envelope));
    else if (url.startsWith("/logado"))
      response.end('<!doctype html><title>ok</title><p>logado</p>');
    else response.end(LOGIN_PAGE);
  });
  await new Promise((resolve) => server.listen(SITE_PORT, "127.0.0.1", resolve));

  const profile = await mkdtemp(path.join(tmpdir(), "multiapp-ext-"));
  const chromium = spawn(
    process.env.CHROME_BIN ?? "chromium",
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--no-first-run",
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const cleanup = async () => {
    chromium.kill("SIGKILL");
    server.close();
    await sleep(500);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  };

  try {
    const worker = await waitForTarget(
      (target) =>
        target.type === "service_worker" &&
        target.url.startsWith("chrome-extension://"),
    );
    assert(Boolean(worker), "o Chromium carregou o service worker da extensão");
    const extensionId = new URL(worker.url).host;
    console.log(`  id da extensão: ${extensionId}`);

    await openTab(`http://127.0.0.1:${SITE_PORT}/cofre`);
    const popupTab = await openTab(
      `chrome-extension://${extensionId}/popup.html`,
    );
    const popup = await connect(popupTab.webSocketDebuggerUrl);
    await sleep(800);
    const site = `http://127.0.0.1:${SITE_PORT}/`;

    const statusBefore = await popup.evaluate(
      `chrome.runtime.sendMessage({ type: "multiapp:status", url: ${JSON.stringify(site)} })`,
    );
    assert(
      statusBefore?.status === "locked",
      "antes de abrir, o cofre está bloqueado",
    );

    const refreshed = await popup.evaluate(
      `chrome.runtime.sendMessage({ type: "multiapp:refresh-envelope" })`,
    );
    assert(refreshed?.ok === true, "a extensão leu o envelope da aba do Multiapp");

    const wrong = await popup.evaluate(
      `chrome.runtime.sendMessage({ type: "multiapp:unlock", passphrase: "errada" })`,
    );
    assert(
      Boolean(wrong?.error) && /Senha mestra incorreta/.test(wrong.error),
      "senha mestra errada é recusada com mensagem clara",
    );

    const unlocked = await popup.evaluate(
      `chrome.runtime.sendMessage({ type: "multiapp:unlock", passphrase: ${JSON.stringify(MASTER)} })`,
    );
    assert(
      unlocked?.ok === true && unlocked.count === 1,
      "o cofre abriu com 1 credencial",
    );

    const lookup = await popup.evaluate(
      `chrome.runtime.sendMessage({ type: "multiapp:status", url: ${JSON.stringify(site)} })`,
    );
    assert(
      lookup?.matches?.length === 1 && lookup.matches[0].username === USERNAME,
      "o site de teste casa com a credencial guardada",
    );

    const loginTab = await openTab(site);
    const login = await connect(loginTab.webSocketDebuggerUrl);
    let filled = null;
    for (let attempt = 0; attempt < 25; attempt += 1) {
      await sleep(400);
      filled = await login.evaluate(
        `(() => {
          const senha = document.querySelector('input[type="password"]');
          const usuario = document.querySelector('input[name="usuario"]');
          return { senha: senha?.value ?? "", usuario: usuario?.value ?? "" };
        })()`,
      );
      if (filled?.senha === SECRET) break;
    }
    assert(filled?.senha === SECRET, "a senha foi preenchida sozinha no formulário");
    assert(filled?.usuario === USERNAME, "o usuário foi preenchido sozinho");

    const badge = await login.evaluate(
      `Boolean(document.getElementById("multiapp-cofre-badge"))`,
    );
    assert(badge === true, "o selo do Multiapp aparece na página");

    await popup.evaluate(`chrome.runtime.sendMessage({ type: "multiapp:lock" })`);
    await login.evaluate(`location.reload()`);
    await sleep(2500);
    const afterLock = await login.evaluate(
      `document.querySelector('input[type="password"]')?.value ?? ""`,
    );
    assert(afterLock === "", "com o cofre bloqueado, nada é preenchido");

    console.log("\nExtensão verificada no Chromium de ponta a ponta.");
  } finally {
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
