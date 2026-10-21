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

/**
 * Converts the "Center Court" Figma SVG exports into theme-aware React
 * components. Brand hexes are swapped for `--art-*` CSS variables (defined in
 * globals.css) so the same artwork works in light and dark themes.
 *
 * Usage: node scripts/generate-brand-art.mjs [path/to/export-folder]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SOURCE = process.argv[2] ?? "figma-mockups/Center Court ";
const OUT_ILLUSTRATIONS = "src/components/brand/illustrations.tsx";
const OUT_WORDMARK = "src/components/brand/wordmark-path.ts";

const ILLUSTRATIONS = {
  NoTeams: "brackt-empty-no-teams.svg",
  NoTournaments: "brackt-empty-no-tournaments.svg",
  NoMatches: "brackt-empty-no-matches.svg",
  NoResults: "brackt-empty-no-results.svg",
  ConnectionRecoverable: "brackt-connection-recoverable.svg",
  TournamentComplete: "brackt-tournament-complete.svg",
  OrganizeTournament: "brackt-onboarding-organize-tournament.svg",
  BringTeamsTogether: "brackt-onboarding-bring-teams-together.svg",
  FollowBracket: "brackt-onboarding-follow-bracket.svg",
  WelcomeHero: "brackt-web-welcome-hero.svg",
};

const NET_FABRIC_OPACITY = 0.14;

const PALETTE = {
  "#315ca8": "var(--art-court)",
  "#c92f45": "var(--art-net)",
  "#b9cde9": "var(--art-line)",
  "#e1eaf7": "var(--art-wash)",
  "#eff4fb": "var(--art-mist)",
};

function toJsxAttrs(markup) {
  return markup.replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, name) => {
    const camel = name.replace(/-([a-z])/g, (__, c) => c.toUpperCase());
    return ` ${camel}=`;
  });
}

/**
 * Net mesh drawn from the fabric outline: rows run parallel to the top tape
 * and columns start on the tape's centreline, so no strand pokes past the red.
 */
function netMesh(x0, y0, x1, y1, height, columns = 8, rows = 3) {
  const slope = (y1 - y0) / (x1 - x0);
  const r = (n) => Math.round(n * 100) / 100;
  const parts = [];
  for (let i = 1; i < rows; i++) {
    const dy = (height * i) / rows;
    parts.push(`M${x0} ${r(y0 + dy)}L${x1} ${r(y1 + dy)}`);
  }
  for (let i = 1; i < columns; i++) {
    const x = x0 + ((x1 - x0) * i) / columns;
    const top = y0 + slope * (x - x0);
    parts.push(`M${r(x)} ${r(top)}V${r(top + height)}`);
  }
  return parts.join("");
}

// Figma's mesh rows aren't parallel to the tape and its columns start above
// it; rebuild the mesh path that follows each net fabric outline.
function straightenNets(markup) {
  return markup.replace(
    /(<path d="M(\d+) (\d+)L(\d+) (\d+)V(\d+)L\d+ \d+V\d+Z" fill="#EFF4FB" stroke-width="2" stroke="#B9CDE9"\/>\n<path d=")[^"]+(" stroke-width="2" stroke="#B9CDE9"\/>)/g,
    (_match, head, x0, y0, x1, y1, bottom, tail) =>
      head + netMesh(+x0, +y0, +x1, +y1, +bottom - +y1) + tail
  );
}

function recolor(markup) {
  const [body, defs = ""] = markup.split("<defs>");
  let out = body;

  // Net fabric is the one mist-filled shape with a thin line stroke. Make it
  // a faint tint so the court shows through the mesh instead of the page.
  out = out.replace(
    /fill="#EFF4FB" stroke-width="2" stroke="#B9CDE9"/g,
    `fill="var(--art-chalk)" fill-opacity="${NET_FABRIC_OPACITY}" stroke-width="2" stroke="#B9CDE9"`
  );

  // White fills: on an outlined shape it's the page surface (a ball, a
  // panel); on a bare shape it's chalk drawn on court-blue.
  out = out.replace(/<(\w+)([^>]*?)fill="white"([^>]*?)(\/?)>/g, (_tag, el, a, b, close) => {
    const attrs = a + b;
    const token = /stroke=/.test(attrs) ? "var(--art-paper)" : "var(--art-chalk)";
    return `<${el}${a}fill="${token}"${b}${close}>`;
  });
  out = out.replace(/stroke="white"/g, 'stroke="var(--art-chalk)"');
  out = out.replace(/"(#[0-9a-fA-F]{6})"/g, (match, hex) => {
    const token = PALETTE[hex.toLowerCase()];
    return token ? `"${token}"` : match;
  });

  return defs ? `${out}<defs>${defs}` : out;
}

function convert(name, file) {
  let svg = readFileSync(join(SOURCE, file), "utf8").trim();
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1];
  const [, , width, height] = viewBox.split(" ").map(Number);

  let inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "").trim();

  // Figma paints a full-canvas white backdrop; drop it so the art sits on
  // whatever surface renders it. Only outside <defs>: an identical rect
  // there is a clip path's shape.
  const [drawing, defs] = inner.split("<defs>");
  inner =
    drawing.replace(
      new RegExp(`<rect width="${width}" height="${height}" fill="white"/>\\n?`),
      ""
    ) + (defs === undefined ? "" : `<defs>${defs}`);
  inner = recolor(straightenNets(inner));
  inner = inner.replace(/id="([^"]+)"/g, `id="${name}-$1"`);
  inner = inner.replace(/url\(#([^)]+)\)/g, `url(#${name}-$1)`);
  inner = toJsxAttrs(inner);

  const body = inner
    .split("\n")
    .map((line) => `      ${line}`)
    .join("\n");

  return `export function ${name}Illustration(props: ArtProps) {
  return (
    <svg viewBox="${viewBox}" fill="none" aria-hidden focusable="false" {...props}>
${body}
    </svg>
  );
}`;
}

const header = readFileSync("scripts/generate-brand-art.mjs", "utf8").match(
  /^\/\*[\s\S]*?\*\//
)[0];

const components = Object.entries(ILLUSTRATIONS)
  .map(([name, file]) => convert(name, file))
  .join("\n\n");

writeFileSync(
  OUT_ILLUSTRATIONS,
  `${header}

// Generated by scripts/generate-brand-art.mjs from the Center Court Figma
// exports. Edit the source SVGs and re-run instead of editing by hand.

import type { SVGProps } from "react";

type ArtProps = SVGProps<SVGSVGElement>;

${components}
`
);

const logo = readFileSync(join(SOURCE, "brackt-logo-primary.svg"), "utf8");
const wordmark = logo.match(/<path d="(M177[^"]+)"/)[1];
writeFileSync(
  OUT_WORDMARK,
  `${header}

// Generated by scripts/generate-brand-art.mjs. Outlined "brackt" wordmark from
// brackt-logo-primary.svg, positioned in that file's 530×128 viewBox.

export const WORDMARK_PATH =
  "${wordmark}";
`
);

console.log(`Wrote ${OUT_ILLUSTRATIONS} and ${OUT_WORDMARK}`);
