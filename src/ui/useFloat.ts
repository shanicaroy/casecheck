"use client";

import { useEffect, type RefObject } from "react";

/**
 * The reference drives the mark's float with script so it moves in every
 * environment: translateY between -10 and +6px on a 3.6s sine, and the glow
 * opacity between 0.5 and 0.85 through --glow-o. Off under reduced motion.
 */
export function useFloat(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.style.animation = "none";
    el.style.opacity = "1";
    const period = 3600;
    let raf = 0;
    const loop = (ts: number) => {
      const t = (ts % period) / period;
      const phase = Math.sin(t * Math.PI * 2);
      el.style.transform = `translateY(${(phase * 8 - 2).toFixed(2)}px)`;
      document.documentElement.style.setProperty("--glow-o", (0.5 + 0.35 * (0.5 + 0.5 * phase)).toFixed(3));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty("--glow-o");
    };
  }, [ref]);
}
