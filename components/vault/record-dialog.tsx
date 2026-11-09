"use client";

import * as React from "react";
import { Check, Eye, EyeOff } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type RecordDraft = {
  title: string;
  url: string;
  username: string;
  secret: string;
  notes: string;
  providerId: string;
};

export const EMPTY_DRAFT: RecordDraft = {
  title: "",
  url: "",
  username: "",
  secret: "",
  notes: "",
  providerId: "",
};

type RecordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "site" | "api";
  initial?: RecordDraft;
  /** Catalog entry used to prefill the form. */
  providerName?: string;
  providerUrl?: string;
  providerId?: string;
  onSubmit: (draft: RecordDraft) => void;
};

function isSafeUrl(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function RecordDialog({
  open,
  onOpenChange,
  kind,
  initial,
  providerName,
  providerUrl,
  providerId,
  onSubmit,
}: RecordDialogProps) {
  const [draft, setDraft] = React.useState<RecordDraft>(initial ?? EMPTY_DRAFT);
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setDraft(
      initial ??
        (providerName
          ? {
              ...EMPTY_DRAFT,
              title: providerName,
              url: providerUrl ?? "",
              providerId: providerId ?? "",
            }
          : EMPTY_DRAFT),
    );
    setVisible(false);
    setError("");
  }, [open, initial, providerName, providerUrl, providerId]);

  const editing = Boolean(initial);
  const title =
    kind === "api"
      ? editing
        ? "Editar chave de API"
        : "Guardar chave de API"
      : editing
        ? "Editar credencial"
        : "Nova credencial";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) {
      setError(
        kind === "api" ? "Diga qual é o provedor." : "Dê um nome ao site.",
      );
      return;
    }
    if (kind === "api" && !draft.secret.trim()) {
      setError("Cole a chave da API para guardar.");
      return;
    }
    if (!isSafeUrl(draft.url)) {
      setError("Use um endereço http ou https.");
      return;
    }
    setError("");
    onSubmit(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog" showCloseButton={false}>
        <div className="dialog-heading">
          <div>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {kind === "api"
                ? "A chave fica criptografada no cofre deste navegador."
                : "Senha e usuário ficam criptografados no cofre deste navegador."}
            </DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Fechar">
            <EyeOff size={20} />
          </DialogClose>
        </div>
        <form noValidate onSubmit={submit} className="editor-form">
          <div className="field">
            <label htmlFor="vault-title">
              {kind === "api" ? "Provedor" : "Site"}
            </label>
            <input
              id="vault-title"
              autoFocus
              type="text"
              autoComplete="off"
              maxLength={80}
              placeholder={kind === "api" ? "Ex.: Groq" : "Ex.: Banco do trabalho"}
              value={draft.title}
              onChange={(event) => {
                setDraft({ ...draft, title: event.target.value });
                setError("");
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="vault-url">
              {kind === "api" ? "Painel ou documentação" : "Endereço do site"}
            </label>
            <input
              id="vault-url"
              type="text"
              inputMode="url"
              autoComplete="off"
              maxLength={2048}
              placeholder="https://exemplo.com"
              value={draft.url}
              onChange={(event) => {
                setDraft({ ...draft, url: event.target.value });
                setError("");
              }}
            />
          </div>
          {kind === "site" && (
            <div className="field">
              <label htmlFor="vault-username">Usuário ou e-mail</label>
              <input
                id="vault-username"
                type="text"
                autoComplete="off"
                maxLength={120}
                placeholder="voce@exemplo.com"
                value={draft.username}
                onChange={(event) =>
                  setDraft({ ...draft, username: event.target.value })
                }
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="vault-secret">
              {kind === "api" ? "Chave da API" : "Senha"}
            </label>
            <div className="secret-input">
              <input
                id="vault-secret"
                type={visible ? "text" : "password"}
                autoComplete="off"
                maxLength={4096}
                placeholder={kind === "api" ? "sk-…" : "••••••••"}
                value={draft.secret}
                onChange={(event) => {
                  setDraft({ ...draft, secret: event.target.value });
                  setError("");
                }}
              />
              <button
                type="button"
                className="icon-button small"
                aria-label={visible ? "Ocultar segredo" : "Mostrar segredo"}
                title={visible ? "Ocultar segredo" : "Mostrar segredo"}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="vault-notes">Observações</label>
            <textarea
              id="vault-notes"
              rows={3}
              maxLength={2000}
              placeholder="Plano, fluxo de uso, link do painel…"
              value={draft.notes}
              onChange={(event) =>
                setDraft({ ...draft, notes: event.target.value })
              }
            />
          </div>
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
              <Check size={17} />
              {editing ? "Salvar alterações" : "Guardar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
