"use client";

import { FileUp, Upload, X } from "lucide-react";
import * as React from "react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ImportError,
  describeSource,
  mergeImportedRecords,
  parsePasswordFile,
  type ImportResult,
} from "@/lib/password-import";
import { VAULT_MAX_RECORDS, type VaultRecord } from "@/lib/vault";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Imports the CSV/JSON exports people already have. Parsing is local; the
 * preview never shows a password, only title, host and username.
 */
export function ImportPasswordsDialog({
  open,
  onOpenChange,
  existing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: VaultRecord[];
  onSubmit: (records: VaultRecord[]) => void;
}) {
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [pasted, setPasted] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) return;
    setResult(null);
    setFileName("");
    setPasted("");
    setError("");
    setBusy(false);
  }, [open]);

  const preview = React.useMemo(
    () => (result ? mergeImportedRecords(existing, result.records) : null),
    [existing, result],
  );

  function read(text: string, name: string) {
    try {
      setResult(parsePasswordFile(text, name));
      setError("");
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof ImportError
          ? caught.message
          : "Não foi possível ler o arquivo. Use o CSV ou o JSON original.",
      );
    }
  }

  async function fromFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      if (file.size > MAX_BYTES)
        throw new ImportError("O arquivo passa de 5 MB. Exporte só as senhas.");
      read(await file.text(), file.name);
    } catch (caught) {
      setResult(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível ler o arquivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  const overLimit =
    preview !== null && existing.length + preview.added > VAULT_MAX_RECORDS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="app-dialog" showCloseButton={false}>
        <div className="dialog-heading">
          <div>
            <DialogTitle>Importar senhas</DialogTitle>
            <DialogDescription>
              CSV do Chrome, Edge, Google, LastPass, Bitwarden e 1Password; JSON
              do Bitwarden ou do Multiapp. A leitura acontece neste navegador e o
              resultado é salvo criptografado.
            </DialogDescription>
          </div>
          <DialogClose className="icon-button" aria-label="Fechar">
            <X size={20} />
          </DialogClose>
        </div>
        <ImportBody
          busy={busy}
          error={error}
          fileName={fileName}
          onFile={(file) => void fromFile(file)}
          onPaste={(text) => read(text, "")}
          pasted={pasted}
          setPasted={setPasted}
          inputRef={inputRef}
          result={result}
          preview={preview}
          overLimit={overLimit}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => result && onSubmit(result.records)}
        />
      </DialogContent>
    </Dialog>
  );
}

function ImportBody({
  busy,
  error,
  fileName,
  onFile,
  onPaste,
  pasted,
  setPasted,
  inputRef,
  result,
  preview,
  overLimit,
  onCancel,
  onConfirm,
}: {
  busy: boolean;
  error: string;
  fileName: string;
  onFile: (file?: File) => void;
  onPaste: (text: string) => void;
  pasted: string;
  setPasted: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  result: ImportResult | null;
  preview: ReturnType<typeof mergeImportedRecords> | null;
  overLimit: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="import-drop">
        <FileUp size={20} aria-hidden="true" />
        <div>
          <strong>Escolher arquivo .csv ou .json</strong>
          <span>Até 5 MB · nada é enviado para o servidor</span>
        </div>
        <button
          type="button"
          className="button secondary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Lendo…" : "Selecionar"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="sr-only"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>

      <details className="import-paste">
        <summary>Colar o conteúdo do arquivo</summary>
        <textarea
          rows={5}
          placeholder={
            "name,url,username,password,note\nGitHub,https://github.com,nei,segredo,"
          }
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
        />
        <button
          type="button"
          className="button secondary"
          onClick={() => onPaste(pasted)}
        >
          Analisar texto
        </button>
      </details>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      {result && preview && (
        <div className="import-summary">
          <p className="import-source">
            <Upload size={14} aria-hidden="true" />
            {describeSource(result.source)} · {result.total}{" "}
            {result.total === 1 ? "linha lida" : "linhas lidas"}
            {fileName ? ` · ${fileName}` : ""}
          </p>
          <ul className="import-counts">
            <li data-kind="ok">
              <strong>{preview.added}</strong> prontas para importar
            </li>
            <li data-kind="dup">
              <strong>{result.skippedDuplicates + preview.duplicates}</strong>{" "}
              já existiam
            </li>
            <li data-kind="skip">
              <strong>{result.skippedInvalid}</strong> ignoradas
            </li>
          </ul>
          {result.reasons.length > 0 && (
            <p className="field-help">
              Ignoradas: {result.reasons.join("; ")}.
            </p>
          )}
          {result.sample.length > 0 && (
            <ul className="import-sample">
              {result.sample.map((item) => (
                <li key={`${item.host}-${item.username}`}>
                  <strong>{item.title}</strong>
                  <span>
                    {item.host}
                    {item.username ? ` · ${item.username}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {overLimit && (
            <p className="field-error">
              O cofre cabe {VAULT_MAX_RECORDS} registros. Importe em partes.
            </p>
          )}
          {result.limited > 0 && (
            <p className="field-error">
              {result.limited} credenciais ficaram de fora pelo limite do cofre.
            </p>
          )}
        </div>
      )}

      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="button primary"
          disabled={!preview || preview.added === 0 || overLimit}
          onClick={onConfirm}
        >
          {preview && preview.added > 0
            ? `Importar ${preview.added} ${
                preview.added === 1 ? "credencial" : "credenciais"
              }`
            : "Importar"}
        </button>
      </div>
    </>
  );
}
