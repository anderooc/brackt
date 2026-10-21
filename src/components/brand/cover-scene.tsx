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

/**
 * Tournament cover scene: the welcome-hero court, net, and ball, cropped
 * tight. Shapes name an ink instead of a color so the same geometry renders
 * theme-aware on the web and with literal hexes in OG images.
 */
type Ink = "court" | "net" | "line" | "wash" | "mist" | "paper" | "chalk";

type Shape = {
  d: string;
  fill?: Ink;
  fillOpacity?: number;
  stroke?: Ink;
  strokeWidth?: number;
  transform?: string;
};

export const COVER_SCENE_VIEWBOX = "830 40 600 530";
export const COVER_SCENE_ASPECT = 600 / 530;

const SHAPES: Shape[] = [
  // Court shadow, surface, and lines.
  { d: "M846 385L1182 265L1406 425L1070 545L846 385Z", fill: "wash" },
  { d: "M846 365L1182 245L1406 405L1070 525L846 365Z", fill: "court" },
  {
    d: "M975 336L1175 470M1077 300L1277 434M875 372L1177 264L1377 398L1075 506L875 372Z",
    stroke: "chalk",
    strokeWidth: 3,
  },
  // Net fabric, mesh, posts, and tape.
  {
    // A faint tint, not an opaque fill, so the court shows through the mesh.
    d: "M1014 225L1238 385V443L1014 283V225Z",
    fill: "chalk",
    fillOpacity: 0.14,
    stroke: "line",
    strokeWidth: 2,
  },
  {
    // Same mesh as `netMesh` in scripts/generate-brand-art.mjs: rows parallel
    // to the tape, columns starting on its centreline.
    d: "M1014 244.33L1238 404.33M1014 263.67L1238 423.67M1042 245V303M1070 265V323M1098 285V343M1126 305V363M1154 325V383M1182 345V403M1210 365V423",
    stroke: "line",
    strokeWidth: 2,
  },
  { d: "M1014 215V307M1238 375V457M1014 225L1238 385", stroke: "net", strokeWidth: 6 },
  // Ball arcing off the net, with volleyball seams.
  { d: "M1130 250C1130 125 1200 80 1310 80", stroke: "line", strokeWidth: 3 },
  {
    d: "M1334.5 81C1334.5 94.531 1323.53 105.5 1310 105.5C1296.47 105.5 1285.5 94.531 1285.5 81C1285.5 67.469 1296.47 56.5 1310 56.5C1323.53 56.5 1334.5 67.469 1334.5 81Z",
    fill: "paper",
    stroke: "court",
    strokeWidth: 3,
  },
  {
    // Panel seams from Lucide's `volleyball` icon (ISC), scaled onto the ball.
    d: "M11.1 7.1a16.55 16.55 0 0 1 10.9 4M12 12a12.6 12.6 0 0 1-8.7 5M16.8 13.6a16.55 16.55 0 0 1-9 7.5M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5",
    stroke: "court",
    strokeWidth: 1.1,
    transform: "translate(1280.6 51.6) scale(2.45)",
  },
];

const CSS_INKS: Record<Ink, string> = {
  court: "var(--art-court)",
  net: "var(--art-net)",
  line: "var(--art-line)",
  wash: "var(--art-wash)",
  mist: "var(--art-mist)",
  paper: "var(--art-paper)",
  chalk: "var(--art-chalk)",
};

const HEX_INKS: Record<Ink, string> = {
  court: "#315CA8",
  net: "#C92F45",
  line: "#B9CDE9",
  wash: "#E1EAF7",
  mist: "#EFF4FB",
  paper: "#FFFFFF",
  chalk: "#FFFFFF",
};

export function CoverScene(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox={COVER_SCENE_VIEWBOX}
      fill="none"
      aria-hidden
      focusable="false"
      {...props}
    >
      {SHAPES.map((s) => (
        <path
          key={s.d}
          d={s.d}
          fill={s.fill ? CSS_INKS[s.fill] : undefined}
          fillOpacity={s.fillOpacity}
          stroke={s.stroke ? CSS_INKS[s.stroke] : undefined}
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
          transform={s.transform}
        />
      ))}
    </svg>
  );
}

/** Literal-color markup for renderers without CSS variables (OG images). */
export function coverSceneSvgMarkup() {
  const paths = SHAPES.map((s) => {
    const attrs = [
      `d="${s.d}"`,
      `fill="${s.fill ? HEX_INKS[s.fill] : "none"}"`,
      s.fillOpacity ? `fill-opacity="${s.fillOpacity}"` : "",
      s.stroke ? `stroke="${HEX_INKS[s.stroke]}"` : "",
      s.strokeWidth ? `stroke-width="${s.strokeWidth}"` : "",
      s.transform ? `transform="${s.transform}"` : "",
      'stroke-linecap="round"',
    ].join(" ");
    return `<path ${attrs}/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${COVER_SCENE_VIEWBOX}" fill="none">${paths}</svg>`;
}
