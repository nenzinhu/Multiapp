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
  Upload,
} from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAutoAnimate } from "@formkit/auto-animate/react";

import { Counter } from "@/components/counter";
import { ImportPasswordsDialog } from "@/components/vault/import-dialog";
import { RecordDialog, type RecordDraft } from "@/components/vault/record-dialog";
import { pullVault, pushVault } from "@/lib/account";
import { AI_PROVIDERS, type AiProvider } from "@/lib/ai-providers";
import { mergeImportedRecords } from "@/lib/password-import";
import { entrance, pop, shake } from "@/lib/animations";
import {
  changePassphrase,
  createVault,
  lockVault,
  maskSecret,
  mergeVaultRecords,
  readStoredVault,
  rememberVaultRecords,
  stashConflictingVault,
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
  const [importOpen, setImportOpen] = React.useState(false);
  const [adoptedRemote, setAdoptedRemote] = React.useState(false);
  const [syncState, setSyncState] = React.useState<
    "loading" | "synced" | "saving" | "offline"
  >("loading");
  const revisionRef = React.useRef(0);
  const [vaultListRef] = useAutoAnimate<HTMLUListElement>({
    duration: 240,
    easing: "ease-out",
  });
  const gateRef = React.useRef<HTMLDivElement | null>(null);
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

  // Reconcile the local envelope with the account copy. Only sealed data
  // travels; adopting a newer remote copy is what makes a new device work.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const remote = await pullVault();
        if (cancelled) return;
        revisionRef.current = remote.revision;
        const local = readStoredVault();
        if (!remote.vault) {
          if (local) await pushSealed(local);
          else setSyncState("synced");
          setStatus(readStoredVault() ? "locked" : "setup");
          return;
        }
        if (!local || remote.vault.updatedAt > local.updatedAt) {
          writeStoredVault(remote.vault);
          setStatus("locked");
          setRecords([]);
          setAdoptedRemote(true);
          if (local && local.salt !== remote.vault.salt)
            notify(
              "O cofre da sua conta veio de outro aparelho. Desbloqueie com a senha mestra usada lá.",
              undefined,
              true,
            );
          else if (local) notify("O cofre da sua conta é mais recente e foi atualizado aqui.");
          setSyncState("synced");
          return;
        }
        if (local.updatedAt > remote.vault.updatedAt) {
          if (local.salt !== remote.vault.salt) {
            // Different master passphrase on this device: never overwrite the
            // account copy, keep the local envelope for recovery.
            stashConflictingVault(local);
            writeStoredVault(remote.vault);
            setStatus("locked");
            setAdoptedRemote(true);
            setSyncState("synced");
            notify(
              "Este aparelho tinha um cofre com outra senha mestra. Abrimos o da conta e guardamos o local para recuperação.",
              undefined,
              true,
            );
            return;
          }
          await pushSealed(local);
          setStatus("locked");
          return;
        }
        setSyncState("synced");
        setStatus("locked");
      } catch {
        if (cancelled) return;
        setSyncState("offline");
        setStatus(readStoredVault() ? "locked" : "setup");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (error) shake(gateRef.current);
  }, [error]);

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

  async function pushSealed(sealed: StoredVault): Promise<void> {
    setSyncState("saving");
    try {
      const result = await pushVault(sealed, revisionRef.current);
      if (result.ok) {
        revisionRef.current = result.revision;
        setSyncState("synced");
        return;
      }
      revisionRef.current = result.revision;
      if (result.vault && result.vault.updatedAt > sealed.updatedAt) {
        // Another device wrote a newer copy: adopt it instead of overwriting.
        writeStoredVault(result.vault);
        setStatus("locked");
        setRecords([]);
        lockVault();
        notify(
          "O cofre de outro aparelho é mais recente. Desbloqueie com a senha mestra para vê-lo.",
          undefined,
          true,
        );
        setSyncState("synced");
        return;
      }
      const retry = await pushVault(sealed, result.revision);
      if (retry.ok) revisionRef.current = retry.revision;
      setSyncState("synced");
    } catch {
      setSyncState("offline");
    }
  }

  async function persist(next: VaultRecord[]) {
    const sealed = await sealRecords(next);
    writeStoredVault(sealed);
    setRecords(next);
    rememberVaultRecords(next);
    await pushSealed(sealed);
  }

  async function handleImport(imported: VaultRecord[]) {
    try {
      const merged = mergeImportedRecords(records, imported);
      await persist(merged.records);
      setImportOpen(false);
      notify(
        `${merged.added} ${
          merged.added === 1 ? "credencial importada" : "credenciais importadas"
        }${merged.duplicates ? `, ${merged.duplicates} já existiam` : ""}.`,
      );
    } catch (caught) {
      notify(
        (caught as Error).message ||
          "Não foi possível salvar as credenciais importadas.",
        undefined,
        true,
      );
    }
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
      rememberVaultRecords([]);
      await pushSealed(stored);
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
      rememberVaultRecords(data.records);
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
      await pushSealed(sealed);
      setPassphraseMode(null);
      notify("Senha mestra trocada.");
    } catch (caught) {
      notify((caught as Error).message, undefined, true);
    }
  }

  function renderGate() {
    if (status === "loading")
      return (
        <div className="vault-gate" ref={gateRef}>
          <span className="empty-symbol">
            <Lock size={22} />
          </span>
          <h3>Preparando o cofre…</h3>
        </div>
      );

    if (status === "setup")
      return (
        <div className="vault-gate" ref={gateRef}>
          <span className="empty-symbol">
            <Lock size={22} />
          </span>
          <h3>Crie seu cofre</h3>
          <p>
            O cofre guarda senhas de sites e chaves de API com AES-GCM e sobe
            para a sua conta apenas como ciphertext. A senha mestra nunca é
            guardada: se você esquecer, não existe como recuperar.
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
      <div className="vault-gate" ref={gateRef}>
        <span className="empty-symbol">
          <Lock size={22} />
        </span>
        <h3>Cofre bloqueado</h3>
        <p>
          {adoptedRemote
            ? "Este cofre veio da sua conta: use a senha mestra que você usa nos outros aparelhos."
            : "Digite a senha mestra para abrir os registros."}
        </p>
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
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
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
            onClick={(event) => {
                pop(event.currentTarget);
                void handleFavorite(record);
              }}
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
                Chaves de IA<span>.</span>
              </>
            ) : (
              <>
                Suas senhas<span>.</span>
              </>
            )}
          </h1>
          <p>
            {isProviders
              ? "Um catálogo de provedores gratuitos e as chaves que você já guardou."
              : "Credenciais de sites criptografadas neste navegador e na sua conta."}
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
              <strong>
                <Counter value={records.length} id="vault-records" />
                <span className="sr-only">{records.length}</span>
              </strong> registros guardados
            </span>
            <span>
              <Lock size={15} />
              <strong>criptografado</strong> de ponta a ponta
            </span>
            <span className="overview-note">
              <span />
              {syncState === "loading"
                ? "Verificando a sua conta…"
                : syncState === "saving"
                  ? "Salvando na sua conta…"
                  : syncState === "offline"
                    ? "Só neste aparelho — sem conexão"
                    : "Criptografado e sincronizado"}
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
              {!isProviders && (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setImportOpen(true)}
                >
                  <Upload size={16} />
                  Importar senhas
                </button>
              )}
              <label
                className="button secondary vault-import"
                title="Importar um backup criptografado do cofre (.json)"
              >
                <ArrowUpFromLine size={16} />
                Backup
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
              <ul className="vault-list" ref={vaultListRef}>{visible.map(renderRow)}</ul>
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

      <ImportPasswordsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existing={records}
        onSubmit={(imported) => void handleImport(imported)}
      />

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
  const gridRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const cards = gridRef.current?.querySelectorAll(".provider-card");
    if (cards?.length) entrance(cards);
  }, [search]);

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
      <div className="provider-grid" ref={gridRef}>
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
