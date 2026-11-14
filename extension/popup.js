const $ = (id) => document.getElementById(id);

const el = {
  statusDot: $("status-dot"),
  lockedView: $("locked-view"),
  unlockedView: $("unlocked-view"),
  unlockForm: $("unlock-form"),
  unlock: $("unlock"),
  passphrase: $("passphrase"),
  lockedHint: $("locked-hint"),
  scan: $("scan"),
  openApp: $("open-app"),
  openAppFoot: $("open-app-foot"),
  recordCount: $("record-count"),
  recordLabel: $("record-label"),
  vaultId: $("vault-id"),
  siteLine: $("site-line"),
  siteMatches: $("site-matches"),
  toggleAutofill: $("toggle-autofill"),
  toggleSubmit: $("toggle-submit"),
  lockMinutes: $("lock-minutes"),
  lock: $("lock"),
  refresh: $("refresh"),
  feedback: $("feedback"),
  helpLink: $("help-link"),
};

let origin = "";
let activeUrl = "";

async function send(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    return { error: String(error?.message ?? error) };
  }
}

function setFeedback(text, isError = false) {
  el.feedback.textContent = text ?? "";
  el.feedback.classList.toggle("error", Boolean(isError));
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function applySettings(settings) {
  el.toggleAutofill.checked = settings.autoFill !== false;
  el.toggleSubmit.checked = settings.autoSubmit === true;
  const minutes = String(settings.lockMinutes ?? 30);
  if (![...el.lockMinutes.options].some((option) => option.value === minutes))
    el.lockMinutes.add(new Option(`${minutes} minutos`, minutes));
  el.lockMinutes.value = minutes;
}

function applySite(status) {
  el.siteMatches.textContent = "";
  if (!/^https?:\/\//i.test(activeUrl)) {
    el.siteLine.textContent = "Abra um site para ver as senhas guardadas.";
    return;
  }
  const host = hostOf(activeUrl);
  const matches = Array.isArray(status.matches) ? status.matches : [];
  if (!host) {
    el.siteLine.textContent = "Esta aba não é um site http(s).";
    return;
  }
  if (!matches.length) {
    el.siteLine.textContent = `Nenhuma senha guardada para ${host}.`;
    return;
  }
  el.siteLine.textContent =
    matches.length === 1
      ? `1 senha guardada para ${host}:`
      : `${matches.length} senhas guardadas para ${host}:`;
  for (const match of matches) {
    const item = document.createElement("li");
    const name = document.createElement("strong");
    name.textContent = match.title || match.domain;
    const user = document.createElement("span");
    user.textContent = match.username || "(sem usuário)";
    item.append(name, user);
    el.siteMatches.append(item);
  }
}

function applyHelpLink(value) {
  origin = value || "";
  el.helpLink.href = origin ? `${origin}/extensao` : "#";
  el.helpLink.title = origin
    ? "Abrir as instruções no Multiapp"
    : "Abra o Multiapp primeiro";
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function render(retried = false) {
  const tab = await currentTab();
  activeUrl = tab?.url ?? "";
  const status = await send({ type: "multiapp:status", url: activeUrl });
  if (!status || status.error) {
    setFeedback(
      status?.error ?? "A extensão foi atualizada. Feche e abra este popup.",
      true,
    );
    return;
  }
  const unlocked = status.status === "unlocked";
  if (!unlocked && !status.hasEnvelope && !retried) {
    // Primeira vez: procura o cofre numa aba do Multiapp antes de reclamar.
    const scanned = await send({ type: "multiapp:refresh-envelope" });
    if (scanned?.ok) {
      await render(true);
      return;
    }
  }
  el.lockedView.hidden = unlocked;
  el.unlockedView.hidden = !unlocked;
  el.statusDot.dataset.state = unlocked ? "unlocked" : "locked";
  applySettings(status.settings ?? {});
  applyHelpLink(status.origin);

  if (unlocked) {
    el.recordCount.textContent = String(status.count ?? 0);
    el.recordLabel.textContent =
      (status.count ?? 0) === 1 ? "credencial no cofre" : "credenciais no cofre";
    el.vaultId.textContent = status.vaultId ? `cofre ${status.vaultId}` : "";
    applySite(status);
  } else {
    el.siteMatches.textContent = "";
    el.siteLine.textContent = "";
    el.lockedHint.textContent = status.hasEnvelope
      ? "Use a mesma senha mestra do Multiapp. Nada sai deste navegador."
      : "Nenhum cofre neste navegador ainda. Abra o Multiapp, crie ou desbloqueie o cofre uma vez e volte aqui.";
    el.lockedHint.classList.toggle("error", !status.hasEnvelope);
    el.openApp.hidden = !origin;
    el.passphrase.focus();
  }
}


async function openApp() {
  if (!origin) {
    setFeedback("Abra o Multiapp na barra de endereços primeiro.", true);
    return;
  }
  await chrome.tabs.create({ url: `${origin}/` });
  window.close();
}

el.unlockForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const passphrase = el.passphrase.value;
  if (!passphrase.trim()) {
    setFeedback("Digite a senha mestra.", true);
    return;
  }
  el.unlock.disabled = true;
  setFeedback("Abrindo o cofre…");
  const response = await send({ type: "multiapp:unlock", passphrase });
  el.unlock.disabled = false;
  if (!response || response.error) {
    setFeedback(response?.error ?? "Não foi possível abrir o cofre.", true);
    el.passphrase.select();
    return;
  }
  el.passphrase.value = "";
  setFeedback(
    `Cofre aberto: ${response.count} ${
      response.count === 1 ? "credencial" : "credenciais"
    }. O Chrome já pode preencher.`,
  );
  await render();
});

