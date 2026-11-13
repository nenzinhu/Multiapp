import { NextResponse } from "next/server";

import { errorResponse, noStore, readJson, requireUser } from "@/lib/server/http";
import { getStore, StoreError } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The vault copy kept for the account. The body is the sealed envelope
 * (salt + iv + ciphertext): the server cannot read it and never sees the
 * master passphrase.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const store = await getStore();
    const remote = await store.readVault(user.id);
    return noStore(
      NextResponse.json({
        vault: remote?.envelope ?? null,
        revision: remote?.revision ?? 0,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson(request);
    const expected =
      typeof body.revision === "number" ? body.revision : undefined;
    const store = await getStore();
    const saved = await store.writeVault(user.id, body.vault, expected);
    return noStore(
      NextResponse.json({ vault: saved.envelope, revision: saved.revision }),
    );
  } catch (error) {
    if (error instanceof StoreError && error.code === "revision-conflict") {
      try {
        const user = await requireUser(request);
        const store = await getStore();
        const current = await store.readVault(user.id);
        return noStore(
          NextResponse.json(
            {
              error: { code: error.code, message: error.message },
              vault: current?.envelope ?? null,
              revision: current?.revision ?? 0,
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

/** Removes the account copy; the local vault stays untouched. */
export async function DELETE(request: Request) {
  try {
    const user = await requireUser(request);
    const store = await getStore();
    await store.deleteVault(user.id);
    return noStore(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
