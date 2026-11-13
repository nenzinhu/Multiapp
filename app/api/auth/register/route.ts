import { NextResponse } from "next/server";

import {
  errorResponse,
  noStore,
  readJson,
  sessionCookie,
} from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Creates the account and signs it in, so the first screen is already hers. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const store = await getStore();
    const user = await store.createUser(body);
    const { token, maxAge } = await store.createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(sessionCookie(request, token, maxAge));
    return noStore(response);
  } catch (error) {
    return errorResponse(error);
  }
}
