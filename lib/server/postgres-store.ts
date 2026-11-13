import { randomBytes } from "node:crypto";
import { Pool } from "pg";

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
  type Storage,
  type StoreUser,
  type StoredCollection,
} from "./accounts.ts";
import { hashPassword, verifyPassword } from "./password.ts";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_key text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at bigint NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS collections (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  data text NOT NULL,
  updated_at bigint NOT NULL
);
`;

export function databaseUrl(): string | null {
  const configured =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim();
  return configured || null;
}

/**
 * Vercel's Supabase/Postgres integrations inject the pieces instead of a URL:
 * POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DATABASE. `pg` also
 * understands the PGHOST family.
 */
export function databaseParts(): PostgresConfig | null {
  const host = process.env.POSTGRES_HOST?.trim() || process.env.PGHOST?.trim();
  if (!host) return null;
  const user =
    process.env.POSTGRES_USER?.trim() || process.env.PGUSER?.trim() || "postgres";
  const password = process.env.POSTGRES_PASSWORD ?? process.env.PGPASSWORD ?? "";
  const database =
    process.env.POSTGRES_DATABASE?.trim() ||
    process.env.PGDATABASE?.trim() ||
    "postgres";
  const port = Number(
    process.env.POSTGRES_PORT?.trim() || process.env.PGPORT?.trim() || 5432,
  );
  const sslmode = process.env.PGSSLMODE;
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 5432,
    user,
    password,
    database,
    ssl: sslmode !== "disable" && sslmode !== "allow",
  };
}

export function hasDatabaseConfig(): boolean {
  return Boolean(databaseUrl() || databaseParts());
}

/** Resolved connection settings, from the URL when present, else from parts. */
export function databaseConfig(): PostgresConfig | null {
  const url = databaseUrl();
  if (url) return parseDatabaseUrl(url);
  return databaseParts();
}

/** Safe description for diagnostics: never includes the password. */
export function databaseTarget(): string | null {
  try {
    const config = databaseConfig();
    return config ? `${config.host}:${config.port}/${config.database}` : null;
  } catch {
    return "DATABASE_URL invalida";
  }
}

export type PostgresConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
};

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    // A raw password can contain "%" without being an escape.
    return value;
  }
}

/**
 * Accepts a normal `postgres://` URL and also the Supabase form whose password
 * may carry `@` or brackets without escaping.
 */
export function parseDatabaseUrl(raw: string): PostgresConfig {
  const trimmed = raw.trim();
  const match = /^postgres(?:ql)?:\/\/([\s\S]+)$/i.exec(trimmed);
  if (!match)
    throw new StoreError(
      "database-url-invalid",
      503,
      "DATABASE_URL precisa começar com postgresql://.",
    );
  const rest = match[1];
  const at = rest.lastIndexOf("@");
  const userInfo = at === -1 ? "" : rest.slice(0, at);
  const hostPart = at === -1 ? rest : rest.slice(at + 1);
  const colon = userInfo.indexOf(":");
  const user = colon === -1 ? userInfo : userInfo.slice(0, colon);
  const password = colon === -1 ? "" : userInfo.slice(colon + 1);

  const [authority, ...queryParts] = hostPart.split("?");
  const query = new URLSearchParams(queryParts.join("?"));
  const slash = authority.indexOf("/");
  const hostAndPort = slash === -1 ? authority : authority.slice(0, slash);
  const database = slash === -1 ? "postgres" : authority.slice(slash + 1) || "postgres";
  const portSeparator = hostAndPort.lastIndexOf(":");
  const host = portSeparator === -1 ? hostAndPort : hostAndPort.slice(0, portSeparator);
  const port = Number(
    portSeparator === -1 ? 5432 : hostAndPort.slice(portSeparator + 1) || 5432,
  );
  if (!host || !user)
    throw new StoreError(
      "database-url-invalid",
      503,
      "DATABASE_URL está incompleta: faltam host ou usuário.",
    );

  const sslmode = query.get("sslmode");
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 5432,
    user: decode(user),
    password: decode(password),
    database: decode(database) || "postgres",
    ssl: sslmode !== "disable" && sslmode !== "allow",
  };
}

let sharedPool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function getPostgresPool(): Pool {
  if (sharedPool) return sharedPool;
  const config = databaseConfig();
  if (!config)
    throw new StoreError(
      "database-missing",
      503,
      "Defina DATABASE_URL (ou POSTGRES_HOST/POSTGRES_USER/POSTGRES_PASSWORD) para usar o Postgres.",
    );
  sharedPool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.MULTIAPP_DB_POOL_SIZE || 4),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 15_000,
    application_name: "multiapp",
  });
  sharedPool.on("error", (error) => {
    console.error("[multiapp] erro em conexão ociosa do Postgres:", error.message);
  });
  return sharedPool;
}

