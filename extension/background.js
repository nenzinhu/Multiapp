/**
 * Service worker: é o único lugar que decifra o cofre.
 *
 * A senha mestra é digitada no popup e convertida em chave AES-GCM. A chave
 * (não a senha, nem o texto decifrado) fica em `chrome.storage.session`, que o
 * Chrome mantém só na memória e apaga ao fechar o navegador. As abas nunca
 * enxergam esse espaço: cada script de conteúdo recebe apenas a credencial do
 * site em que está, quando pede.
 */

import {
  decryptEnvelopeWithKey,
  exportKey,
  importKey,
  openVaultEnvelope,
  parseVaultEnvelope,
  vaultId,
} from "./lib/vault-crypto.js";
import { describeLogin, findSiteLogins, hostMatches } from "./lib/site-match.js";

const DEFAULT_SETTINGS = {
  autoFill: true,
  autoSubmit: false,
  lockMinutes: 30,
  serverUrl: "",
};

const ALARM_NAME = "multiapp-autolock";
const CACHE_LIMIT = 1;

let recordsCache = { signature: "", records: null };

async function getSettings() {
  const stored = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(stored.settings ?? {}) };
}

async function saveSettings(patch) {
  const settings = { ...(await getSettings()), ...patch };
  const safe = {
    autoFill: settings.autoFill !== false,
    autoSubmit: settings.autoSubmit === true,
    lockMinutes: Number.isFinite(settings.lockMinutes)
      ? Math.min(Math.max(Math.trunc(settings.lockMinutes), 0), 480)
      : DEFAULT_SETTINGS.lockMinutes,
    serverUrl: typeof settings.serverUrl === "string" ? settings.serverUrl : "",
  };
  await chrome.storage.local.set({ settings: safe });
  return safe;
}

async function cachedEnvelope() {
  const stored = await chrome.storage.local.get(["envelope", "envelopeOrigin"]);
  const envelope = parseVaultEnvelope(stored.envelope);
  if (!envelope) return null;
  return { envelope, origin: stored.envelopeOrigin ?? "" };
}

/**
 * Percorre as abas abertas atrás de uma página do Multiapp. Só ela responde
 * (o app traz `<meta name="multiapp-vault">`), e a resposta é o envelope
 * selado que já estava no `localStorage` — nunca a senha mestra.
 */
async function envelopeFromTabs() {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return null;
  }
  let newest = null;
  for (const tab of tabs) {
    if (!tab.id || !/^https?:/i.test(tab.url ?? "")) continue;
    let response = null;
    try {
      response = await chrome.tabs.sendMessage(
        tab.id,
        { type: "multiapp:vault-envelope" },
        { frameId: 0 },
      );
    } catch {
      continue;
    }
    const envelope = parseVaultEnvelope(response?.envelope);
    if (!envelope) continue;
    if (!newest || envelope.updatedAt >= newest.envelope.updatedAt)
      newest = { envelope, origin: response.origin ?? "" };
  }
  return newest;
}

async function lockVault() {
  recordsCache = { signature: "", records: null };
  await chrome.storage.session.remove("vault");
  const tabs = await chrome.tabs.query({}).catch(() => []);
  for (const tab of tabs) {
    if (!tab.id) continue;
    chrome.tabs
      .sendMessage(tab.id, { type: "multiapp:locked" }, { frameId: 0 })
      .catch(() => {});
  }
}

/** Sessão válida: a chave no `storage.session` e o prazo do auto-bloqueio. */
async function readVault() {
  const stored = await chrome.storage.session.get("vault");
  const vault = stored.vault;
  if (!vault?.key) return null;
  if (vault.expiresAt && Date.now() > vault.expiresAt) {
    await lockVault();
    return null;
  }
  return vault;
}

async function recordsFor(vault) {
  const signature = `${vault.envelope?.updatedAt ?? 0}:${vault.envelope?.data?.length ?? 0}:${vault.key.slice(0, 8)}`;
  if (recordsCache.signature === signature && recordsCache.records)
    return recordsCache.records;
  const records = await decryptEnvelopeWithKey(vault.envelope, await importKey(vault.key));
  if (CACHE_LIMIT > 0) recordsCache = { signature, records };
  return records;
}

async function unlockVault(passphrase) {
  if (typeof passphrase !== "string" || !passphrase.trim())
    throw new Error("Digite a senha mestra do cofre.");
  const fromTabs = await envelopeFromTabs();
  const cached = await cachedEnvelope();
  const chosen =
    fromTabs ?? cached ?? null;
  if (!chosen)
    throw new Error(
      "Nenhum cofre neste navegador. Abra o Multiapp, desbloqueie o cofre uma vez e tente de novo.",
    );
  let opened;
  try {
    opened = await openVaultEnvelope(chosen.envelope, passphrase);
  } catch (error) {
    throw new Error(error?.message || "Não foi possível abrir o cofre.");
  }
  const settings = await getSettings();
  const now = Date.now();
  await chrome.storage.local.set({
    envelope: chosen.envelope,
    envelopeOrigin: chosen.origin,
    envelopeSavedAt: now,
  });
  if (chosen.origin) await saveSettings({ serverUrl: chosen.origin });
  await chrome.storage.session.set({
    vault: {
      key: await exportKey(opened.key),
      envelope: chosen.envelope,
      unlockedAt: now,
      expiresAt: settings.lockMinutes > 0 ? now + settings.lockMinutes * 60_000 : 0,
      count: opened.records.length,
    },
  });
  recordsCache = { signature: "", records: opened.records };
  if (settings.lockMinutes > 0) ensureAlarm();
  return {
    count: opened.records.length,
    vaultId: vaultId(chosen.envelope),
    origin: chosen.origin,
  };
}

