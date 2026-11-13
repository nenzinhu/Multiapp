import { NextResponse } from "next/server";

import {
  errorResponse,
  jsonError,
  noStore,
  readJson,
  sessionCookie,
} from "@/lib/server/http";
import { hit, reset as resetRateLimit } from "@/lib/server/rate-limit";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 10;

function clientKey(request: Request, username: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `login:${ip}:${username.trim().toLowerCase()}`;
}

/**
 * Same username and password on any device returns the same account snapshot,
 * because both live in the server database, not in the browser.
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const key = clientKey(
      request,
      typeof body.username === "string" ? body.username : "",
    );
    const attempt = hit(key, MAX_FAILURES, WINDOW_MS);
    if (!attempt.ok)
      return jsonError(
        429,
        `Muitas tentativas. Aguarde ${Math.max(1, Math.ceil(attempt.retryAfter / 60))} minuto(s) e tente de novo.`,
        "too-many-attempts",
      );

    const store = await getStore();
    const user = await store.authenticateUser(body);
    resetRateLimit(key);
    const { token, maxAge } = await store.createSession(user.id);
    const response = NextResponse.json({ user });
    response.cookies.set(sessionCookie(request, token, maxAge));
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
