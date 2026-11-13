"use client";

import gsap from "gsap";
import { useLayoutEffect, type RefObject } from "react";

type PanelEntranceOptions = {
  /** CSS selector for the children that enter, inside the panel. */
  selector?: string;
  /** Runs only when true; use it to wait for the panel content. */
  active?: boolean;
  /** Distance in px the items travel upwards. */
  y?: number;
  stagger?: number;
  duration?: number;
  delay?: number;
};

/**
 * GSAP entrance for a panel: the marked children fade in and slide up with a
 * short stagger. It is skipped entirely when the visitor prefers reduced
 * motion, and every run ends with the elements back to their natural styles,
 * so no transform is left behind for hover or layout effects to fight.
 */
export function usePanelEntrance(
  ref: RefObject<HTMLElement | null>,
  {
    selector = "[data-panel-item]",
    active = true,
    y = 16,
    stagger = 0.07,
    duration = 0.55,
    delay = 0,
  }: PanelEntranceOptions = {},
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = gsap.utils.toArray<HTMLElement>(selector, root);
    if (!targets.length) return;

    const context = gsap.context(() => {
      gsap.set(targets, { opacity: 0, y });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        delay,
        ease: "power3.out",
        overwrite: "auto",
        clearProps: "opacity,transform",
      });
    }, root);

    return () => context.revert();
  }, [ref, selector, active, y, stagger, duration, delay]);
}
