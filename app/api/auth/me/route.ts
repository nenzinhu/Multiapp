import { NextResponse } from "next/server";

import { currentUser, errorResponse, noStore } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Used on load to know whether the cookie still points at a live session. */
export async function GET(request: Request) {
  try {
    return noStore(NextResponse.json({ user: await currentUser(request) }));
  } catch (error) {
    return errorResponse(error);
  }
}
