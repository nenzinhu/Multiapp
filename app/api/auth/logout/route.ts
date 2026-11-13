import { NextResponse } from "next/server";

import {
  errorResponse,
  noStore,
  readCookie,
  sessionCookie,
  SESSION_COOKIE,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ends the session on this device. Other devices keep their own cookies. */
export async function POST(request: Request) {
  try {
    const token = readCookie(request, SESSION_COOKIE);
    if (token) {
      const store = await getStore();
      await store.deleteSession(token);
    }
    const response = NextResponse.json({ ok: true, user: null });
    response.cookies.set({ ...sessionCookie(request, "", 0), maxAge: 0 });
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
