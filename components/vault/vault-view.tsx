"use client";

import * as React from "react";
import { motion } from "motion/react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  Bot,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordDialog, type RecordDraft } from "@/components/vault/record-dialog";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai-providers";
import {
  changePassphrase,
  createVault,
  lockVault,
  maskSecret,
  mergeVaultRecords,
  readStoredVault,
  sealRecords,
  unlockVault,
  vaultDomain,
  writeStoredVault,
  type StoredVault,
  type VaultRecord,
} from "@/lib/vault";

export type VaultSection = "sites" | "providers";

type Status = "loading" | "setup" | "locked" | "unlocked";
type Notice = { message: string; error?: boolean; undo?: () => void };

function now(): number {
  return Date.now();
}

function PassphraseDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  withConfirmation,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  withConfirmation?: boolean;
  onSubmit: (passphrase: string, confirmation: string) => void;
}) {
  const [passphrase, setPassphrase] = React.useState("");
  const [confirmation, setConfirmation] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setPassphrase("");
    setConfirmation("");
    setError("");
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (passphrase.length < 6) {
      setError("Use pelo menos 6 caracteres.");
      return;
    }
    if (withConfirmation && passphrase !== confirmation) {
      setError("As senhas não são iguais.");
      return;
    }
    setError("");
    onSubmit(passphrase, confirmation);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog" showCloseButton={false}>
        <div className="dialog-heading">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Fechar">
            <Lock size={20} />
          </DialogClose>
        </div>
        <form noValidate onSubmit={submit} className="editor-form">
          <div className="field">
            <label htmlFor="passphrase-input">Senha mestra</label>
            <input
              id="passphrase-input"
              autoFocus
              type="password"
              autoComplete="off"
              maxLength={200}
              value={passphrase}
              onChange={(event) => {
                setPassphrase(event.target.value);
                setError("");
              }}
            />
          </div>
          {withConfirmation && (
            <div className="field">
              <label htmlFor="passphrase-confirm">Repita a senha mestra</label>
              <input
                id="passphrase-confirm"
                type="password"
                autoComplete="off"
                maxLength={200}
                value={confirmation}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setError("");
                }}
              />
            </div>
          )}
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </button>
            <button type="submit" className="button primary">
              {submitLabel}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VaultView({ section }: { section: VaultSection }) {
  const [status, setStatus] = React.useState<Status>("loading");
  const [records, setRecords] = React.useState<VaultRecord[]>([]);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState<Notice | null>(null);
  const [query, setQuery] = React.useState("");
  const [revealed, setRevealed] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [unlockValue, setUnlockValue] = React.useState("");
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    kind: "site" | "api";
    draft?: RecordDraft;
    recordId?: string;
    provider?: AiProvider;
  }>({ open: false, kind: "site" });
  const [passphraseMode, setPassphraseMode] = React.useState<
    null | "create" | "change"
  >(null);
  const [importedVault, setImportedVault] = React.useState<StoredVault | null>(
    null,
  );

  React.useEffect(() => {
    setStatus(readStoredVault() ? "locked" : "setup");
  }, []);

  const kind: "site" | "api" = section === "providers" ? "api" : "site";
  const isProviders = kind === "api";
  const visible = React.useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    return records
      .filter((record) => record.kind === kind)
      .filter((record) => {
        if (!search) return true;
        return `${record.title} ${record.url} ${record.username} ${record.notes}`
          .toLocaleLowerCase("pt-BR")
          .includes(search);
      })
      .sort(
        (a, b) =>
          Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt,
      );
  }, [records, kind, query]);

  function notify(message: string, undo?: () => void, isError = false) {
    setNotice({ message, undo, error: isError });
  }

  async function persist(next: VaultRecord[]) {
    const sealed = await sealRecords(next);
    writeStoredVault(sealed);
    setRecords(next);
  }

  async function handleCreate(passphrase: string, confirmation: string) {
    if (passphrase.length < 6) {
      setError("Use pelo menos 6 caracteres.");
      return;
    }
    if (passphrase !== confirmation) {
      setError("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    try {
      const stored = await createVault(passphrase);
      writeStoredVault(stored);
      setRecords([]);
      setPassphraseMode(null);
      setStatus("unlocked");
      setError("");
      notify("Cofre criado. Tudo o que guardar aqui fica criptografado.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock(passphrase: string) {
    const stored = readStoredVault();
    if (!stored) {
      setStatus("setup");
      return;
    }
    setBusy(true);
    try {
      const data = await unlockVault(stored, passphrase);
      setRecords(data.records);
      setStatus("unlocked");
      setError("");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleLock() {
    lockVault();
    setRecords([]);
    setRevealed([]);
    setStatus("locked");
    notify("Cofre bloqueado.");
  }

  async function handleSave(draft: RecordDraft) {
    try {
      if (dialog.draft) {
        const next = records.map((record) =>
          record.id === dialog.recordId
            ? {
                ...record,
                title: draft.title.trim(),
                url: draft.url.trim(),
                username: draft.username.trim(),
                secret: draft.secret,
                notes: draft.notes.trim(),
                providerId: draft.providerId,
                updatedAt: now(),
              }
            : record,
        );
        await persist(next);
        notify("Alterações salvas no cofre.");
      } else {
        const record: VaultRecord = {
          id: crypto.randomUUID(),
          kind,
          title: draft.title.trim(),
          url: draft.url.trim(),
          username: draft.username.trim(),
          secret: draft.secret,
          notes: draft.notes.trim(),
          providerId: draft.providerId,
          favorite: false,
          createdAt: now(),
          updatedAt: now(),
        };
        await persist([record, ...records]);
        notify(
          kind === "api"
            ? "Chave guardada no cofre."
            : "Credencial guardada no cofre.",
        );
      }
      setDialog({ open: false, kind });
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    }
  }

  async function handleRemove(record: VaultRecord) {
    const removed = record;
    const previous = records;
    try {
      await persist(records.filter((item) => item.id !== record.id));
      notify(`${removed.title} removido do cofre.`, async () => {
        try {
          await persist([removed, ...previous]);
          notify("Registro restaurado.");
        } catch (caught) {
          notify((caught as Error).message, undefined, true);
        }
      });
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    }
  }

  async function handleFavorite(record: VaultRecord) {
    try {
      await persist(
        records.map((item) =>
          item.id === record.id
            ? { ...item, favorite: !item.favorite, updatedAt: now() }
            : item,
        ),
      );
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    }
  }

  async function copySecret(record: VaultRecord) {
    if (!record.secret) {
      notify("Este registro não tem segredo guardado.", undefined, true);
      return;
    }
    try {
      await navigator.clipboard.writeText(record.secret);
      notify("Segredo copiado.");
    } catch {
      notify(
        "Não foi possível copiar. Abra a edição e copie o valor.",
        undefined,
        true,
      );
    }
  }

  function exportVault() {
    const stored = readStoredVault();
    if (!stored) return;
    const blob = new Blob([JSON.stringify(stored, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `multiapp-cofre-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Cofre exportado. O arquivo continua criptografado.");
  }

  async function pickImport(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as StoredVault;
      if (
        parsed?.version !== 1 ||
        typeof parsed.salt !== "string" ||
        typeof parsed.iv !== "string" ||
        typeof parsed.data !== "string"
      )
        throw new Error("Este arquivo não é um cofre do Multiapp.");
      setImportedVault(parsed);
    } catch (caught) {
      notify(
        caught instanceof SyntaxError
          ? "Este arquivo não é um JSON válido."
          : (caught as Error).message,
        undefined,
        true,
      );
    }
  }

  async function importWithPassphrase(passphrase: string) {
    if (!importedVault) return;
    setBusy(true);
    try {
      const data = await unlockVault(importedVault, passphrase);
      const merged = mergeVaultRecords(records, data.records);
      await persist(merged);
      const added = merged.length - records.length;
      setImportedVault(null);
      notify(
        `${added} ${added === 1 ? "registro importado" : "registros importados"}.`,
      );
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    } finally {
      setBusy(false);
    }
  }

  async function changeMaster(passphrase: string, confirmation: string) {
    if (passphrase.length < 6) {
      notify("Use pelo menos 6 caracteres.", undefined, true);
      return;
    }
    if (passphrase !== confirmation) {
      notify("As senhas não são iguais.", undefined, true);
      return;
    }
    try {
      const sealed = await changePassphrase(records, passphrase);
      writeStoredVault(sealed);
      setPassphraseMode(null);
      notify("Senha mestra trocada.");
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    }
  }

  function renderGate() {
    if (status === "loading")
      return (
        <div className="vault-gate">
          <span className="empty-symbol">
            <Lock size={22} />
          </span>
          <h3>Preparando o cofre…</h3>
        </div>
      );

    if (status === "setup")
      return (
        <div className="vault-gate">
          <span className="empty-symbol">
            <Lock size={22} />
          </span>
          <h3>Crie seu cofre</h3>
          <p>
            O cofre guarda senhas de sites e chaves de API criptografadas
            (AES-GCM) neste navegador. A senha mestra nunca é guardada: se você
            esquecer, não existe como recuperar.
          </p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => setPassphraseMode("create")}
          >
            <KeyRound size={17} />
            Criar cofre
          </button>
        </div>
      );

    return (
      <div className="vault-gate">
        <span className="empty-symbol">
          <Lock size={22} />
        </span>
        <h3>Cofre bloqueado</h3>
        <p>Digite a senha mestra para abrir os registros.</p>
        <form
          className="vault-unlock-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleUnlock(unlockValue);
          }}
        >
          <input
            id="vault-unlock"
            type="password"
            autoComplete="off"
            placeholder="Senha mestra"
            aria-label="Senha mestra"
            value={unlockValue}
            onChange={(event) => setUnlockValue(event.target.value)}
          />
          <button className="button primary" type="submit" disabled={busy}>
            Abrir cofre
          </button>
        </form>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  function renderRow(record: VaultRecord) {
    const isVisible = revealed.includes(record.id);
    return (
      <li key={record.id} className="vault-row">
        <span className="vault-mark" aria-hidden="true">
          {record.title.charAt(0).toUpperCase()}
        </span>
        <div className="vault-row-main">
          <strong>{record.title}</strong>
          <span className="vault-row-meta">
            {record.url
              ? vaultDomain(record.url)
              : record.username || "sem endereço"}
            {record.username && record.url ? ` · ${record.username}` : ""}
          </span>
          {record.notes && <span className="vault-row-notes">{record.notes}</span>}
        </div>
        <div className="vault-secret">
          <code>{isVisible ? record.secret : maskSecret(record.secret)}</code>
          <button
            className="icon-button small"
            aria-label={isVisible ? "Ocultar segredo" : "Mostrar segredo"}
            title={isVisible ? "Ocultar segredo" : "Mostrar segredo"}
            onClick={() =>
              setRevealed((current) =>
                current.includes(record.id)
                  ? current.filter((id) => id !== record.id)
                  : [...current, record.id],
              )
            }
          >
            {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button
            className="icon-button small"
            aria-label="Copiar segredo"
            title="Copiar segredo"
            onClick={() => void copySecret(record)}
          >
            <Copy size={16} />
          </button>
        </div>
        <div className="vault-row-actions">
          <button
            className={`favorite-button ${record.favorite ? "is-favorite" : ""}`}
            aria-label={
              record.favorite
                ? "Remover dos importantes"
                : "Marcar como importante"
            }
            title={
              record.favorite
                ? "Remover dos importantes"
                : "Marcar como importante"
            }
            onClick={() => void handleFavorite(record)}
          >
            <Star size={16} />
          </button>
          <button
            className="icon-button small"
            aria-label={`Editar ${record.title}`}
            title="Editar"
            onClick={() =>
              setDialog({
                open: true,
                kind: record.kind,
                recordId: record.id,
                draft: {
                  title: record.title,
                  url: record.url,
                  username: record.username,
                  secret: record.secret,
                  notes: record.notes,
                  providerId: record.providerId,
                },
              })
            }
          >
            <Pencil size={16} />
          </button>
          <button
            className="icon-button small"
            aria-label={`Remover ${record.title}`}
            title="Remover"
            onClick={() => void handleRemove(record)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </li>
    );
  }

  return (
    <section className="vault-panel">
      <motion.div
        className="page-heading"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <div className="eyebrow">
            {isProviders ? "CHAVES DE IA" : "SEU COFRE"}
          </div>
          <h1>
            {isProviders ? (
              <>
                Chaves de API.
                <br />
                <span>Organizadas por provedor.</span>
              </>
            ) : (
              <>
                Suas senhas.
                <br />
                <span>Guardadas com cuidado.</span>
              </>
            )}
          </h1>
          <p>
            {isProviders
              ? "Um catálogo de provedores gratuitos e as chaves que você já guardou."
              : "Credenciais de sites guardadas criptografadas neste navegador."}
          </p>
        </div>
        {status === "unlocked" && (
          <button
            className="button primary add-top"
            onClick={() => setDialog({ open: true, kind })}
          >
            <Plus size={18} />
            {isProviders ? "Guardar chave" : "Nova credencial"}
          </button>
        )}
      </motion.div>

      {status !== "unlocked" ? (
        renderGate()
      ) : (
        <>
          <div className="workspace-overview" aria-label="Resumo do cofre">
            <span>
              <ShieldCheck size={15} />
              <strong>{records.length}</strong> registros guardados
            </span>
            <span>
              <Lock size={15} />
              <strong>criptografado</strong> neste navegador
            </span>
            <span className="overview-note">
              <span /> A senha mestra não sai daqui
            </span>
          </div>

          <div className="vault-toolbar">
            <div className="search-field vault-search">
              <Search size={16} />
              <input
                type="search"
                placeholder={
                  isProviders
                    ? "Buscar chave guardada..."
                    : "Buscar credencial..."
                }
                aria-label={
                  isProviders ? "Buscar chave guardada" : "Buscar credencial"
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="vault-toolbar-actions">
              <button
                type="button"
                className="button secondary"
                onClick={exportVault}
              >
                <ArrowDownToLine size={16} />
                Exportar
              </button>
              <label className="button secondary vault-import">
                <ArrowUpFromLine size={16} />
                Importar
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    void pickImport(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                className="button secondary"
                onClick={() => setPassphraseMode("change")}
              >
                <KeyRound size={16} />
                Trocar senha
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={handleLock}
              >
                <Lock size={16} />
                Bloquear
              </button>
            </div>
          </div>

          {isProviders && (
            <ProviderCatalog
              stored={records.filter((record) => record.kind === "api")}
              onSave={(provider) => {
                const existing = records.find(
                  (record) => record.providerId === provider.id,
                );
                if (existing)
                  setDialog({
                    open: true,
                    kind: "api",
                    draft: {
                      title: existing.title,
                      url: existing.url,
                      username: existing.username,
                      secret: existing.secret,
                      notes: existing.notes,
                      providerId: existing.providerId,
                    },
                  });
                else setDialog({ open: true, kind: "api", provider });
              }}
            />
          )}

          <section
            className="vault-list-section"
            aria-labelledby="vault-list-title"
          >
            <div className="collection-heading">
              <div>
                <h2 id="vault-list-title">
                  {isProviders ? "Minhas chaves" : "Credenciais"}
                  <span className="count-badge">{visible.length}</span>
                </h2>
                <p>
                  {isProviders
                    ? "Chaves guardadas neste navegador, criptografadas."
                    : "Sites guardados neste navegador, com usuário e senha."}
                </p>
              </div>
            </div>
            {visible.length ? (
              <ul className="vault-list">{visible.map(renderRow)}</ul>
            ) : (
              <div className="empty-state">
                <span className="empty-symbol">
                  {isProviders ? <Bot size={22} /> : <Globe size={22} />}
                </span>
                <h3>
                  {query
                    ? "Nada encontrado por aqui"
                    : isProviders
                      ? "Nenhuma chave guardada"
                      : "Nenhuma credencial guardada"}
                </h3>
                <p>
                  {query
                    ? "Tente outro termo de busca."
                    : isProviders
                      ? "Escolha um provedor na lista acima ou guarde uma chave do seu jeito."
                      : "Guarde o usuário e a senha dos sites que você usa."}
                </p>
                <button
                  className="button primary"
                  onClick={() => setDialog({ open: true, kind })}
                >
                  <Plus size={17} />
                  {isProviders ? "Guardar chave" : "Nova credencial"}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <RecordDialog
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open, kind })}
        kind={dialog.kind}
        initial={dialog.draft}
        providerName={dialog.provider?.name}
        providerUrl={dialog.provider?.consoleUrl}
        providerId={dialog.provider?.id}
        onSubmit={(draft) => void handleSave(draft)}
      />

      <PassphraseDialog
        open={passphraseMode === "create"}
        onOpenChange={(open) => !open && setPassphraseMode(null)}
        title="Criar cofre"
        description="Escolha uma senha mestra. Ela não é guardada em lugar nenhum."
        submitLabel="Criar e abrir"
        withConfirmation
        onSubmit={(passphrase, confirmation) =>
          void handleCreate(passphrase, confirmation)
        }
      />

      <PassphraseDialog
        open={passphraseMode === "change"}
        onOpenChange={(open) => !open && setPassphraseMode(null)}
        title="Trocar senha mestra"
        description="O cofre será re-criptografado com a nova senha."
        submitLabel="Trocar senha"
        withConfirmation
        onSubmit={(passphrase, confirmation) =>
          void changeMaster(passphrase, confirmation)
        }
      />

      <PassphraseDialog
        open={Boolean(importedVault)}
        onOpenChange={(open) => !open && setImportedVault(null)}
        title="Importar cofre"
        description="Digite a senha mestra do arquivo importado para mesclar os registros."
        submitLabel="Importar"
        onSubmit={(passphrase) => void importWithPassphrase(passphrase)}
      />

      <div
        className="toast-region"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {notice && (
          <div className={`app-toast ${notice.error ? "toast-error" : ""}`}>
            <span className="toast-symbol">
              <ShieldCheck size={17} />
            </span>
            <span>{notice.message}</span>
            {notice.undo && <button onClick={notice.undo}>Desfazer</button>}
            <button
              className="icon-button"
              aria-label="Dispensar mensagem"
              onClick={() => setNotice(null)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function ProviderCatalog({
  stored,
  onSave,
}: {
  stored: VaultRecord[];
  onSave: (provider: AiProvider) => void;
}) {
  const [search, setSearch] = React.useState("");
  const list = AI_PROVIDERS.filter((provider) =>
    `${provider.name} ${provider.freeTier}`
      .toLocaleLowerCase("pt-BR")
      .includes(search.trim().toLocaleLowerCase("pt-BR")),
  );

  return (
    <section className="provider-section" aria-labelledby="providers-title">
      <div className="collection-heading">
        <div>
          <h2 id="providers-title">
            Provedores de IA com plano gratuito
            <span className="count-badge">{AI_PROVIDERS.length}</span>
          </h2>
          <p>
            Ponto de partida para guardar suas chaves. As cotas mudam com
            frequência: confirme os limites no painel de cada provedor.
          </p>
        </div>
      </div>
      <div className="search-field vault-search">
        <Search size={16} />
        <input
          type="search"
          placeholder="Buscar provedor..."
          aria-label="Buscar provedor"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="provider-grid">
        {list.map((provider) => {
          const saved = stored.find(
            (record) => record.providerId === provider.id,
          );
          return (
            <article key={provider.id} className="provider-card">
              <div className="provider-head">
                <span className="provider-mark" aria-hidden="true">
                  {provider.name.charAt(0)}
                </span>
                <div>
                  <strong>{provider.name}</strong>
                  <span>{provider.freeTier}</span>
                </div>
              </div>
              <div className="provider-tags">
                <span className="vault-tag">
                  {provider.local ? "roda local" : "chave de API"}
                </span>
                {provider.cardRequired && (
                  <span className="vault-tag">pede cartão</span>
                )}
                {saved && <span className="vault-tag saved">chave guardada</span>}
              </div>
              <div className="provider-actions">
                <a
                  className="button secondary"
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir console
                  <ArrowUpRight size={14} />
                </a>
                <button
                  type="button"
                  className="button primary"
                  onClick={() => onSave(provider)}
                >
                  <Plus size={15} />
                  {saved ? "Trocar chave" : "Guardar chave"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
