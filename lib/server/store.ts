import type { Storage } from "./accounts.ts";
import { getDatabase } from "./db.ts";
import {
  createPostgresStorage,
  databaseUrl,
  getPostgresPool,
} from "./postgres-store.ts";
import { createSqliteStorage } from "./sqlite-store.ts";

export type { Storage } from "./accounts.ts";
export { StoreError } from "./accounts.ts";
export type { StoreUser, StoredCollection } from "./accounts.ts";

let shared: Storage | null = null;

/**
 * Postgres (Supabase or any `DATABASE_URL`) when configured, SQLite otherwise.
 * A local checkout without environment variables still runs the whole product.
 */
export function getStore(): Storage {
  if (shared) return shared;
  shared = databaseUrl()
    ? createPostgresStorage(getPostgresPool())
    : createSqliteStorage(getDatabase());
  return shared;
}

export function storageKind(): "postgres" | "sqlite" {
  return databaseUrl() ? "postgres" : "sqlite";
}

export async function resetStoreForTests(): Promise<void> {
  shared = null;
}

export function store(): Storage {
  return getStore();
}
