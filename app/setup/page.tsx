import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";
import { environmentReport, hostingPlatform, whereToConfigure } from "@/lib/server/env";
import {
  databaseTarget,
  databaseUser,
  getStore,
  storageKind,
} from "@/lib/server/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuração do banco — Multiapp",
  robots: { index: false, follow: false },
};

/**
 * Plain-language diagnostics for a deploy that cannot reach a database yet.
 * Shows what the server received (names only) and the exact next step.
 */
export default async function SetupPage() {
  const kind = storageKind();
  const target = databaseTarget();
  const user = databaseUser();
  const env = environmentReport();
  let ok = false;
  let detail = "";
  try {
    const store = await getStore();
    await store.ping();
    ok = true;
  } catch (error) {
    detail = error instanceof Error ? error.message : String(error);
  }

  return (
    <main className="setup-shell">
      <section className="setup-card" aria-labelledby="setup-title">
        <Logo />
        <p className="eyebrow">DIAGNÓSTICO</p>
        <h1 id="setup-title">Configuração do banco</h1>
        <p
          className={`setup-status ${ok ? "is-ok" : "is-bad"}`}
          role="status"
        >
          <span />
          {ok
            ? "Banco conectado — criar conta deve funcionar."
            : "O servidor não conseguiu falar com um banco de dados."}
        </p>

        <dl className="setup-grid">
          <div>
            <dt>Driver</dt>
            <dd>{kind}</dd>
          </div>
          <div>
            <dt>Alvo</dt>
            <dd>{target ?? "nenhum"}</dd>
          </div>
          <div>
            <dt>Usuário</dt>
            <dd>{user ?? "—"}</dd>
          </div>
          <div>
            <dt>Plataforma</dt>
            <dd>{hostingPlatform()}</dd>
          </div>
          <div>
            <dt>DATABASE_URL</dt>
            <dd>{env.DATABASE_URL ? "presente" : "ausente"}</dd>
          </div>
        </dl>

        {!ok && (
          <>
            <p className="setup-detail">{detail}</p>
            <ol className="setup-steps">
              <li>
                No Supabase: <strong>Connect → Transaction pooler</strong> e copie
                a URL (porta <code>6543</code>).
              </li>
              <li>
                Defina <code>DATABASE_URL</code> {whereToConfigure()}.
              </li>
              <li>
                Faça um novo deploy e recarregue esta página. O app cria as
                tabelas na primeira requisição.
              </li>
            </ol>
          </>
        )}

        <details className="setup-env">
          <summary>Variáveis que o servidor recebeu</summary>
          <ul>
            {Object.entries(env).map(([name, present]) => (
              <li key={name} data-present={present}>
                <code>{name}</code>
                <span>{present ? "presente" : "ausente"}</span>
              </li>
            ))}
          </ul>
          <p>
            Nenhum valor é exibido aqui — só se a variável existe neste processo.
          </p>
        </details>

        <div className="setup-actions">
          <Link className="button primary" href="/">
            Abrir o app
          </Link>
          <a className="button secondary" href="/api/health">
            Ver JSON (/api/health)
          </a>
        </div>
      </section>
    </main>
  );
}
