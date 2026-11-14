/**
 * Script de conteúdo: encontra o formulário de login, pede a credencial do site
 * ao service worker e preenche. O texto decifrado aparece aqui só dentro do
 * campo — ele nunca é guardado no `localStorage` da página.
 *
 * Também responde ao worker com o envelope selado quando esta aba é o Multiapp
 * (marcado por `<meta name="multiapp-vault">`), para que o cofre possa ser
 * aberto a partir da extensão.
 */

(() => {
  if (globalThis.__multiappAutofill) return;
  globalThis.__multiappAutofill = true;

  const VAULT_KEY = "multiapp.vault.v1";
  const isTopFrame = window.top === window;
  const state = {
    status: "unknown",
    hasEnvelope: false,
    matches: [],
    filledId: "",
    settings: { autoFill: true, autoSubmit: false },
    message: "",
    panelOpen: false,
  };

  function isMultiappPage() {
    return Boolean(
      document.querySelector('meta[name="multiapp-vault"]') &&
        localStorage.getItem(VAULT_KEY),
    );
  }

  function readEnvelope() {
    try {
      const raw = localStorage.getItem(VAULT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "multiapp:vault-envelope") {
      sendResponse({
        envelope: isMultiappPage() ? readEnvelope() : null,
        origin: location.origin,
      });
      return;
    }
    if (message?.type === "multiapp:locked") {
      state.status = "locked";
      state.matches = [];
      state.filledId = "";
      renderBadge();
    }
  });

  /** Avisa o worker assim que o app abre, para o cofre já ficar à mão. */
  function announceEnvelope() {
    if (!isMultiappPage()) return;
    const envelope = readEnvelope();
    if (!envelope) return;
    send({
      type: "multiapp:vault-page",
      envelope,
      origin: location.origin,
    });
  }

  /** Conversa com o service worker pelo formato de callback (sempre existe). */
  function send(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          resolve(response ?? null);
        });
      } catch {
        resolve(null);
      }
    });
  }

  const PASSWORD_SELECTOR = 'input[type="password"]';
  const USERNAME_HINTS =
    /(user|usuario|usuário|e-?mail|mail|login|account|conta|cpf|telefone|phone|identificador)/i;

  function isVisible(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.disabled || element.readOnly) return false;
    if (!element.getClientRects().length) return false;
    const style = getComputedStyle(element);
    return (
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0"
    );
  }

  function passwordFields() {
    return [...document.querySelectorAll(PASSWORD_SELECTOR)].filter(isVisible);
  }

  function isBefore(first, second) {
    return Boolean(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }

  function looksLikeUsername(input) {
    const autocomplete = input.getAttribute("autocomplete") ?? "";
    if (/username|email/i.test(autocomplete)) return true;
    const label = `${input.name ?? ""} ${input.id ?? ""} ${
      input.getAttribute("placeholder") ?? ""
    } ${input.getAttribute("aria-label") ?? ""}`;
    return USERNAME_HINTS.test(label);
  }

  /** Campo de usuário do mesmo formulário, de preferência antes da senha. */
  function usernameFieldFor(passwordField) {
    const scope =
      passwordField.form ??
      passwordField.closest("form, section, article, main, div") ??
      document.body;
    const inputs = [...scope.querySelectorAll("input")].filter(
      (input) =>
        input !== passwordField &&
        isVisible(input) &&
        (input.type === "" ||
          input.type === "text" ||
          input.type === "email" ||
          input.type === "tel") &&
        input.getAttribute("autocomplete") !== "one-time-code",
    );
    if (!inputs.length) return null;
    const before = inputs.filter((input) => isBefore(input, passwordField));
    const pool = before.length ? before : inputs;
    const hinted = pool.find(looksLikeUsername);
    if (hinted) return hinted;
    return pool.length === 1 ? pool[0] : pool[pool.length - 1];
  }

  /** `value` direto não dispara o React: usa o setter nativo e os eventos. */
  function setFieldValue(input, value) {
    const proto = Object.getPrototypeOf(input);
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    const setter = descriptor?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function submitForm(passwordField) {
    const form = passwordField.form;
    if (!form) return;
    const button = form.querySelector(
      'button[type="submit"], input[type="submit"], button:not([type])',
    );
    window.setTimeout(() => {
      try {
        if (button instanceof HTMLElement) button.click();
        else if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      } catch {
        // O site pode recusar o envio; aí o usuário aperta Enter.
      }
    }, 120);
  }

  function fillFields(credential) {
    const fields = passwordFields();
    if (!fields.length) return false;
    const passwordField = fields[0];
    const userField = usernameFieldFor(passwordField);
    if (userField) setFieldValue(userField, credential.username ?? "");
    setFieldValue(passwordField, credential.secret ?? "");
    if (state.settings.autoSubmit) submitForm(passwordField);
    return true;
  }

  /** Preenche uma credencial específica; devolve `false` quando não deu. */
  async function fillWith(id) {
    if (!passwordFields().length) {
      state.message = "Esta página não mostra um campo de senha.";
      renderBadge();
      return false;
    }
    const response = await send({
      type: "multiapp:fill",
      url: location.href,
      id,
    });
    if (!response || response.error || !response.secret) {
      state.message = response?.error ?? "Não foi possível ler o cofre.";
      renderBadge();
      return false;
    }
    const filled = fillFields(response);
    if (filled) {
      state.filledId = response.id ?? "";
      state.message = "";
    }
    renderBadge();
    return filled;
  }

  /* ---------------------------------------------------------------- badge -- */

  const BADGE_CSS = `
    :host { color-scheme: dark; }
    .wrap { font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; color: #e9edf4; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .panel { width: 288px; background: #16181c; border: 1px solid #2e333c; border-radius: 14px; padding: 8px; box-shadow: 0 18px 40px rgba(0, 0, 0, .45); }
    .panel-title { margin: 6px 10px 8px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase; color: #9aa6b8; font-weight: 700; }
    .item { display: flex; flex-direction: column; gap: 2px; width: 100%; text-align: left; padding: 9px 10px; border-radius: 10px; background: transparent; border: 0; color: inherit; font: inherit; cursor: pointer; }
    .item:hover { background: #22262e; }
    .item:focus-visible { outline: 2px solid #67e8f9; outline-offset: -2px; }
    .item strong { font-weight: 600; font-size: 13px; }
    .item span { color: #9aa6b8; font-size: 12px; }
    .hint { margin: 2px 10px 8px; color: #9aa6b8; font-size: 12px; line-height: 1.45; }
    .pill { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: #16181c; border: 1px solid #2e333c; box-shadow: 0 12px 30px rgba(0, 0, 0, .35); color: #e9edf4; font: inherit; cursor: pointer; }
    .pill:hover { border-color: #3c434f; }
    .pill:focus-visible { outline: 2px solid #67e8f9; outline-offset: 2px; }
    .dot { width: 8px; height: 8px; border-radius: 999px; background: #22d3ee; flex: 0 0 auto; }
    .dot.locked { background: #facc15; }
    .dot.error { background: #f87171; }
    .muted { color: #9aa6b8; }
  `;

  let badgeHost = null;
  let badgeShadow = null;
  let messageTimer = 0;

  function removeBadge() {
    if (badgeHost) badgeHost.remove();
    badgeHost = null;
    badgeShadow = null;
  }

  function ensureBadge() {
    if (badgeHost?.isConnected) return;
    badgeHost = document.createElement("div");
    badgeHost.id = "multiapp-cofre-badge";
    badgeHost.setAttribute("data-multiapp", "cofre");
    badgeHost.setAttribute("role", "complementary");
    badgeHost.setAttribute("aria-label", "Multiapp Cofre");
    badgeHost.style.cssText =
      "all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;";
    badgeShadow = badgeHost.attachShadow({ mode: "open" });
    badgeShadow.innerHTML = `<style>${BADGE_CSS}</style><div class="wrap"></div>`;
    document.documentElement.append(badgeHost);
  }

  function pillButton(label, tone) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pill";
    const dot = document.createElement("span");
    dot.className = `dot${tone ? ` ${tone}` : ""}`;
    const text = document.createElement("span");
    text.textContent = label;
    button.append(dot, text);
    return button;
  }

  function matchesPanel() {
    const panel = document.createElement("div");
    panel.className = "panel";
    const title = document.createElement("div");
    title.className = "panel-title";
    title.textContent = "Multiapp Cofre";
    panel.append(title);
    for (const match of state.matches) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "item";
      const name = document.createElement("strong");
      name.textContent = match.title || match.domain;
      const detail = document.createElement("span");
      detail.textContent = `${match.username} · ${match.domain}`;
      item.append(name, detail);
      item.addEventListener("click", () => {
        state.panelOpen = false;
        fillWith(match.id);
      });
      panel.append(item);
    }
    return panel;
  }

  function renderBadge() {
    if (!isTopFrame || !document.documentElement) return;
    const hasPasswordField = passwordFields().length > 0;
    const showLocked = state.status === "locked" && state.hasEnvelope && hasPasswordField;
    const showMatches = state.status === "unlocked" && state.matches.length > 0 && hasPasswordField;
    const showMessage = Boolean(state.message) && hasPasswordField;
    if (!showLocked && !showMatches && !showMessage) {
      removeBadge();
      return;
    }
    ensureBadge();
    const wrap = badgeShadow.querySelector(".wrap");
    wrap.textContent = "";
    if (showMessagesPanel()) wrap.append(matchesPanel());

    let tone = "";
    let label = "";
    let onClick = null;
    if (showMessage) {
      tone = "error";
      label = state.message;
    } else if (showLocked) {
      tone = "locked";
      label = "Abrir o cofre Multiapp";
      onClick = async () => {
        const response = await send({ type: "multiapp:open-popup" });
        if (!response?.ok)
          state.message = "Toque no ícone do Multiapp Cofre na barra do Chrome.";
        renderBadge();
      };
    } else if (state.filledId) {
      label = "Senha preenchida · Multiapp";
      onClick = () => {
        state.panelOpen = !state.panelOpen;
        renderBadge();
      };
    } else {
      label =
        state.matches.length === 1
          ? "Preencher com o Multiapp"
          : `${state.matches.length} senhas do Multiapp`;
      onClick = () => {
        if (state.matches.length === 1) fillWith(state.matches[0].id);
        else {
          state.panelOpen = !state.panelOpen;
          renderBadge();
        }
      };
    }

    const pill = pillButton(label, tone);
    if (onClick) pill.addEventListener("click", onClick);
    else pill.style.cursor = "default";
    wrap.append(pill);
    scheduleMessageClear();
  }

  function showMessagesPanel() {
    return state.panelOpen && state.status === "unlocked" && state.matches.length > 1;
  }

  function scheduleMessageClear() {
    window.clearTimeout(messageTimer);
    if (!state.message) return;
    messageTimer = window.setTimeout(() => {
      state.message = "";
      renderBadge();
    }, 7000);
  }

  /* -------------------------------------------------------- sincronização -- */

  let observer = null;
  let syncTimer = 0;
  let syncing = false;

  async function sync({ fill = true } = {}) {
    if (syncing) return;
    syncing = true;
    try {
      const response = await send({ type: "multiapp:lookup", url: location.href });
      if (!response || response.error) return;
      state.status = response.status ?? "unknown";
      state.hasEnvelope =
        Boolean(response.hasEnvelope) || state.hasEnvelope;
      state.settings = response.settings ?? state.settings;
      const matches = Array.isArray(response.matches) ? response.matches : [];
      if (state.filledId && !matches.some((match) => match.id === state.filledId))
        state.filledId = "";
      state.matches = matches;
      if (
        fill &&
        state.status === "unlocked" &&
        matches.length === 1 &&
        state.settings.autoFill !== false
      ) {
        const [target] = passwordFields();
        if (target && !target.value) await fillWith(matches[0].id);
      }
      renderBadge();
    } finally {
      syncing = false;
    }
  }

  function startWatching() {
    if (observer) return;
    observer = new MutationObserver(() => {
      if (!passwordFields().length) return;
      window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(() => sync(), 300);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener(
      "focusin",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (target.type !== "password" || target.value) return;
        if (state.status !== "unlocked" || !state.matches.length) return;
        if (state.matches.length === 1) fillWith(state.matches[0].id);
        else {
          state.panelOpen = true;
          renderBadge();
        }
      },
      true,
    );
  }

  /** SPA troca de tela sem recarregar: a URL muda e o preenchimento recomeça. */
  function watchNavigation() {
    let lastHref = location.href;
    window.setInterval(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      state.filledId = "";
      state.panelOpen = false;
      sync();
    }, 1200);
  }

  async function boot() {
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    startWatching();
    announceEnvelope();
    await sync();
    watchNavigation();
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
