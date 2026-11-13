import { NextResponse } from "next/server";

import {
  errorResponse,
  noStore,
  readJson,
  requireUser,
} from "@/lib/server/http";
import { getStore, StoreError } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The whole app library of the signed account: the same on any device. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const stored = await getStore().readCollection(user.id);
    return noStore(NextResponse.json({ user, ...stored }));
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Stores the full snapshot. `revision` is the version the client last saw; a
 * mismatch answers 409 with the server copy so nothing is silently overwritten.
 */
export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson(request);
    const expected =
      typeof body.revision === "number" ? body.revision : undefined;
    const saved = await getStore().writeCollection(user.id, body.collection, expected);
    return noStore(NextResponse.json(saved));
  } catch (error) {
    if (error instanceof StoreError && error.code === "revision-conflict") {
      try {
        const user = await requireUser(request);
        const current = await getStore().readCollection(user.id);
        return noStore(
          NextResponse.json(
            {
              error: { code: error.code, message: error.message },
              ...current,
            },
            { status: 409 },
          ),
        );
      } catch {
        // Fall through to the standard error payload.
      }
    }
    return errorResponse(error);
  }
}
