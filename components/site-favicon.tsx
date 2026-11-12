"use client";

import * as React from "react";

import { isIconDataUrl } from "@/lib/collection";

type SiteFaviconProps = {
  /** Any saved or pasted URL. Invalid values fall back to the letter. */
  url: string;
  /** Name used for the letter fallback. */
  name: string;
  /** Icon included with the link (favicon captured or image uploaded). */
  icon?: string;
  /** Overrides the CSS size; omit to let the container decide. */
  size?: number;
  className?: string;
  /** Loads the image immediately (used by the live capture preview). */
  eager?: boolean;
};

function hostnameOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

/**
 * Icon of an app, in order of preference: the image stored with the link, the
 * two public provider endpoints (Google and DuckDuckGo, hostname only) and
 * finally the first letter. A stored icon that fails to decode falls back to
 * the providers instead of leaving an empty square.
 */
export function SiteFavicon({
  url,
  name,
  icon,
  size,
  className = "",
  eager = false,
}: SiteFaviconProps) {
  const host = React.useMemo(() => hostnameOf(url), [url]);
  const [attempt, setAttempt] = React.useState({ host, index: 0 });
  const [brokenIcon, setBrokenIcon] = React.useState<string | null>(null);
  const index = attempt.host === host ? attempt.index : 0;

  const custom =
    isIconDataUrl(icon) && icon !== brokenIcon ? icon : null;

  const sources = custom
    ? [custom]
    : host
      ? [
          `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
          `https://icons.duckduckgo.com/ip3/${host}.ico`,
        ]
      : [];

  const letter = (name.trim().charAt(0) || host?.charAt(0) || "?").toUpperCase();
  const failed = index >= sources.length;
  const pixelSize = size ?? 64;

  return (
    <span
      className={`favicon site-favicon ${custom ? "is-custom" : ""} ${className}`
        .replace(/\s+/g, " ")
        .trim()}
      style={{
        ...(size ? { width: size, height: size } : {}),
        ...(size ? { fontSize: Math.max(10, Math.round(size * 0.48)) } : {}),
      }}
    >
      {failed ? (
        <span aria-hidden="true">{letter}</span>
      ) : (
        <img
          key={sources[index]}
          src={sources[index]}
          alt=""
          width={pixelSize}
          height={pixelSize}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() =>
            custom
              ? setBrokenIcon(custom)
              : setAttempt({ host, index: index + 1 })
          }
        />
      )}
    </span>
  );
}
