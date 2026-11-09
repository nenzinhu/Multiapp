"use client";

import { animate, stagger, utils } from "animejs";

/** True when the visitor asked the system to reduce motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type AnimationTargets = Element | Element[] | NodeListOf<Element>;

/** Fades a list of elements in, one after the other. */
export function entrance(
  targets: AnimationTargets,
  options?: { delay?: number; distance?: number; duration?: number },
): void {
  const elements = Array.isArray(targets)
    ? targets
    : Array.from(targets as Iterable<Element>);
  if (!elements.length || prefersReducedMotion()) return;
  utils.set(elements, { opacity: 0, y: options?.distance ?? 12 });
  animate(elements, {
    opacity: 1,
    y: 0,
    duration: options?.duration ?? 420,
    ease: "outQuad",
    delay: stagger(options?.delay ?? 35),
  });
}

/** Short shake used as feedback for a wrong or invalid value. */
export function shake(element: Element | null | undefined): void {
  if (!element || prefersReducedMotion()) return;
  animate(element, {
    x: [0, -7, 7, -4, 4, 0],
    duration: 420,
    ease: "outQuad",
  });
}

/** Small pop used when a favorite is toggled. */
export function pop(element: Element | null | undefined): void {
  if (!element || prefersReducedMotion()) return;
  animate(element, {
    scale: [1, 1.4, 1],
    duration: 420,
    ease: "outBack",
  });
}

/** Last animated value per counter key, so numbers do not restart on remount. */
const lastValues = new Map<string, number>();

/** Counts a number up to its new value. */
export function countTo(
  element: HTMLElement | null | undefined,
  to: number,
  key?: string,
  duration = 480,
): void {
  if (!element) return;
  const remembered = key ? lastValues.get(key) : undefined;
  const parsed = Number(element.textContent?.replace(/\D/g, "")) || 0;
  const from = remembered ?? parsed;
  if (key) lastValues.set(key, to);
  if (prefersReducedMotion() || from === to) {
    element.textContent = String(to);
    return;
  }
  const state = { value: from };
  animate(state, {
    value: to,
    duration,
    ease: "outQuad",
    onUpdate: () => {
      element.textContent = String(Math.round(state.value));
    },
  });
}
