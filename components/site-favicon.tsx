"use client";

import * as React from "react";

type SiteFaviconProps = {
  /** Any saved or pasted URL. Invalid values fall back to the letter. */
  url: string;
  /** Name used for the letter fallback. */
  name: string;
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
 * Favicon with a two-step provider fallback: Google's public endpoint and
 * DuckDuckGo's icon cache. Only the hostname is sent, never the full saved
 * URL. When both sources fail the component renders the first letter.
 */
export function SiteFavicon({
  url,
  name,
  size,
  className = "",
  eager = false,
}: SiteFaviconProps) {
  const host = React.useMemo(() => hostnameOf(url), [url]);
  const [attempt, setAttempt] = React.useState({ host, index: 0 });
  const index = attempt.host === host ? attempt.index : 0;

  const sources = host
    ? [
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
        `https://icons.duckduckgo.com/ip3/${host}.ico`,
      ]
    : [];

  const letter = (name.trim().charAt(0) || host?.charAt(0) || "?").toUpperCase();
  const failed = !host || index >= sources.length;
  const pixelSize = size ?? 64;

  return (
    <span
      className={`favicon site-favicon ${className}`.trim()}
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
          onError={() => setAttempt({ host, index: index + 1 })}
        />
      )}
    </span>
  );
}
