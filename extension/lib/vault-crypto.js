/**
 * Criptografia do cofre Multiapp, copiada da mesma especificação de
 * `lib/vault.ts` (AES-GCM 256 + PBKDF2-SHA256 com 210.000 iterações).
 *
 * A extensão abre o envelope selado que o app guarda em `localStorage`. Ela
 * nunca tem a senha mestra: ela é digitada no popup, vira chave na memória do
 * navegador e o texto decifrado não é gravado em disco.
 */

export const VAULT_STORAGE_KEY = "multiapp.vault.v1";
export const VAULT_VERSION = 1;
export const VAULT_ITERATIONS = 210_000;
export const VAULT_MAX_RECORDS = 5000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const subtle = globalThis.crypto.subtle;

/** Mesma normalização do app: aparelhos e teclados diferentes, mesma chave. */
export function normalizePassphrase(value) {
  return value.trim().normalize("NFKC");
}

function passphraseVariants(value) {
  const normalized = normalizePassphrase(value);
  const trimmed = value.trim();
  return [...new Set([normalized, trimmed, value].filter(Boolean))];
}

export function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Deriva a chave AES-GCM da senha mestra. Extraível para sobreviver ao popup. */
export async function deriveVaultKey(passphrase, salt, extractable = true) {
  const material = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: VAULT_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    extractable,
    ["encrypt", "decrypt"],
  );
}

/** Lê o envelope selado e devolve só os campos esperados. */
export function parseVaultEnvelope(raw) {
  if (!raw || typeof raw !== "object") return null;
  const stored = raw;
  if (
    stored.version !== VAULT_VERSION ||
    typeof stored.salt !== "string" ||
    typeof stored.iv !== "string" ||
    typeof stored.data !== "string" ||
    !stored.salt ||
    !stored.iv ||
    !stored.data
  )
    return null;
  return {
    version: VAULT_VERSION,
    salt: stored.salt,
    iv: stored.iv,
    data: stored.data,
    updatedAt: Number.isFinite(stored.updatedAt) ? stored.updatedAt : 0,
  };
}


/** Aceita só os campos usados no preenchimento, descartando o resto. */
export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.url !== "string" || typeof raw.secret !== "string") return null;
  if (raw.kind === "api") return null;
  if (!raw.secret) return null;
  const record = {
    id: typeof raw.id === "string" && raw.id ? raw.id : "",
    kind: "site",
    title: typeof raw.title === "string" ? raw.title.slice(0, 80) : "",
    url: raw.url.slice(0, 2048),
    username: typeof raw.username === "string" ? raw.username.slice(0, 120) : "",
    secret: raw.secret,
    favorite: raw.favorite === true,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
  if (!record.title) record.title = record.url;
  return record;
}

function parsePlaintext(plaintext) {
  const data = JSON.parse(new TextDecoder().decode(plaintext));
  if (!data || data.version !== VAULT_VERSION || !Array.isArray(data.records))
    throw new Error("Cofre incompatível com esta versão do Multiapp.");
  if (data.records.length > VAULT_MAX_RECORDS)
    throw new Error("Cofre incompatível: registros demais.");
  return data.records.map(normalizeRecord).filter(Boolean);
}

/** Decifra com a senha mestra e devolve `{ records, key }`. */
export async function openVaultEnvelope(stored, passphrase) {
  const envelope = parseVaultEnvelope(stored);
  if (!envelope)
    throw new Error(
      "Cofre não encontrado neste navegador. Abra o Multiapp e desbloqueie o cofre.",
    );
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const cipher = fromBase64(envelope.data);
  for (const variant of passphraseVariants(passphrase)) {
    const key = await deriveVaultKey(variant, salt);
    try {
      const plaintext = await subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
      return { records: parsePlaintext(plaintext), key };
    } catch {
      // Tenta a próxima grafia antes de recusar a senha.
    }
  }
  throw new Error(
    "Senha mestra incorreta. Confira maiúsculas, acentos e espaços. Nada foi alterado.",
  );
}

/** Decifra com uma chave já derivada (o popup pode fechar sem perder o acesso). */
export async function decryptEnvelopeWithKey(stored, key) {
  const envelope = parseVaultEnvelope(stored);
  if (!envelope) throw new Error("Cofre não encontrado neste navegador.");
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) },
    key,
    fromBase64(envelope.data),
  );
  return parsePlaintext(plaintext);
}

/** A chave crua (32 bytes) guardada em `storage.session`, só na memória. */
export async function exportKey(key) {
  return toBase64(new Uint8Array(await subtle.exportKey("raw", key)));
}

export async function importKey(rawBase64) {
  return subtle.importKey(
    "raw",
    fromBase64(rawBase64),
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Sela registros com uma chave derivada; usado pelos testes. */
export async function sealRecords(records, key, salt = "") {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(
    JSON.stringify({ version: VAULT_VERSION, records }),
  );
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return {
    version: VAULT_VERSION,
    salt,
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
    updatedAt: Date.now(),
  };
}

export function randomSalt() {
  return globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

/** Id curto e não secreto do envelope, igual ao mostrado no app. */
export function vaultId(stored) {
  const input = `${stored.salt}|${stored.iv}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 6);
}