el.toggleAutofill.addEventListener("change", async () => {
  const response = await send({
    type: "multiapp:settings",
    settings: { autoFill: el.toggleAutofill.checked },
  });
  if (response?.error) setFeedback(response.error, true);
  else
    setFeedback(
      el.toggleAutofill.checked
        ? "O preenchimento volta a ser automático ao abrir o site."
        : "Agora só preenche quando você clicar no selo do Multiapp.",
    );
});

el.toggleSubmit.addEventListener("change", async () => {
  const response = await send({
    type: "multiapp:settings",
    settings: { autoSubmit: el.toggleSubmit.checked },
  });
  if (response?.error) setFeedback(response.error, true);
  else
    setFeedback(
      el.toggleSubmit.checked
        ? "O formulário será enviado logo depois do preenchimento."
        : "Você aperta Enter para entrar.",
    );
});

el.lockMinutes.addEventListener("change", async () => {
  const response = await send({
    type: "multiapp:settings",
    settings: { lockMinutes: Number(el.lockMinutes.value) },
  });
  if (response?.error) setFeedback(response.error, true);
  else setFeedback("Prazo de bloqueio atualizado.");
});

el.lock.addEventListener("click", async () => {
  await send({ type: "multiapp:lock" });
  setFeedback("Cofre bloqueado. Nenhuma senha fica na memória.");
  await render();
});

async function refreshEnvelope() {
  const response = await send({ type: "multiapp:refresh-envelope" });
  if (!response || response.error || !response.ok) {
    setFeedback(
      "Nenhum cofre aberto no Multiapp. Abra o app numa aba e tente de novo.",
      true,
    );
    await render();
    return;
  }
  setFeedback("Cofre atualizado. Digite a senha mestra de novo para abrir.");
  await render();
}

el.refresh.addEventListener("click", refreshEnvelope);
el.scan.addEventListener("click", refreshEnvelope);
el.openApp.addEventListener("click", openApp);
el.openAppFoot.addEventListener("click", openApp);
el.helpLink.addEventListener("click", async (event) => {
  event.preventDefault();
  if (!origin) {
    setFeedback("Abra o Multiapp primeiro para ver as instruções.", true);
    return;
  }
  await chrome.tabs.create({ url: `${origin}/extensao` });
  window.close();
});

render();
