export const VAULT_STORAGE_KEY = "multiapp.vault.v1";
export const VAULT_VERSION = 1;
export const VAULT_MAX_RECORDS = 5000;

export type VaultKind = "site" | "api";

export type VaultRecord = {
  id: string;
  kind: VaultKind;
  /** Site name or AI provider name. */
  title: string;
  /** Site address or provider console. */
  url: string;
  /** Login user for sites; empty for API keys. */
  username: string;
  /** Password or API key. */
  secret: string;
  notes: string;
  /** Catalog id when the record comes from the AI provider list. */
  providerId: string;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
};

export type VaultData = {
  version: 1;
  records: VaultRecord[];
};

/** Envelope kept in localStorage: only ciphertext and the KDF salt. */
export type StoredVault = {
  version: 1;
  salt: string;
  iv: string;
  data: string;
  updatedAt: number;
};

/**
 * The same phrase typed on a phone, a desktop or a different keyboard must
 * derive the same key: trim the accidental space mobile keyboards add and use
 * NFKC so composed/decomposed accents match.
 */
export function normalizePassphrase(value: string): string {
  return value.trim().normalize("NFKC");
}

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

let sessionKey: CryptoKey | null = null;
let sessionSalt: Uint8Array<ArrayBuffer> | null = null;

/**
 * Decrypted records for the current page session. They live only in memory,
 * never in storage: the library uses them to offer a one-click login for the
 * apps that already have a credential, and a lock wipes them.
 */
let sessionRecords: VaultRecord[] | null = null;
const sessionListeners = new Set<() => void>();

function emitVaultSession(): void {
  for (const listener of sessionListeners) listener();
}

export function rememberVaultRecords(records: VaultRecord[]): void {
  sessionRecords = records;
  emitVaultSession();
}

export function forgetVaultRecords(): void {
  if (!sessionRecords) return;
  sessionRecords = null;
  emitVaultSession();
}

export function getVaultRecords(): VaultRecord[] | null {
  return sessionRecords;
}

/** Subscription for `useSyncExternalStore`; returns the unsubscribe. */
export function subscribeVaultSession(listener: () => void): () => void {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/**
 * The site credential that matches an app URL: same host after `www.`, with a
 * user and a secret. API keys never match a site card.
 */
export function findVaultLogin(
  records: VaultRecord[] | null | undefined,
  url: string,
): VaultRecord | undefined {
  if (!records?.length || !url) return undefined;
  const host = vaultDomain(url);
  if (!host) return undefined;
  return records.find(
    (record) =>
      record.kind === "site" &&
      Boolean(record.username) &&
      Boolean(record.secret) &&
      vaultDomain(record.url) === host,
  );
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Normalized phrase first, then the raw input (legacy vaults keep working). */
function passphraseVariants(value: string): string[] {
  const normalized = normalizePassphrase(value);
  const trimmed = value.trim();
  return [...new Set([normalized, trimmed, value].filter(Boolean))];
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Creates a brand new encrypted vault for a master passphrase. */
export async function createVault(
  passphrase: string,
  records: VaultRecord[] = [],
): Promise<StoredVault> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(normalizePassphrase(passphrase), salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ version: VAULT_VERSION, records } satisfies VaultData),
  );
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  sessionKey = key;
  sessionSalt = salt;
  return {
    version: VAULT_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    updatedAt: Date.now(),
  };
}

/** Derives the key from the master passphrase and decrypts the vault. */
/**
 * Opens an envelope without touching the session: used to recover a stashed
 * vault that was sealed with another master passphrase.
 */
async function openEnvelope(
  stored: StoredVault,
  passphrase: string,
): Promise<{ data: VaultData; key: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const salt = fromBase64(stored.salt);
  const iv = fromBase64(stored.iv);
  const data = fromBase64(stored.data);
  for (const variant of passphraseVariants(passphrase)) {
    const key = await deriveKey(variant, salt);
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        data,
      );
      return {
        data: validateVaultData(JSON.parse(new TextDecoder().decode(plaintext))),
        key,
        salt,
      };
    } catch {
      // Try the next spelling before giving up.
    }
  }
  throw new Error(
    "Senha mestra incorreta. Confira maiúsculas, acentos e espaços — e, se este cofre veio de outro aparelho, use a senha mestra de lá. Nada foi alterado.",
  );
}

/**
 * Opens an envelope without touching the session: used to recover a stashed
 * vault that was sealed with another master passphrase.
 */
export async function decryptVault(
  stored: StoredVault,
  passphrase: string,
): Promise<VaultData> {
  const opened = await openEnvelope(stored, passphrase);
  return opened.data;
}

export async function unlockVault(
  stored: StoredVault,
  passphrase: string,
): Promise<VaultData> {
  const opened = await openEnvelope(stored, passphrase);
  sessionKey = opened.key;
  sessionSalt = opened.salt;
  return opened.data;
}

/** Encrypts the current records again with the key of the open session. */
export async function sealRecords(
  records: VaultRecord[],
): Promise<StoredVault> {
  if (!sessionKey || !sessionSalt)
    throw new Error("O cofre está bloqueado. Abra o cofre para salvar.");
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ version: VAULT_VERSION, records } satisfies VaultData),
  );
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    plaintext,
  );
  return {
    version: VAULT_VERSION,
    salt: toBase64(sessionSalt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    updatedAt: Date.now(),
  };
}

