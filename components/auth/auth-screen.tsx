"use client";

import {
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Logo } from "@/components/logo";
import { ApiError, signIn, signUp, type AccountUser } from "@/lib/account";

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
      <section className="auth-story" aria-labelledby="auth-story-title">
        <div className="auth-story-top">
          <Logo />
        </div>
        <div className="auth-story-body">
          <p className="auth-eyebrow">SEU ESPAÇO EM QUALQUER APARELHO</p>
          <h1 id="auth-story-title">
            Todos os seus apps.
            <br />
            <span>Uma senha só.</span>
          </h1>
          <p className="auth-lede">
            Entre com usuário e senha e a sua biblioteca abre inteira — no
            computador, no tablet ou no celular.
          </p>
          <ul className="auth-points">
            <li>
              <MonitorSmartphone size={19} aria-hidden="true" />
              <div>
                <strong>Mesma coleção em todo lugar</strong>
                <span>O que você salva aqui aparece nos outros aparelhos.</span>
              </div>
            </li>
            <li>
              <ShieldCheck size={19} aria-hidden="true" />
              <div>
                <strong>Sua senha protegida</strong>
                <span>Ela é guardada embaralhada (scrypt) e nunca em texto.</span>
              </div>
            </li>
            <li>
              <KeyRound size={19} aria-hidden="true" />
              <div>
                <strong>Favoritos e categorias juntos</strong>
                <span>Sua organização acompanha a sua conta.</span>
              </div>
            </li>
          </ul>
        </div>
        <p className="auth-story-foot">Menos abas. Mais foco.</p>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Logo />
          </div>
          <div className="auth-tabs" role="group" aria-label="Entrar ou criar conta">
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

          <header className="auth-head">
            <h2 id="auth-title">
              {mode === "signin" ? "Acesse sua biblioteca" : "Crie sua conta"}
            </h2>
            <p>
              {mode === "signin"
                ? "Use o usuário e a senha que você já cadastrou."
                : "Escolha um usuário e uma senha para os seus apps."}
            </p>
          </header>

          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}

          <form onSubmit={submit} noValidate>
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
                placeholder={
                  mode === "signin" ? "sua senha" : "mínimo de 8 caracteres"
                }
                value={password}
                aria-invalid={!!error}
                aria-describedby={error ? "auth-error" : "auth-hint"}
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

            <p id="auth-hint" className="auth-hint">
              {mode === "signin"
                ? "A mesma conta abre sua coleção em qualquer aparelho."
                : "De 8 a 200 caracteres. Evite a senha de outros sites."}
            </p>

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
              {pending
                ? "Abrindo…"
                : mode === "signin"
                  ? "Entrar e ver meus apps"
                  : "Criar conta e entrar"}
            </button>
          </form>

          <p className="auth-switch">
            {mode === "signin" ? (
              <>
                Ainda não tem conta?{" "}
                <button type="button" onClick={() => switchMode("signup")}>
                  Criar agora
                </button>
              </>
            ) : (
              <>
                Já tem conta?{" "}
                <button type="button" onClick={() => switchMode("signin")}>
                  Entrar
                </button>
              </>
            )}
          </p>
        </div>
        <p className="auth-privacy">
          Seus apps ficam na sua conta, no servidor — não neste navegador. O
          cofre de senhas continua criptografado e local.
        </p>
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
