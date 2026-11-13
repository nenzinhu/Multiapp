import { createHash } from "node:crypto";

import type { Collection } from "../collection.ts";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./password.ts";

export type StoreUser = { id: string; username: string; createdAt: number };

/** Errors that carry the HTTP status the API should answer with. */
export class StoreError extends Error {
  status: number;
  code: string;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "StoreError";
    this.code = code;
    this.status = status;
  }
}

export type StoredCollection = {
  collection: Collection;
  revision: number;
  updatedAt: number;
};

/**
 * Everything the API needs from a database. Implemented twice: SQLite for
 * local runs and Postgres (Supabase) for deployments.
 */
export type Storage = {
  createUser(input: { username?: unknown; password?: unknown }): Promise<StoreUser>;
  authenticateUser(input: {
    username?: unknown;
    password?: unknown;
  }): Promise<StoreUser>;
  createSession(userId: string): Promise<{ token: string; maxAge: number }>;
  findSessionUser(token: string): Promise<StoreUser | null>;
  deleteSession(token: string): Promise<void>;
  readCollection(userId: string): Promise<StoredCollection>;
  writeCollection(
    userId: string,
    payload: unknown,
    expectedRevision?: number,
  ): Promise<StoredCollection>;
  close(): Promise<void>;
};

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000);
const USERNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,31}$/u;

export function usernameKey(username: string): string {
  return username.normalize("NFKC").trim().toLowerCase();
}

/** Only the digest of a session token ever reaches the database. */
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 3–32 letters, digits, dots, dashes or underscores: easy to type on a phone. */
export function normalizeUsername(value: unknown): string {
  const username = typeof value === "string" ? value.normalize("NFKC").trim() : "";
  if (!username)
    throw new StoreError("username-required", 400, "Digite um nome de usuário.");
  if (!USERNAME_PATTERN.test(username))
    throw new StoreError(
      "username-invalid",
      400,
      "Use de 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.",
    );
  return username;
}

export function validatePassword(value: unknown, username: string): string {
  const password = typeof value === "string" ? value : "";
  if (!password)
    throw new StoreError("password-required", 400, "Digite sua senha.");
  if (password.length < MIN_PASSWORD_LENGTH)
    throw new StoreError(
      "password-short",
      400,
      `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  if (password.length > MAX_PASSWORD_LENGTH)
    throw new StoreError("password-long", 400, "A senha deve ter até 200 caracteres.");
  if (usernameKey(password) === usernameKey(username))
    throw new StoreError(
      "password-weak",
      400,
      "A senha não pode ser igual ao nome de usuário.",
    );
  return password;
}

export function collectionFromPayload(payload: unknown): Collection {
  return payload as Collection;
}

export const invalidCredentials = () =>
  new StoreError(
    "invalid-credentials",
    401,
    "Usuário ou senha incorretos. Confira e tente de novo.",
  );

export const revisionConflict = () =>
  new StoreError(
    "revision-conflict",
    409,
    "Sua coleção mudou em outro aparelho. Atualize para ver a versão mais recente.",
  );

export function toUser(row: {
  id: string;
  username: string;
  created_at: number | string;
}): StoreUser {
  return { id: row.id, username: row.username, createdAt: Number(row.created_at) };
}
