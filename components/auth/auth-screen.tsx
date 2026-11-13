"use client";

import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Logo } from "@/components/logo";
import { ApiError, signIn, signUp, type AccountUser } from "@/lib/account";
import { usePanelEntrance } from "@/lib/panel-motion";

type Mode = "signin" | "signup";

/**
 * The account gate. Nothing is read from the browser collection until the
 * server confirms the session, so a phone and a computer see the same apps.
 */
export function AuthScreen({
  onAuthenticated,
  notice,
}: {
  onAuthenticated: (user: AccountUser) => void;
  notice?: string;
}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const storyRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  usePanelEntrance(storyRef, { y: 20, stagger: 0.08, duration: 0.6 });
  usePanelEntrance(cardRef, { y: 24, stagger: 0.07, duration: 0.5, delay: 0.06 });

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!username.trim()) {
      setError("Digite seu nome de usuário.");
      document.getElementById("auth-username")?.focus();
      return;
    }
    if (!password) {
      setError("Digite sua senha.");
      document.getElementById("auth-password")?.focus();
      return;
    }
    setError("");
    setPending(true);
    try {
      const result =
        mode === "signin"
          ? await signIn(username, password)
          : await signUp(username, password);
      onAuthenticated(result.user);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Não foi possível entrar agora. Tente de novo.",
      );
      setPassword("");
      document.getElementById("auth-password")?.focus();
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="auth-shell">
      <section
        className="auth-story"
        aria-labelledby="auth-story-title"
        ref={storyRef}
      >
        <div className="auth-story-top" data-panel-item>
          <Logo />
        </div>
        <div className="auth-story-body">
          <h1 id="auth-story-title" data-panel-item>
            Todos os seus apps.
            <br />
            <span>Uma senha só.</span>
          </h1>
          <p className="auth-lede" data-panel-item>
            Entre e a sua biblioteca abre inteira, em qualquer aparelho.
          </p>
        </div>
        <p className="auth-story-foot" data-panel-item>
          Menos abas. Mais foco.
        </p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card" ref={cardRef}>
          <div
            className="auth-tabs"
            role="group"
            aria-label="Entrar ou criar conta"
            data-panel-item
          >
            <button
              type="button"
              aria-pressed={mode === "signin"}
              className={mode === "signin" ? "selected" : ""}
              onClick={() => switchMode("signin")}
            >
              Entrar
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              className={mode === "signup" ? "selected" : ""}
              onClick={() => switchMode("signup")}
            >
              Criar conta
            </button>
          </div>

          <header className="auth-head" data-panel-item>
            <h2 id="auth-title">
              {mode === "signin" ? "Entre para continuar" : "Crie sua conta"}
            </h2>
            {mode === "signup" && (
              <p>Usuário de 3 a 32 caracteres e senha de 8 a 200.</p>
            )}
          </header>

          {notice && (
            <p className="auth-notice" role="status" data-panel-item>
              {notice}
            </p>
          )}

          <form onSubmit={submit} noValidate data-panel-item>
            <label htmlFor="auth-username">Usuário</label>
            <div className="auth-field">
              <UserRound size={17} aria-hidden="true" />
              <input
                id="auth-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="seu.usuario"
                value={username}
                aria-invalid={!!error}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError("");
                }}
              />
            </div>

            <label htmlFor="auth-password">Senha</label>
            <div className="auth-field">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="auth-password"
                name="password"
                type={reveal ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                enterKeyHint="go"
                placeholder={mode === "signin" ? "sua senha" : "mínimo de 8 caracteres"}
                value={password}
                aria-invalid={!!error}
                aria-describedby={error ? "auth-error" : undefined}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
              <button
                type="button"
                className="auth-reveal"
                aria-label={reveal ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={reveal}
                onClick={() => setReveal((current) => !current)}
              >
                {reveal ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>

            {error && (
              <p id="auth-error" className="auth-error" role="alert">
                {error}
              </p>
            )}

            <button
              className="button primary auth-submit"
              type="submit"
              disabled={pending}
            >
              {pending ? "Abrindo…" : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

/** Shown while the session cookie is being checked; avoids a login flash. */
export function AuthBoot() {
  return (
    <main className="auth-boot" aria-busy="true">
      <Logo />
      <p role="status">Abrindo sua biblioteca…</p>
    </main>
  );
}
