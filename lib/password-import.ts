import { VAULT_MAX_RECORDS, vaultDomain, type VaultRecord } from "./vault.ts";

/**
 * Importer for the password exports people actually have: Chrome, Edge and
 * Google Password Manager (same CSV), LastPass, Bitwarden (CSV and JSON),
 * 1Password CSV, a Multiapp vault backup and any generic table/JSON with
 * url + username + password. Parsing happens locally; nothing leaves the tab.
 */

export type ImportSource =
  | "chrome"
  | "lastpass"
  | "bitwarden"
  | "1password"
  | "multiapp"
  | "generic";

export type ImportResult = {
  source: ImportSource;
  /** Valid, de-duplicated site credentials ready for the vault. */
  records: VaultRecord[];
  /** Candidate rows/items found in the file. */
  total: number;
  skippedInvalid: number;
  skippedDuplicates: number;
  /** Rows that did not fit in the vault. */
  limited: number;
  /** Human readable reasons for discarded rows (never contains secrets). */
  reasons: string[];
  sample: Array<{ title: string; host: string; username: string }>;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export function assertImportSize(size: number): void {
  if (size > MAX_FILE_BYTES)
    throw new ImportError("O arquivo passa de 5 MB. Exporte só as senhas.");
}

/** RFC 4180-ish CSV: quotes, escaped quotes, newlines inside quotes, BOM. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  let delimiter = ",";
  const firstLine = input.split(/\r?\n/, 1)[0] ?? "";
  for (const candidate of [",", ";", "\t"]) {
    if (firstLine.includes(candidate)) {
      delimiter = candidate;
      break;
    }
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

const URL_KEYS = ["url", "loginuri", "loginurl", "website", "site", "uri", "endereco", "link"];
const USER_KEYS = ["username", "loginusername", "login", "user", "usuario", "email", "conta"];
const PASSWORD_KEYS = ["password", "loginpassword", "pass", "senha", "pwd"];
const TITLE_KEYS = ["name", "title", "nome", "titulo", "account", "servico"];
const NOTES_KEYS = ["note", "notes", "extra", "nota", "notas", "comentario", "observacoes"];
const FAVORITE_KEYS = ["fav", "favorite", "favorito"];
const FOLDER_KEYS = ["grouping", "folder", "pasta", "grupo", "categoria"];

function cleanHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function normalizeUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) {
    if (!/^https?:/i.test(value)) return null;
    try {
      const url = new URL(value);
      if (url.username || url.password) return null;
      if (!url.hostname) return null;
      return url.href;
    } catch {
      return null;
    }
  }
  if (/\s/.test(value)) return null;
  if (!value.includes(".") && !value.includes(":")) return null;
  try {
    return new URL(`https://${value}`).href;
  } catch {
    return null;
  }
}

function titleFromUrl(url: string): string {
  const host = vaultDomain(url);
  const label = host.split(".")[0] || host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildRecord(input: {
  title?: string;
  url: string;
  username?: string;
  password: string;
  notes?: string;
  favorite?: boolean;
}): VaultRecord | null {
  const url = normalizeUrl(input.url);
  if (!url) return null;
  const secret = (input.password ?? "").slice(0, 4096);
  if (!secret) return null;
  const username = (input.username ?? "").trim().slice(0, 120);
  const title = (input.title ?? "").trim().slice(0, 80) || titleFromUrl(url);
  const timestamp = Date.now();
  return {
    id: crypto.randomUUID(),
    kind: "site",
    title,
    url,
    username,
    secret,
    notes: (input.notes ?? "").trim().slice(0, 2000),
    providerId: "",
    favorite: Boolean(input.favorite),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

type Candidate = {
  title?: string;
  url: string;
  username?: string;
  password: string;
  notes?: string;
  favorite?: boolean;
};

function asBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "sim", "favorito"].includes(value.trim().toLowerCase());
}

function withFolder(notes: string | undefined, folder: string | undefined): string {
  const parts = [notes?.trim(), folder?.trim() ? `Pasta: ${folder.trim()}` : ""];
  return parts.filter(Boolean).join(" · ").slice(0, 2000);
}

function detectCsvSource(headers: string[]): ImportSource {
  const has = (key: string) => headers.includes(key);
  if (has("grouping") && (has("extra") || has("fav"))) return "lastpass";
  if (has("loginuri") || has("loginusername") || has("loginpassword")) return "bitwarden";
  if (has("otpauth") || (has("title") && has("username"))) return "1password";
  if (has("name") && has("url") && has("username") && has("password")) return "chrome";
  return "generic";
}

function candidatesFromRows(rows: string[][]): {
  candidates: Candidate[];
  source: ImportSource;
} {
  if (!rows.length) return { candidates: [], source: "generic" };
  const headerCells = rows[0].map(cleanHeader);
  const known = new Set([
    ...URL_KEYS,
    ...USER_KEYS,
    ...PASSWORD_KEYS,
    ...TITLE_KEYS,
    ...NOTES_KEYS,
    ...FAVORITE_KEYS,
    ...FOLDER_KEYS,
  ]);
  const hasHeader = headerCells.some((cell) => known.has(cell));

  if (!hasHeader) {
    // No header: Chrome/Edge order is name,url,username,password,note.
    const candidates = rows
      .map((cells) => ({
        title: cells[0],
        url: cells[1] ?? "",
        username: cells[2],
        password: cells[3] ?? "",
        notes: cells[4],
      }))
      .filter((candidate) => candidate.url.trim() !== "");
    return { candidates, source: "chrome" };
  }

  const index: Record<string, number> = {};
  headerCells.forEach((cell, position) => {
    if (!(cell in index)) index[cell] = position;
  });
  const column = (keys: string[]): number | undefined => {
    for (const key of keys) if (key in index) return index[key];
    return undefined;
  };
  const urlAt = column(URL_KEYS);
  const userAt = column(USER_KEYS);
  const passwordAt = column(PASSWORD_KEYS);
  const titleAt = column(TITLE_KEYS);
  const notesAt = column(NOTES_KEYS);
  const favoriteAt = column(FAVORITE_KEYS);
  const folderAt = column(FOLDER_KEYS);

  const candidates: Candidate[] = [];
  for (const cells of rows.slice(1)) {
    if (!cells.some((cell) => cell.trim() !== "")) continue;
    const cell = (position: number | undefined) =>
      position === undefined ? undefined : cells[position];
    candidates.push({
      title: cell(titleAt),
      url: cell(urlAt) ?? "",
      username: cell(userAt),
      password: cell(passwordAt) ?? "",
      notes: withFolder(cell(notesAt), cell(folderAt)),
      favorite: asBoolean(cell(favoriteAt)),
    });
  }
  return { candidates, source: detectCsvSource(headerCells) };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function flatKeys(source: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) flat[cleanHeader(key)] = value;
  return flat;
}

function candidatesFromJson(raw: unknown): {
  candidates: Candidate[];
  source: ImportSource;
  extra?: { invalid?: number; reasons?: string[] };
} {
  const candidates: Candidate[] = [];

  const pushItem = (item: unknown, source: ImportSource) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if (source === "multiapp") {
      if (record.kind === "api") return;
      candidates.push({
        title: stringValue(record.title),
        url: stringValue(record.url) ?? "",
        username: stringValue(record.username),
        password: stringValue(record.secret) ?? "",
        notes: stringValue(record.notes),
        favorite: Boolean(record.favorite),
      });
      return;
    }
    const login = (record.login ?? {}) as Record<string, unknown>;
    const uris = Array.isArray(login.uris) ? login.uris : [];
    const firstUri = uris[0] as { uri?: unknown } | undefined;
    const url =
      stringValue(login.uri) ??
      stringValue(firstUri?.uri) ??
      stringValue(record.url) ??
      stringValue(record.uri) ??
      "";
    candidates.push({
      title: stringValue(record.name) ?? stringValue(record.title),
      url,
      username:
        stringValue(login.username) ??
        stringValue(record.username) ??
        stringValue(record.login_username),
      password:
        stringValue(login.password) ??
        stringValue(record.password) ??
        stringValue(record.login_password) ??
        "",
      notes: stringValue(record.notes) ?? stringValue(record.note),
      favorite: Boolean(record.favorite),
    });
  };

  if (Array.isArray(raw)) {
    const source: ImportSource = raw.some(
      (item) => item && typeof item === "object" && "login" in (item as object),
    )
      ? "bitwarden"
      : "generic";
    for (const item of raw) pushItem(item, source);
    return { candidates, source };
  }

  if (!raw || typeof raw !== "object")
    throw new ImportError("JSON não reconhecido. Use um arquivo de senhas do navegador ou do Bitwarden.");

  const object = raw as Record<string, unknown>;
  if (object.encrypted === true)
    throw new ImportError(
      "Este JSON está criptografado. No Bitwarden, exporte em .json sem senha ou use o .csv.",
    );
  if (Array.isArray(object.records)) {
    for (const item of object.records) pushItem(item, "multiapp");
    return { candidates, source: "multiapp" };
  }
  if (Array.isArray(object.items)) {
    let notLogin = 0;
    for (const item of object.items) {
      const type = (item as { type?: unknown })?.type;
      if (typeof type === "number" && type !== 1) {
        notLogin += 1;
        continue;
      }
      pushItem(item, "bitwarden");
    }
    return {
      candidates,
      source: "bitwarden",
      extra: {
        invalid: notLogin,
        reasons: notLogin
          ? ["itens que não são login (notas, cartões, identidades)"]
          : [],
      },
    };
  }
  // A single object with url/username/password.
  const flat = flatKeys(object);
  const url =
    stringValue(flat.url) ?? stringValue(flat.loginuri) ?? stringValue(flat.website);
  if (url) {
    pushItem(object, "generic");
    return { candidates, source: "generic" };
  }
  throw new ImportError(
    "JSON sem lista de senhas. Esperado um array ou um objeto com items/records.",
  );
}

function collect(
  candidates: Candidate[],
  source: ImportSource,
  extra?: { invalid?: number; reasons?: string[] },
): ImportResult {
  const records: VaultRecord[] = [];
  const seen = new Set<string>();
  const reasons = new Set<string>(extra?.reasons ?? []);
  let skippedInvalid = extra?.invalid ?? 0;
  let skippedDuplicates = 0;
  let limited = 0;

  for (const candidate of candidates) {
    const record = buildRecord(candidate);
    if (!record) {
      skippedInvalid += 1;
      if (!candidate.url?.trim()) reasons.add("linhas sem endereço");
      else if (!candidate.password) reasons.add("linhas sem senha");
      else reasons.add("endereços fora de http/https (apps, chrome://)");
      continue;
    }
    const key = `${vaultDomain(record.url)}|${record.username.toLowerCase()}|${record.secret}`;
    if (seen.has(key)) {
      skippedDuplicates += 1;
      continue;
    }
    if (records.length >= VAULT_MAX_RECORDS) {
      limited += 1;
      continue;
    }
    seen.add(key);
    records.push(record);
  }

  return {
    source,
    records,
    total: candidates.length,
    skippedInvalid,
    skippedDuplicates,
    limited,
    reasons: [...reasons],
    sample: records.slice(0, 5).map((record) => ({
      title: record.title,
      host: vaultDomain(record.url),
      username: record.username,
    })),
  };
}

/** Detects CSV or JSON, maps the columns/keys and returns a preview. */
export function parsePasswordFile(text: string, fileName = ""): ImportResult {
  if (!text.trim()) throw new ImportError("O arquivo está vazio.");
  if (text.length > MAX_FILE_BYTES)
    throw new ImportError("O conteúdo passa de 5 MB. Exporte só as senhas.");

  const body = text.replace(/^\uFEFF/, "");
  const looksJson = /^\s*[[{]/.test(body) || /\.json$/i.test(fileName);

  if (looksJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new ImportError(
        "JSON inválido. Use o arquivo original exportado pelo gerenciador de senhas.",
      );
    }
    const { candidates, source, extra } = candidatesFromJson(parsed);
    if (!candidates.length)
      throw new ImportError("Nenhuma senha de site encontrada neste JSON.");
    const result = collect(candidates, source, extra);
    if (!result.records.length) {
      const detail = result.reasons.length ? ` (${result.reasons.join("; ")})` : "";
      throw new ImportError(`Nenhuma senha de site válida neste JSON${detail}.`);
    }
    return result;
  }

  const rows = parseCsv(body);
  if (!rows.length)
    throw new ImportError("Nenhuma linha encontrada no CSV.");
  const { candidates, source } = candidatesFromRows(rows);
  if (!candidates.length)
    throw new ImportError(
      "Nenhuma linha com endereço e senha. Use o CSV exportado pelo navegador (Chrome, Edge, Google, LastPass, Bitwarden ou 1Password).",
    );
  const result = collect(candidates, source);
  if (!result.records.length) {
    const detail = result.reasons.length ? ` (${result.reasons.join("; ")})` : "";
    throw new ImportError(`Nenhuma senha de site válida no arquivo${detail}.`);
  }
  return result;
}

/** Adds the imported records that the vault does not have yet. */
export function mergeImportedRecords(
  existing: VaultRecord[],
  imported: VaultRecord[],
): { records: VaultRecord[]; added: number; duplicates: number; limited: number } {
  const key = (record: VaultRecord) =>
    `${vaultDomain(record.url)}|${record.username.trim().toLowerCase()}`;
  const known = new Set(existing.map(key));
  const records = [...existing];
  let added = 0;
  let duplicates = 0;
  let limited = 0;

  for (const record of imported) {
    const recordKey = key(record);
    if (known.has(recordKey)) {
      duplicates += 1;
      continue;
    }
    if (records.length >= VAULT_MAX_RECORDS) {
      limited += 1;
      continue;
    }
    known.add(recordKey);
    records.push(record);
    added += 1;
  }

  return { records, added, duplicates, limited };
}

export function describeSource(source: ImportSource): string {
  switch (source) {
    case "chrome":
      return "Chrome, Edge ou Google";
    case "lastpass":
      return "LastPass";
    case "bitwarden":
      return "Bitwarden";
    case "1password":
      return "1Password";
    case "multiapp":
      return "Backup do Multiapp";
    default:
      return "Lista genérica";
  }
}
