import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Extensão do Chrome — Multiapp Cofre",
  description:
    "Instale o Multiapp Cofre no Chrome para as senhas do cofre serem preenchidas automaticamente nos sites.",
};

/**
 * Instruções de instalação manual. A extensão é servida como ZIP porque ainda
 * não está publicada na Chrome Web Store: o Chrome carrega a pasta extraída em
 * "Carregar sem compactação".
 */
export default function ExtensionPage() {
  return (
    <main className="setup-shell">
      <section
        className="setup-card extension-card"
        aria-labelledby="extension-title"
      >
        <Logo />
        <p className="eyebrow">EXTENSÃO DO CHROME</p>
        <h1 id="extension-title">Suas senhas, preenchidas sozinhas</h1>
        <p className="extension-lead">
          A extensão abre o mesmo cofre criptografado deste navegador e preenche
          usuário e senha no site certo. A senha mestra é digitada no ícone da
          extensão e não é guardada: o cofre aberto fica só na memória do Chrome
          até você bloquear ou fechar o navegador.
        </p>

        <div className="extension-actions">
          <a
            className="button primary"
            href="/extension/multiapp-cofre.zip"
            download
          >
            Baixar a extensão (.zip)
          </a>
          <Link className="button secondary" href="/">
            Voltar ao Multiapp
          </Link>
        </div>
        <p className="extension-meta">
          Versão 1.0.0 · Chrome, Edge, Brave e Opera (Manifest V3)
        </p>

        <ol className="setup-steps">
          <li>
            Baixe o <code>.zip</code> e extraia a pasta{" "}
            <code>multiapp-cofre</code> (botão direito → Extrair tudo). Guarde
            essa pasta: o Chrome lê a extensão dela.
          </li>
          <li>
            Abra <code>chrome://extensions</code> no Chrome.
          </li>
          <li>
            Ligue o <strong>Modo do desenvolvedor</strong>, no canto superior
            direito.
          </li>
          <li>
            Clique em <strong>Carregar sem compactação</strong> e escolha a pasta{" "}
            <code>multiapp-cofre</code>.
          </li>
          <li>
            Fixe o ícone: quebra-cabeça → alfinete ao lado de{" "}
            <strong>Multiapp Cofre</strong>.
          </li>
          <li>
            Abra o Multiapp, desbloqueie o cofre uma vez e clique no ícone da
            extensão para digitar a senha mestra.
          </li>
          <li>
            Abra o site: usuário e senha entram sozinhos. O selo do Multiapp no
            canto avisa quando preencheu.
          </li>
        </ol>

        <div className="extension-note">
          <strong>Por que “modo do desenvolvedor”?</strong> A extensão ainda não
          está publicada na Chrome Web Store, então a instalação é manual. O
          código é o da pasta <code>extension/</code> deste projeto: nada é
          enviado a um servidor e o envelope do cofre é lido direto do seu
          navegador.
        </div>
        <div className="extension-note">
          <strong>Antes de instalar:</strong> a extensão usa o cofre que já
          existe neste navegador. Se ainda não tem nenhum, abra{" "}
          <Link href="/">o Multiapp</Link>, guarde uma credencial de site e volte
          aqui.
        </div>
      </section>
    </main>
  );
}