function updateBadge(tabId, matches) {
  if (typeof tabId !== "number") return;
  const text = matches.length > 1 ? String(matches.length) : matches.length ? "1" : "";
  Promise.resolve(chrome.action.setBadgeText({ tabId, text })).catch(() => {});
  Promise.resolve(
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#22d3ee" }),
  ).catch(() => {});
}

async function statusFor(url) {
  const settings = await getSettings();
  const cached = await cachedEnvelope();
  const vault = await readVault();
  if (!vault)
    return {
      status: "locked",
      hasEnvelope: Boolean(cached),
      origin: cached?.origin ?? "",
      settings,
    };
  try {
    const records = await recordsFor(vault);
    return {
      status: "unlocked",
      count: records.length,
      matches: url ? findSiteLogins(records, url).map(describeLogin) : [],
      vaultId: vault.envelope ? vaultId(vault.envelope) : "",
      expiresAt: vault.expiresAt ?? 0,
      origin: cached?.origin ?? "",
      settings,
    };
  } catch {
    await lockVault();
    return {
      status: "locked",
      hasEnvelope: Boolean(cached),
      origin: cached?.origin ?? "",
      settings,
      message: "O cofre precisa ser aberto de novo.",
    };
  }
}

async function lookupFor(url, tabId) {
  const status = await statusFor(url);
  if (status.status === "unlocked") updateBadge(tabId, status.matches ?? []);
  else updateBadge(tabId, []);
  return status;
}

async function secretFor(url, id) {
  const vault = await readVault();
  if (!vault) throw new Error("O cofre está bloqueado.");
  const records = await recordsFor(vault);
  const candidates = findSiteLogins(records, url);
  const record = id ? records.find((item) => item.id === id) : candidates[0];
  if (!record) throw new Error("Nenhuma credencial guardada para este site.");
  if (!hostMatches(record.url, url))
    throw new Error("Essa credencial não pertence a este site.");
  return {
    id: record.id,
    title: record.title,
    username: record.username,
    secret: record.secret,
  };
}

async function refreshEnvelope() {
  const fromTabs = await envelopeFromTabs();
  if (!fromTabs) return { ok: false };
  await chrome.storage.local.set({
    envelope: fromTabs.envelope,
    envelopeOrigin: fromTabs.origin,
    envelopeSavedAt: Date.now(),
  });
  // Uma cópia nova invalida o texto decifrado em memória.
  recordsCache = { signature: "", records: null };
  await chrome.storage.session.remove("vault");
  return { ok: true, origin: fromTabs.origin };
}

async function handleMessage(message, sender) {
  const type = message?.type;
  switch (type) {
    case "multiapp:status":
      return statusFor(message.url);
    case "multiapp:unlock":
      return { ok: true, ...(await unlockVault(message.passphrase)) };
    case "multiapp:lock":
      await lockVault();
      return { ok: true };
    case "multiapp:lookup":
      return lookupFor(message.url, sender?.tab?.id);
    case "multiapp:fill":
      return { ok: true, ...(await secretFor(message.url, message.id)) };
    case "multiapp:settings": {
      const settings = await saveSettings(message.settings ?? {});
      const vault = await readVault();
      if (vault) {
        const expiresAt =
          settings.lockMinutes > 0
            ? Date.now() + settings.lockMinutes * 60_000
            : 0;
        await chrome.storage.session.set({ vault: { ...vault, expiresAt } });
        if (settings.lockMinutes > 0) ensureAlarm();
      }
      return { ok: true, settings };
    }
    case "multiapp:refresh-envelope":
      return refreshEnvelope();
    case "multiapp:vault-page": {
      const envelope = parseVaultEnvelope(message.envelope);
      if (!envelope) return { ok: false };
      const cached = await cachedEnvelope();
      if (cached && cached.envelope.data === envelope.data) return { ok: true };
      await chrome.storage.local.set({
        envelope,
        envelopeOrigin: message.origin ?? "",
        envelopeSavedAt: Date.now(),
      });
      if (message.origin) await saveSettings({ serverUrl: message.origin });
      // Envelope novo: o texto decifrado em memória não vale mais.
      recordsCache = { signature: "", records: null };
      await chrome.storage.session.remove("vault");
      return { ok: true };
    }
    case "multiapp:open-popup":
      try {
        await chrome.action.openPopup();
        return { ok: true };
      } catch {
        return { ok: false };
      }
    default:
      return { ok: false, message: "Ação desconhecida." };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((response) => sendResponse(response))
    .catch((error) =>
      sendResponse({ ok: false, error: error?.message ?? String(error) }),
    );
  return true;
});

async function prepare() {
  // As abas não leem `storage.session`: só o popup e este worker.
  try {
    await chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
  } catch {
    // Versões antigas ignoram; o padrão já é este.
  }
  const stored = await chrome.storage.local.get("settings");
  if (!stored.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
}

chrome.runtime.onInstalled.addListener(() => {
  prepare();
});
chrome.runtime.onStartup.addListener(() => {
  prepare();
});
prepare();

function ensureAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  const vault = await readVault();
  if (!vault) chrome.alarms.clear(ALARM_NAME);
});
