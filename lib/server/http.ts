import { NextResponse } from "next/server";

import { StoreError, type StoreUser } from "./accounts.ts";
import { databaseTarget, getStore } from "./store.ts";

export const SESSION_COOKIE = "multiapp_session";
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const value = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function isSecureRequest(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sessionCookie(
  request: Request,
  token: string,
  maxAge: number,
): {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: "lax";
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest(request),
    path: "/",
    maxAge,
  };
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  return response;
}

export function jsonError(status: number, message: string, code = "error"): NextResponse {
  return noStore(
    NextResponse.json({ error: { code, message } }, { status }),
  );
}

export async function currentUser(request: Request): Promise<StoreUser | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const store = await getStore();
  return store.findSessionUser(token);
}

export async function requireUser(request: Request): Promise<StoreUser> {
  const user = await currentUser(request);
  if (!user)
    throw new StoreError(
      "unauthorized",
      401,
      "Entre na sua conta para ver seus apps.",
    );
  return user;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES)
    throw new StoreError("payload-too-large", 413, "Envie no máximo 5 MB.");
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES)
    throw new StoreError("payload-too-large", 413, "Envie no máximo 5 MB.");
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("not an object");
    return parsed as Record<string, unknown>;
  } catch {
    throw new StoreError("body-invalid", 400, "Envie um JSON válido.");
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof StoreError) return jsonError(error.status, error.message, error.code);
  const code = (error as { code?: string })?.code || "";
  const message = error instanceof Error ? error.message : String(error);
  if (
    [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNRESET",
      "28P01",
      "3D000",
      "57P01",
      "XX000",
      "EAI_AGAIN",
    ].includes(code) ||
    /SQLITE|database|readonly|EROFS|EACCES|ENOSPC|unable to open|password authentication|connection terminated|connection timeout|timeout exceeded when trying to connect|getaddrinfo/i.test(
      message,
    )
  ) {
    console.error("[multiapp] banco de dados indisponível:", code, message);
    const target = databaseTarget();
    const hint = !target
      ? "Configure DATABASE_URL (Supabase → Connect → Transaction pooler, porta 6543) ou um MULTIAPP_DB_FILE gravável."
      : target.includes("supabase.co") && !target.includes("pooler")
        ? `A URL direta do Supabase (${target}) só responde em IPv6; troque pela do pooler (porta 6543).`
        : `Destino atual: ${target}. Confira usuário, senha e sslmode=require.`;
    return jsonError(
      503,
      `Não foi possível falar com o banco de dados. ${hint}`,
      "database-unavailable",
    );
  }
  console.error("[multiapp] erro inesperado:", error);
  return jsonError(500, "Algo falhou aqui. Tente novamente em instantes.");
}
