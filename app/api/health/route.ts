import { NextResponse } from "next/server";

import { databaseTarget, getStore, storageKind } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostics for "o cadastro falhou": tells which driver is active, whether
 * the database answers and which host is configured (never the password).
 */
export async function GET() {
  const kind = storageKind();
  const configured = Boolean(databaseTarget());
  const started = Date.now();
  try {
    const store = await getStore();
    await store.ping();
    return NextResponse.json(
      {
        ok: true,
        storage: kind,
        databaseUrl: configured ? "configurada" : "ausente",
        target: databaseTarget(),
        latencyMs: Date.now() - started,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        storage: kind,
        databaseUrl: configured ? "configurada" : "ausente",
        target: databaseTarget(),
        code: (error as { code?: string })?.code || "error",
        message,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