/** Creates the tables once per process; the DDL is idempotent. */
export async function ensurePostgresSchema(pool: Pool): Promise<void> {
  if (!schemaReady)
    schemaReady = pool.query(SCHEMA).then(
      () => undefined,
      (error) => {
        schemaReady = null;
        throw error;
      },
    );
  return schemaReady;
}

export function resetPostgresForTests(): void {
  sharedPool = null;
  schemaReady = null;
}

const EMPTY_COLLECTION: Collection = { version: 1, categories: [], links: [] };
const TAKEN = () =>
  new StoreError(
    "username-taken",
    409,
    "Esse usuário já existe. Entre na conta ou escolha outro nome.",
  );

function readSnapshotRow(row: {
  revision: number | string;
  data: string;
  updated_at: number | string;
}): StoredCollection {
  const revision = Number(row.revision);
  const updatedAt = Number(row.updated_at);
  try {
    return { collection: validateBackup(JSON.parse(row.data)), revision, updatedAt };
  } catch {
    return { collection: structuredClone(EMPTY_COLLECTION), revision, updatedAt };
  }
}

/** Postgres implementation used when DATABASE_URL points at Supabase or any PG. */
export function createPostgresStorage(pool: Pool): Storage {
  const ready = () => ensurePostgresSchema(pool);

  return {
    async createUser(input) {
      await ready();
      const username = normalizeUsername(input.username);
      const password = validatePassword(input.password, username);
      const key = usernameKey(username);
      const user: StoreUser = {
        id: crypto.randomUUID(),
        username,
        createdAt: Date.now(),
      };
      try {
        await pool.query(
          `INSERT INTO users (id, username, username_key, password_hash, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, user.username, key, hashPassword(password), user.createdAt],
        );
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw TAKEN();
        throw error;
      }
      return user;
    },

    async authenticateUser(input) {
      await ready();
      const username = typeof input.username === "string" ? input.username : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (!username.trim() || !password) throw invalidCredentials();
      const result = await pool.query(
        "SELECT id, username, password_hash, created_at FROM users WHERE username_key = $1",
        [usernameKey(username)],
      );
      const row = result.rows[0] as
        | { id: string; username: string; password_hash: string; created_at: string }
        | undefined;
      if (!row) throw invalidCredentials();
      if (!verifyPassword(password, row.password_hash)) throw invalidCredentials();
      return toUser(row);
    },

    async createSession(userId) {
      await ready();
      const token = randomBytes(32).toString("base64url");
      const now = Date.now();
      await pool.query(
        "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
        [tokenHash(token), userId, now, now + SESSION_TTL_MS],
      );
      await pool.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
      return { token, maxAge: SESSION_MAX_AGE };
    },

    async findSessionUser(token) {
      if (!token) return null;
      await ready();
      const hash = tokenHash(token);
      const now = Date.now();
      const result = await pool.query(
        `SELECT u.id, u.username, u.created_at, s.expires_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = $1`,
        [hash],
      );
      const row = result.rows[0] as
        | { id: string; username: string; created_at: string; expires_at: string }
        | undefined;
      if (!row) return null;
      if (Number(row.expires_at) <= now) {
        await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hash]);
        return null;
      }
      return toUser(row);
    },

    async deleteSession(token) {
      if (!token) return;
      await ready();
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash(token)]);
    },

    async readCollection(userId) {
      await ready();
      const result = await pool.query(
        "SELECT revision, data, updated_at FROM collections WHERE user_id = $1",
        [userId],
      );
      const row = result.rows[0] as
        | { revision: number | string; data: string; updated_at: number | string }
        | undefined;
      if (!row)
        return { collection: structuredClone(EMPTY_COLLECTION), revision: 0, updatedAt: 0 };
      return readSnapshotRow(row);
    },

    async writeCollection(userId, payload, expectedRevision) {
      await ready();
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

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // The row lock makes two devices serialize instead of both writing.
        const current = await client.query(
          "SELECT revision FROM collections WHERE user_id = $1 FOR UPDATE",
          [userId],
        );
        const revision = current.rows[0] ? Number(current.rows[0].revision) : 0;
        if (expectedRevision !== undefined && expectedRevision !== revision)
          throw revisionConflict();

        const now = Date.now();
        const nextRevision = revision + 1;
        await client.query(
          `INSERT INTO collections (user_id, revision, data, updated_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id) DO UPDATE
             SET revision = EXCLUDED.revision,
                 data = EXCLUDED.data,
                 updated_at = EXCLUDED.updated_at`,
          [userId, nextRevision, JSON.stringify(collection), now],
        );
        await client.query("COMMIT");
        return { collection, revision: nextRevision, updatedAt: now };
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch {
          // The transaction is already gone; the original error is useful.
        }
        throw error;
      } finally {
        client.release();
      }
    },

    async ping() {
      await ready();
      await pool.query("SELECT 1");
    },

    async close() {
      await pool.end();
    },
  };
}
