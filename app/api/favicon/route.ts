import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Stateless favicon proxy used by the link editor.
 *
 * The browser cannot turn a third-party favicon into a stored image because
 * those endpoints do not send CORS headers. This route reads the icon on the
 * server, in the visitor's own request, and returns the bytes so the client can
 * encode them into the link. Nothing is stored here: no database, no record
 * cache, no credentials.
 *
 * The endpoint reflects arbitrary URLs, so it only talks to public hosts and
 * refuses loopback, link-local and private ranges (SSRF guard).
 */
export const dynamic = "force-dynamic";

const MAX_ICON_BYTES = 512 * 1024;
const MAX_HTML_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 4000;
const TOTAL_BUDGET_MS = 8000;
const MAX_REDIRECTS = 2;

const TEXT_HEADERS = { "content-type": "text/plain; charset=utf-8" };
const FOUND_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control":
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
};
const MISSING_HEADERS = {
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=300",
};

/** Normalizes the `domain` parameter into a bare public hostname or null. */
export function hostFromDomain(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/\.$/, "");
  if (!raw || raw.length > 253) return null;

  let host: string;
  try {
    const url = new URL(`https://${raw}/`);
    if (url.username || url.password || url.port || url.pathname !== "/")
      return null;
    host = url.hostname;
  } catch {
    return null;
  }

  if (!host || isIP(host) || host.includes(":") || !host.includes("."))
    return null;
  return host;
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  )
    return true;
  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a === 255
  );
}

function isPrivateIpv6(address: string): boolean {
  const value = address.toLowerCase().replace(/%.*$/, "");
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("2001:db8")) return true;
  if (value.startsWith("::ffff:")) return isPrivateIpv4(value.slice(7));
  return false;
}

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function isPublicHost(hostname: string): Promise<boolean> {
  if (isIP(hostname)) return false;
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return (
      addresses.length > 0 &&
      addresses.every((entry) => !isPrivateAddress(entry.address))
    );
  } catch {
    return false;
  }
}


type FetchResult =
  | { kind: "redirect"; location: string }
  | { kind: "body"; contentType: string; body: ArrayBuffer };

/**
 * Reads at most `maxBytes` from a response. HTML is truncated (the icons live
 * in `<head>`, so a partial document is enough); images over the cap are
 * discarded instead of partially decoded.
 */
async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  truncate: boolean,
): Promise<ArrayBuffer | null> {
  if (!stream) return new ArrayBuffer(0);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      if (total + value.byteLength > maxBytes) {
        if (!truncate) {
          await reader.cancel();
          return null;
        }
        chunks.push(value.subarray(0, maxBytes - total));
        total = maxBytes;
        await reader.cancel();
        break;
      }
      chunks.push(value);
      total += value.byteLength;
    }
  } catch {
    return null;
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

async function requestOnce(
  url: string,
  headerAccept: string,
  timeoutMs: number,
  maxBytes: number,
  truncate: boolean,
): Promise<FetchResult | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: headerAccept,
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        "user-agent":
          "Mozilla/5.0 (compatible; MultiappFavicon/1.0; +favicon proxy)",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      return location ? { kind: "redirect", location } : null;
    }
    if (!response.ok) return null;

    const body = await readCapped(response.body, maxBytes, truncate);
    if (!body) return null;
    return {
      kind: "body",
      contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
      body,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetches a public URL, following only policy-checked redirects, with a cap. */
async function fetchLimited(
  url: string,
  accept: string,
  maxBytes: number,
  deadline: number,
  truncate: boolean,
): Promise<FetchResult | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining < 500) return null;

    let target: URL;
    try {
      target = new URL(current);
    } catch {
      return null;
    }
    if (target.protocol !== "https:" && target.protocol !== "http:") return null;
    if (target.username || target.password) return null;
    if (!(await isPublicHost(target.hostname))) return null;

    const result = await requestOnce(
      target.href,
      accept,
      Math.min(REQUEST_TIMEOUT_MS, remaining),
      maxBytes,
      truncate,
    );
    if (!result) return null;
    if (result.kind === "redirect") {
      try {
        current = new URL(result.location, target).href;
      } catch {
        return null;
      }
      continue;
    }
    if (!result.body.byteLength) return null;
    return result;
  }
  return null;
}


/** Reads `<link rel="icon">` style tags, preferring the larger touch icons. */
export function declaredIcons(html: string, pageUrl: string): string[] {
  const touch: string[] = [];
  const other: string[] = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (/rel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1] ?? "").toLowerCase();
    if (!/\bicon\b/.test(rel) || rel.includes("mask-icon")) continue;

    const href =
      /href\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
      /href\s*=\s*([^\s>]+)/i.exec(tag)?.[1];
    if (!href) continue;

    try {
      const resolved = new URL(href.trim().replace(/&amp;/g, "&"), pageUrl);
      if (resolved.protocol !== "https:" && resolved.protocol !== "http:")
        continue;
      if (resolved.username || resolved.password) continue;
      (rel.includes("apple-touch-icon") ? touch : other).push(resolved.href);
    } catch {
      /* Ignore malformed href values. */
    }
  }

  return [...new Set([...touch, ...other])];
}

export async function GET(request: Request) {
  const host = hostFromDomain(new URL(request.url).searchParams.get("domain"));
  if (!host)
    return new Response("Informe um domínio público, como exemplo.com.", {
      status: 400,
      headers: TEXT_HEADERS,
    });

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const pageUrl = `https://${host}/`;
  const candidates: string[] = [];

  const page = await fetchLimited(
    pageUrl,
    "text/html,application/xhtml+xml",
    MAX_HTML_BYTES,
    deadline,
    true,
  );
  if (page && page.kind === "body" && page.contentType.includes("html")) {
    const html = new TextDecoder().decode(page.body);
    candidates.push(...declaredIcons(html, pageUrl));
  }
  candidates.push(`${pageUrl}favicon.ico`);

  for (const candidate of candidates.slice(0, 5)) {
    const image = await fetchLimited(
      candidate,
      "image/avif,image/webp,image/png,image/svg+xml,image/x-icon,image/*;q=0.8",
      MAX_ICON_BYTES,
      deadline,
      false,
    );
    if (!image || image.kind !== "body") continue;
    if (!image.contentType.startsWith("image/")) continue;

    return new Response(image.body, {
      headers: {
        ...FOUND_HEADERS,
        "content-type": image.contentType,
        "content-length": String(image.body.byteLength),
        "cross-origin-resource-policy": "cross-origin",
      },
    });
  }

  return new Response("Favicon não encontrado.", {
    status: 404,
    headers: MISSING_HEADERS,
  });
}
