/**
 * Qual credencial combina com qual site.
 *
 * Regra: mesmo domínio registrável — o `www.` e os subdomínios não mudam nada
 * (`login.exemplo.com.br` × `www.exemplo.com.br` herdam a mesma credencial), mas
 * domínios diferentes não se misturam: `exemplo.com.malicioso.net` nunca recebe
 * a senha de `exemplo.com`. Endereço de IP e `localhost` só combinam exatamente.
 */

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Segundo nível usado por vários países (`com.br`, `co.uk`, `com.ar`). Sem a
 * lista completa de sufixos públicos, este conjunto evita que `banco.co.ao`
 * herde a credencial de `outro.co.ao`.
 */
const SHARED_SECOND_LEVEL = new Set([
  "ac", "art", "blog", "co", "com", "edu", "go", "gov", "in", "mil", "ne",
  "net", "nom", "or", "org", "sch", "web",
]);

/** Host de uma URL colada, sem `www.`, minúsculo e sem ponto final. */
export function siteHost(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname
      .toLowerCase()
      .replace(/\.$/, "")
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBareHost(host) {
  return IPV4.test(host) || host.includes(":") || host === "localhost";
}

/** `app.exemplo.com.br` → `exemplo.com.br`; IP e localhost ficam iguais. */
export function registrableDomain(host) {
  if (!host || isBareHost(host)) return host;
  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) return host;
  const last = labels[labels.length - 1];
  const second = labels[labels.length - 2];
  const shared = last.length <= 3 && SHARED_SECOND_LEVEL.has(second);
  return labels.slice(shared ? -3 : -2).join(".");
}

/** A credencial serve para a página? */
export function hostMatches(recordUrl, pageUrl) {
  const record = siteHost(recordUrl);
  const page = siteHost(pageUrl);
  if (!record || !page) return false;
  if (record === page) return true;
  if (isBareHost(record) || isBareHost(page)) return false;
  return registrableDomain(record) === registrableDomain(page);
}

/**
 * Credenciais de site que servem para a página, na ordem em que devem ser
 * oferecidas: favoritas primeiro, depois as editadas por último.
 */
export function findSiteLogins(records, pageUrl) {
  if (!Array.isArray(records) || !records.length) return [];
  const page = siteHost(pageUrl);
  if (!page) return [];
  return records
    .filter(
      (record) =>
        record &&
        record.kind !== "api" &&
        Boolean(record.username) &&
        Boolean(record.secret) &&
        hostMatches(record.url, pageUrl),
    )
    .sort((left, right) => {
      if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;
      const leftExact = siteHost(left.url) === page ? 0 : 1;
      const rightExact = siteHost(right.url) === page ? 0 : 1;
      if (leftExact !== rightExact) return leftExact - rightExact;
      return (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
    });
}

/** Resumo sem segredo, para a interface. */
export function describeLogin(record) {
  return {
    id: record.id,
    title: record.title,
    username: record.username,
    domain: siteHost(record.url),
    favorite: record.favorite === true,
  };
}
