import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** The synchronous SQLite handle used by the accounts and collection store. */
export type AppDatabase = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  username_key TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions (user_id);

CREATE TABLE IF NOT EXISTS collections (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS vaults (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  salt TEXT NOT NULL,
  iv TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * `MULTIAPP_DB_FILE` points at the SQLite file (or `:memory:` in tests). The
 * default keeps the database next to the project, on disk, so the same account
 * is readable from every browser and device that reaches the server.
 */
export function databaseFile(): string {
  const configured = process.env.MULTIAPP_DB_FILE?.trim();
  if (configured) return configured;
  return resolve(process.cwd(), ".data", "multiapp.db");
}

export function openDatabase(file: string): AppDatabase {
  if (file !== ":memory:") mkdirSync(dirname(resolve(file)), { recursive: true });
  const db = new DatabaseSync(file === ":memory:" ? file : resolve(file));
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  if (file !== ":memory:") {
    try {
      db.exec("PRAGMA journal_mode = WAL;");
    } catch {
      // A read-only or network filesystem may refuse WAL; the default journal
      // still works, so the connection stays usable.
    }
  }
  db.exec(SCHEMA);
  return db;
}

let shared: AppDatabase | null = null;

export function getDatabase(): AppDatabase {
  if (!shared) shared = openDatabase(databaseFile());
  return shared;
}

/** Test helper: drops the singleton so a new file or `:memory:` can be used. */
export function resetDatabaseForTests(): void {
  shared?.close();
  shared = null;
}
