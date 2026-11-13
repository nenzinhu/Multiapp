import { StoreError, type Storage } from "./accounts.ts";
import { hostingPlatform, whereToConfigure } from "./env.ts";
import {
  createPostgresStorage,
  hasDatabaseConfig,
  getPostgresPool,
} from "./postgres-store.ts";

export type { Storage } from "./accounts.ts";
export { StoreError } from "./accounts.ts";
export type { StoreUser, StoredCollection } from "./accounts.ts";
export { databaseTarget, databaseUser } from "./postgres-store.ts";

let shared: Storage | null = null;
let loading: Promise<Storage> | null = null;

async function open(): Promise<Storage> {
  if (hasDatabaseConfig()) {
    shared = createPostgresStorage(getPostgresPool());
    return shared;
  }
  try {
    // SQLite is optional: it is only imported when no Postgres is configured,
    // so hosts running an older Node (without `node:sqlite`) still serve the
    // app and never crash on the import.
    const [{ createSqliteStorage }, { getDatabase }] = await Promise.all([
      import("./sqlite-store.ts"),
      import("./db.ts"),
    ]);
    shared = createSqliteStorage(getDatabase());
    return shared;
  } catch (error) {
    console.error("[multiapp] SQLite indisponível:", error);
    throw new StoreError(
      "database-missing",
      503,
      `Este servidor não tem banco de dados configurado. Defina DATABASE_URL ${whereToConfigure()} (${hostingPlatform()}). Use a URL do pooler do Supabase, porta 6543, com ?sslmode=require. Diagnóstico sem senha em /setup.`,
    );
  }
}

/**
 * Postgres (Supabase or any `DATABASE_URL`) when configured, SQLite otherwise.
 * A local checkout without environment variables still runs the whole product.
 */
export async function getStore(): Promise<Storage> {
  if (shared) return shared;
  if (!loading) loading = open().finally(() => (loading = null));
  return loading;
}

export function storageKind(): "postgres" | "sqlite" {
  return hasDatabaseConfig() ? "postgres" : "sqlite";
}

export async function resetStoreForTests(): Promise<void> {
  shared = null;
  loading = null;
}
