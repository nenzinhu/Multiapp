import { NextResponse } from "next/server";

import { environmentReport, hostingPlatform, whereToConfigure } from "@/lib/server/env";
import { databaseTarget, getStore, storageKind } from "@/lib/server/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostics for "o cadastro falhou": tells which driver is active, whether
 * the database answers, which host is configured (never the password) and which
 * environment variables the server actually received.
 */
export async function GET() {
  const kind = storageKind();
  const configured = Boolean(databaseTarget());
  const started = Date.now();
  const base = {
    storage: kind,
    databaseUrl: configured ? "configurada" : "ausente",
    target: databaseTarget(),
    platform: hostingPlatform(),
    env: environmentReport(),
  };
  try {
    const store = await getStore();
    await store.ping();
    return NextResponse.json(
      { ok: true, ...base, latencyMs: Date.now() - started },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        ...base,
        code: (error as { code?: string })?.code || "error",
        message: error instanceof Error ? error.message : String(error),
        hint: whereToConfigure(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
