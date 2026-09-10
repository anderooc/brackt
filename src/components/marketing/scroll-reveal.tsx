"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Extra delay after the element enters the viewport (ms). */
  delayMs?: number;
  as?: ElementType;
  /** Fraction of the element that must be visible (0–1). */
  threshold?: number;
};

/**
 * One-shot scroll entrance for marketing lists. Content stays visible without
 * JS and under prefers-reduced-motion; motion-safe browsers only hide
 * off-screen items after mount, then ease them in once.
 */
export function ScrollReveal({
  children,
  className,
  delayMs = 0,
  as: Comp = "div",
  threshold = 0.2,
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) {
      setReady(true);
      setRevealed(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    const alreadyVisible =
      rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.05;

    setReady(true);
    if (alreadyVisible) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Comp
      ref={ref}
      className={cn("marketing-reveal", className)}
      data-reveal-ready={ready && !revealed ? true : undefined}
      data-revealed={revealed ? true : undefined}
      style={
        {
          "--reveal-delay": `${delayMs}ms`,
        } as CSSProperties
      }
    >
      {children}
    </Comp>
  );
}
