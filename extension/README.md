# Extensão do Chrome — Multiapp Cofre

Preenche o login dos sites com a credencial do cofre Multiapp. Nada sai deste
navegador: o envelope cifrado é lido do próprio app e a senha mestra nunca é
guardada.

## Instalar (Chrome, Edge, Brave, Opera)

1. Baixe `multiapp-cofre.zip` (também disponível em `/extensao` dentro do app) e
   extraia a pasta `multiapp-cofre`.
2. Abra `chrome://extensions`.
3. Ligue o **Modo do desenvolvedor**.
4. **Carregar sem compactação** → escolha a pasta extraída.
5. Abra o Multiapp, desbloqueie o cofre uma vez (isso entrega o envelope à
   extensão) e clique no ícone da extensão para digitar a senha mestra.

Depois disso, cada site com credencial guardada é preenchido sozinho; o selo no
canto mostra o que foi preenchido e permite escolher entre várias credenciais.

## Como funciona

| Arquivo | Papel |
| --- | --- |
| `background.js` | service worker: decifra o cofre, casa host com credencial e responde às abas |
| `content.js` | acha o formulário, preenche e desenha o selo (shadow DOM) |
| `popup.html`/`popup.js` | abrir e bloquear o cofre, ligar/desligar o preenchimento |
| `lib/vault-crypto.js` | AES-GCM-256 + PBKDF2-SHA256 210.000, igual a `lib/vault.ts` |
| `lib/site-match.js` | mesmo domínio registrável, sem `www.`, IP e `localhost` exatos |

- A chave derivada fica em `chrome.storage.session` (memória, apagada ao fechar o
  navegador) e só o worker a lê. O texto decifrado não é gravado.
- O cofre é lido do `localStorage` de uma página do Multiapp, que se identifica
  com `<meta name="multiapp-vault">`. O servidor do app não é consultado.
- Auto-bloqueio padrão de 30 minutos; "Enviar o formulário" vem desligado.

## Testes

```bash
cd ..            # raiz do projeto
npm test         # inclui tests/extension.test.mjs (cripto + casamento de domínio)
npm run ext:zip  # refaz o ZIP servido em /extensao
node scripts/verify-extension.mjs   # ponta a ponta num Chromium (CDP)
```
