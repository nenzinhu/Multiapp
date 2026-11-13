import { randomBytes } from "node:crypto";

import { validateBackup, type Collection } from "../collection.ts";
import {
  invalidCredentials,
  normalizeUsername,
  revisionConflict,
  SESSION_MAX_AGE,
  SESSION_TTL_MS,
  StoreError,
  tokenHash,
  toUser,
  usernameKey,
  validatePassword,
  validateVaultEnvelope,
  type Storage,
  type StoreUser,
  type StoredCollection,
} from "./accounts.ts";
import type { AppDatabase } from "./db.ts";
import { hashPassword, verifyPassword } from "./password.ts";

const EMPTY_COLLECTION: Collection = { version: 1, categories: [], links: [] };
const TAKEN = () =>
  new StoreError(
    "username-taken",
    409,
    "Esse usuário já existe. Entre na conta ou escolha outro nome.",
  );

/** Same contract as the Postgres store, backed by the local SQLite file. */
export function createSqliteStorage(db: AppDatabase): Storage {
  function readSnapshot(userId: string): StoredCollection {
    const row = db
      .prepare("SELECT revision, data, updated_at FROM collections WHERE user_id = ?")
      .get(userId) as { revision: number; data: string; updated_at: number } | undefined;
    if (!row)
      return { collection: structuredClone(EMPTY_COLLECTION), revision: 0, updatedAt: 0 };
    try {
      return {
        collection: validateBackup(JSON.parse(row.data)),
        revision: row.revision,
        updatedAt: row.updated_at,
      };
    } catch {
      // A stored payload that no longer validates is never overwritten
      // silently: it is reported as empty and keeps its revision.
      return {
        collection: structuredClone(EMPTY_COLLECTION),
        revision: row.revision,
        updatedAt: row.updated_at,
      };
    }
  }

  return {
    async createUser(input) {
      const username = normalizeUsername(input.username);
      const password = validatePassword(input.password, username);
      const key = usernameKey(username);
      const existing = db
        .prepare("SELECT id FROM users WHERE username_key = ?")
        .get(key) as { id: string } | undefined;
      if (existing) throw TAKEN();

      const user: StoreUser = {
        id: crypto.randomUUID(),
        username,
        createdAt: Date.now(),
      };
      try {
        db.prepare(
          "INSERT INTO users (id, username, username_key, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
        ).run(user.id, user.username, key, hashPassword(password), user.createdAt);
      } catch (error) {
        if (String(error).includes("UNIQUE")) throw TAKEN();
        throw error;
      }
      return user;
    },

    async authenticateUser(input) {
      const username = typeof input.username === "string" ? input.username : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (!username.trim() || !password) throw invalidCredentials();
      const row = db
        .prepare(
          "SELECT id, username, password_hash, created_at FROM users WHERE username_key = ?",
        )
        .get(usernameKey(username)) as
        | { id: string; username: string; password_hash: string; created_at: number }
        | undefined;
      if (!row) throw invalidCredentials();
      if (!verifyPassword(password, row.password_hash)) throw invalidCredentials();
      return toUser(row);
    },

    async createSession(userId) {
      const token = randomBytes(32).toString("base64url");
      const now = Date.now();
      db.prepare(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
      ).run(tokenHash(token), userId, now, now + SESSION_TTL_MS);
      db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now);
      return { token, maxAge: SESSION_MAX_AGE };
    },

    async findSessionUser(token) {
      if (!token) return null;
      const hash = tokenHash(token);
      const now = Date.now();
      const row = db
        .prepare(
          `SELECT u.id, u.username, u.created_at, s.expires_at
             FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token_hash = ?`,
        )
        .get(hash) as
        | { id: string; username: string; created_at: number; expires_at: number }
        | undefined;
      if (!row) return null;
      if (row.expires_at <= now) {
        db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
        return null;
      }
      return toUser(row);
    },

    async deleteSession(token) {
      if (!token) return;
      db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
    },


    async readCollection(userId) {
      return readSnapshot(userId);
    },

    async writeCollection(userId, payload, expectedRevision) {
      let collection: Collection;
      try {
        collection = validateBackup(payload);
      } catch (error) {
        throw new StoreError(
          "collection-invalid",
          400,
          (error as Error).message || "Coleção inválida.",
        );
      }

      const current = readSnapshot(userId);
      if (expectedRevision !== undefined && expectedRevision !== current.revision)
        throw revisionConflict();

      const now = Date.now();
      const revision = current.revision + 1;
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = db
          .prepare(
            `INSERT INTO collections (user_id, revision, data, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE
               SET revision = excluded.revision,
                   data = excluded.data,
                   updated_at = excluded.updated_at
             WHERE collections.revision = ?`,
          )
          .run(userId, revision, JSON.stringify(collection), now, current.revision);
        if (Number(result.changes) === 0) {
          db.exec("ROLLBACK");
          throw revisionConflict();
        }
        db.exec("COMMIT");
      } catch (error) {
        if (!(error instanceof StoreError)) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // The transaction is already gone; the original error is useful.
          }
        }
        throw error;
      }

      return { collection, revision, updatedAt: now };
    },

    async ping() {
      db.prepare("SELECT 1").get();
    },

    async readVault(userId) {
      const row = db
        .prepare(
          "SELECT revision, salt, iv, data, updated_at FROM vaults WHERE user_id = ?",
        )
        .get(userId) as
        | { revision: number; salt: string; iv: string; data: string; updated_at: number }
        | undefined;
      if (!row) return null;
      return {
        envelope: {
          version: 1 as const,
          salt: row.salt,
          iv: row.iv,
          data: row.data,
          updatedAt: Number(row.updated_at),
        },
        revision: Number(row.revision),
      };
    },

    async writeVault(userId, payload, expectedRevision) {
      const envelope = validateVaultEnvelope(payload);
      const current = db
        .prepare("SELECT revision FROM vaults WHERE user_id = ?")
        .get(userId) as { revision: number } | undefined;
      const revision = current ? Number(current.revision) : 0;
      if (expectedRevision !== undefined && expectedRevision !== revision)
        throw new StoreError(
          "revision-conflict",
          409,
          "O cofre mudou em outro aparelho. Recarregue para ver a versão mais recente.",
        );
      const next = revision + 1;
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = db
          .prepare(
            `INSERT INTO vaults (user_id, revision, salt, iv, data, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (user_id) DO UPDATE
               SET revision = excluded.revision,
                   salt = excluded.salt,
                   iv = excluded.iv,
                   data = excluded.data,
                   updated_at = excluded.updated_at
             WHERE vaults.revision = ?`,
          )
          .run(
            userId,
            next,
            envelope.salt,
            envelope.iv,
            envelope.data,
            envelope.updatedAt,
            revision,
          );
        if (Number(result.changes) === 0) {
          db.exec("ROLLBACK");
          throw new StoreError(
            "revision-conflict",
            409,
            "O cofre mudou em outro aparelho. Recarregue para ver a versão mais recente.",
          );
        }
        db.exec("COMMIT");
      } catch (error) {
        if (!(error instanceof StoreError)) {
          try {
            db.exec("ROLLBACK");
          } catch {
            // Transaction already gone.
          }
        }
        throw error;
      }
      return { envelope, revision: next };
    },

    async deleteVault(userId) {
      db.prepare("DELETE FROM vaults WHERE user_id = ?").run(userId);
    },

    async close() {
      db.close();
    },
  };
}
