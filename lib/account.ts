import type { Collection } from "./collection";

/** A signed-in account, as returned by the API. */
export type AccountUser = { id: string; username: string; createdAt: number };

export type RemoteCollection = {
  collection: Collection;
  revision: number;
  updatedAt: number;
};

export type PushResult =
  | { ok: true; collection: Collection; revision: number; updatedAt: number }
  | {
      ok: false;
      conflict: true;
      collection: Collection;
      revision: number;
      updatedAt: number;
    };

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Sem conexão com o servidor. Verifique a internet e tente de novo.",
      0,
      "network",
    );
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string } } | null)
      ?.error;
    throw new ApiError(
      error?.message || "O servidor não respondeu como esperado. Tente de novo.",
      response.status,
      error?.code || "error",
    );
  }
  return payload as T;
}

export function fetchSession(): Promise<{ user: AccountUser | null }> {
  return request("/api/auth/me");
}

export function signIn(username: string, password: string): Promise<{ user: AccountUser }> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signUp(username: string, password: string): Promise<{ user: AccountUser }> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function signOut(): Promise<{ ok: true }> {
  return request("/api/auth/logout", { method: "POST", body: "{}" });
}

export function pullCollection(): Promise<RemoteCollection & { user: AccountUser }> {
  return request("/api/collection");
}

export async function pushCollection(
  collection: Collection,
  revision: number,
  keepalive = false,
): Promise<PushResult> {
  let response: Response;
  try {
    response = await fetch("/api/collection", {
      method: "PUT",
      credentials: "same-origin",
      keepalive,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection, revision }),
    });
  } catch {
    throw new ApiError(
      "Sem conexão com o servidor. Suas mudanças continuam neste aparelho.",
      0,
      "network",
    );
  }
  const payload = (await response.json().catch(() => null)) as
    | {
        collection?: Collection;
        revision?: number;
        updatedAt?: number;
        error?: { message?: string; code?: string };
      }
    | null;
  if (response.status === 409 && payload?.collection)
    return {
      ok: false,
      conflict: true,
      collection: payload.collection,
      revision: payload.revision ?? 0,
      updatedAt: payload.updatedAt ?? 0,
    };
  if (!response.ok)
    throw new ApiError(
      payload?.error?.message || "Não foi possível sincronizar agora.",
      response.status,
      payload?.error?.code || "error",
    );
  return {
    ok: true,
    collection: payload?.collection as Collection,
    revision: payload?.revision ?? revision + 1,
    updatedAt: payload?.updatedAt ?? Date.now(),
  };
}