/** Re-encrypts the vault with a new master passphrase. */
export async function changePassphrase(
  records: VaultRecord[],
  nextPassphrase: string,
): Promise<StoredVault> {
  if (!sessionKey) throw new Error("O cofre está bloqueado.");
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(normalizePassphrase(nextPassphrase), salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ version: VAULT_VERSION, records } satisfies VaultData),
  );
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  sessionKey = key;
  sessionSalt = salt;
  return {
    version: VAULT_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    updatedAt: Date.now(),
  };
}

export function lockVault(): void {
  sessionKey = null;
  sessionSalt = null;
  sessionRecords = null;
  emitVaultSession();
}

export function isVaultUnlocked(): boolean {
  return sessionKey !== null;
}

/** Reads the encrypted envelope from localStorage. */
export function readStoredVault(): StoredVault | null {
  try {
    const raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredVault;
    if (
      stored?.version !== VAULT_VERSION ||
      typeof stored.salt !== "string" ||
      typeof stored.iv !== "string" ||
      typeof stored.data !== "string"
    )
      return null;
    return stored;
  } catch {
    return null;
  }
}

export const VAULT_CONFLICT_KEY = "multiapp.vault.v1.conflict";

/**
 * Keeps a local vault that uses another master passphrase instead of letting it
 * overwrite the account copy. There is no UI to merge these yet; the envelope
 * stays available under VAULT_CONFLICT_KEY for manual recovery.
 */
export function stashConflictingVault(stored: StoredVault): void {
  try {
    localStorage.setItem(VAULT_CONFLICT_KEY, JSON.stringify(stored));
  } catch {
    // Storage may be full; the account copy stays valid.
  }
}

export function clearConflictingVault(): void {
  try {
    localStorage.removeItem(VAULT_CONFLICT_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function readConflictingVault(): StoredVault | null {
  try {
    const raw = localStorage.getItem(VAULT_CONFLICT_KEY);
    return raw ? (JSON.parse(raw) as StoredVault) : null;
  } catch {
    return null;
  }
}

export function writeStoredVault(stored: StoredVault): void {
  localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(stored));
}

export function clearStoredVault(): void {
  localStorage.removeItem(VAULT_STORAGE_KEY);
  lockVault();
}

/** Validates decrypted data before it reaches the UI. */
export function validateVaultData(raw: unknown): VaultData {
  if (!raw || typeof raw !== "object")
    throw new Error("Cofre inválido: conteúdo inesperado.");
  const data = raw as Partial<VaultData>;
  if (data.version !== VAULT_VERSION || !Array.isArray(data.records))
    throw new Error("Cofre incompatível com esta versão do Multiapp.");
  if (data.records.length > VAULT_MAX_RECORDS)
    throw new Error(
      `Cofre incompatível. Limite: ${VAULT_MAX_RECORDS} registros.`,
    );
  const records = data.records.map((record) => validateVaultRecord(record));
  return { version: VAULT_VERSION, records };
}

/** Validates a single record, throwing a readable message when it is invalid. */
export function validateVaultRecord(raw: unknown): VaultRecord {
  const record = raw as Partial<VaultRecord>;
  if (
    !record ||
    typeof record.id !== "string" ||
    !record.id ||
    typeof record.title !== "string" ||
    !record.title.trim() ||
    record.title.length > 80 ||
    typeof record.url !== "string" ||
    record.url.length > 2048 ||
    typeof record.username !== "string" ||
    record.username.length > 120 ||
    typeof record.secret !== "string" ||
    record.secret.length > 4096 ||
    typeof record.notes !== "string" ||
    record.notes.length > 2000 ||
    typeof record.providerId !== "string" ||
    record.providerId.length > 80 ||
    typeof record.favorite !== "boolean" ||
    !Number.isFinite(record.createdAt) ||
    !Number.isFinite(record.updatedAt)
  )
    throw new Error("Cofre inválido: registro com campos fora do padrão.");

  return {
    id: record.id,
    kind: record.kind === "api" ? "api" : "site",
    title: record.title.trim(),
    url: record.url.trim(),
    username: record.username.trim(),
    secret: record.secret,
    notes: record.notes.trim(),
    providerId: record.providerId.trim(),
    favorite: record.favorite,
    createdAt: record.createdAt!,
    updatedAt: record.updatedAt!,
  };
}

/** Merges imported records, keeping the ones already stored. */
export function mergeVaultRecords(
  current: VaultRecord[],
  imported: VaultRecord[],
): VaultRecord[] {
  const key = (record: VaultRecord) =>
    `${record.kind}|${record.url.toLowerCase()}|${record.username.toLowerCase()}|${record.title.toLowerCase()}`;
  const known = new Set(current.map(key));
  const added = imported.filter((record) => {
    if (known.has(key(record))) return false;
    known.add(key(record));
    return true;
  });
  return [...current, ...added].slice(0, VAULT_MAX_RECORDS);
}

/** Masks a secret, keeping only the last four characters visible. */
export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 4) return "••••";
  return `••••••${secret.slice(-4)}`;
}

/** Hostname of a vault entry, used as a readable label. */
export function vaultDomain(url: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
