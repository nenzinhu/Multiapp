"use client";

import * as React from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

import { prefersReducedMotion } from "@/lib/animations";

gsap.registerPlugin(useGSAP);

type AnimatedTextProps = {
  text: string;
  className?: string;
  /** Replays the entrance when the active tab changes. */
  active?: boolean;
  /** Adds the pointer wave used by the sidebar tabs. */
  interactive?: boolean;
};

/**
 * Short-label text split into words and characters so GSAP can animate the
 * tab copy itself. The visible layer is decorative (aria-hidden) and the
 * accessible name comes from the visually hidden copy, so screen readers and
 * the browser's accessible name calculation always receive the full string.
 */
export function AnimatedText({
  text,
  className = "",
  active = false,
  interactive = false,
}: AnimatedTextProps) {
  const scope = React.useRef<HTMLSpanElement>(null);

  useGSAP(
    () => {
      const chars = scope.current?.querySelectorAll<HTMLElement>(".tab-char");
      if (!chars?.length || prefersReducedMotion()) return;
      gsap.fromTo(
        chars,
        { yPercent: 120, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: 0.42,
          ease: "power3.out",
          stagger: 0.016,
          overwrite: "auto",
        },
      );
    },
    { dependencies: [text, active], scope },
  );

  function wave() {
    if (!interactive || prefersReducedMotion()) return;
    const chars = scope.current?.querySelectorAll<HTMLElement>(".tab-char");
    if (!chars?.length) return;
    gsap
      .timeline({ defaults: { overwrite: "auto" } })
      .to(chars, {
        yPercent: -22,
        duration: 0.16,
        ease: "power2.out",
        stagger: { each: 0.013, from: "start" },
      })
      .to(chars, {
        yPercent: 0,
        duration: 0.36,
        ease: "elastic.out(1, 0.55)",
        stagger: { each: 0.008, from: "end" },
      });
  }

  const words = text.split(/\s+/).filter(Boolean);

  return (
    <>
      <span
        ref={scope}
        className={`tab-label ${className}`.trim()}
        aria-hidden="true"
        onPointerEnter={wave}
      >
        {words.map((word, wordIndex) => (
          <span className="tab-word" key={`${word}-${wordIndex}`}>
            {Array.from(word).map((char, charIndex) => (
              <span className="tab-char" key={`${char}-${charIndex}`}>
                {char}
              </span>
            ))}
            {wordIndex < words.length - 1 && <span className="tab-space" />}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
