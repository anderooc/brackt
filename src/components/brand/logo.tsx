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

import type { SVGProps } from "react";
import { WORDMARK_PATH } from "./wordmark-path";

/**
 * `brand` paints the court in --logo-court and the net in --logo-net (both
 * theme-aware). `mono` paints everything in currentColor, for reversed or
 * single-ink placements.
 */
type LogoTone = "brand" | "mono";

type LogoProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  tone?: LogoTone;
  title?: string;
};

function inks(tone: LogoTone) {
  return tone === "mono"
    ? { court: "currentColor", net: "currentColor" }
    : { court: "var(--logo-court)", net: "var(--logo-net)" };
}

const LOGO_VIEWBOX = "4.8 15.8 464.4 96.4";
/** The Figma export sets the wordmark 12 units high; this centres its
 * ascender-to-baseline span on the court box (no letters descend). */
const WORDMARK_TRANSFORM = "translate(0 12)";

const SYMBOL_STROKES = [
  { d: "M8.96 30.72H119.04V97.28H8.96V30.72Z", width: "8.17", ink: "court" },
  { d: "M38.4 30.72V97.28M89.6 30.72V97.28", width: "4.085", ink: "court" },
  { d: "M64 19.2V108.8", width: "8.17", ink: "net" },
  { d: "M55.04 19.2H72.96M55.04 108.8H72.96", width: "6.81", ink: "net" },
] as const;

function SymbolPaths({ tone }: { tone: LogoTone }) {
  const colors = inks(tone);
  return (
    <>
      {SYMBOL_STROKES.map((s) => (
        <path key={s.d} d={s.d} strokeWidth={s.width} stroke={colors[s.ink]} />
      ))}
    </>
  );
}

/**
 * Standalone lockup markup with literal colors, for renderers that can't
 * resolve CSS variables (OG images, emails).
 */
export function bracktLogoSvgMarkup(court = "#315CA8", net = "#C92F45") {
  const colors = { court, net };
  const strokes = SYMBOL_STROKES.map(
    (s) => `<path d="${s.d}" stroke-width="${s.width}" stroke="${colors[s.ink]}"/>`
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${LOGO_VIEWBOX}" fill="none">${strokes}<path d="${WORDMARK_PATH}" fill="${court}" transform="${WORDMARK_TRANSFORM}"/></svg>`;
}

/** Court-and-net symbol on its own: favicons, avatars, compact chrome. */
export function BracktSymbol({ tone = "brand", title, ...props }: LogoProps) {
  return (
    <svg
      viewBox="4.8 15.8 118.4 96.4"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <SymbolPaths tone={tone} />
    </svg>
  );
}

/** Horizontal lockup: symbol + "brackt" wordmark. */
export function BracktLogo({ tone = "brand", title = "brackt", ...props }: LogoProps) {
  return (
    <svg viewBox={LOGO_VIEWBOX} fill="none" role="img" {...props}>
      <title>{title}</title>
      <SymbolPaths tone={tone} />
      <path d={WORDMARK_PATH} fill={inks(tone).court} transform={WORDMARK_TRANSFORM} />
    </svg>
  );
}
