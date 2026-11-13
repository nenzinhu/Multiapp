import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt. The parameters travel inside the stored string,
 * so a future cost increase still verifies the old hashes.
 */
const PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 96 * 1024 * 1024,
} as const;
const SALT_BYTES = 16;
const SCHEME = "scrypt";

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

/** Accents typed on different keyboards must produce the same bytes. */
function material(password: string): string {
  return password.normalize("NFKC");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const key = scryptSync(material(password), salt, PARAMS.keyLength, PARAMS);
  return [
    SCHEME,
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/** Constant-time check. Tampered or unknown hashes never validate. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== SCHEME) return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N < 1024 ||
    N > 1 << 20 ||
    r < 1 ||
    r > 32 ||
    p < 1 ||
    p > 16
  )
    return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64url");
    expected = Buffer.from(parts[5], "base64url");
  } catch {
    return false;
  }
  if (salt.length < 8 || expected.length < 32) return false;
  const actual = scryptSync(material(password), salt, expected.length, {
    N,
    r,
    p,
    maxmem: PARAMS.maxmem,
  });
  return timingSafeEqual(actual, expected);
}
