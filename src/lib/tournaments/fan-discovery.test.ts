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

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
import { PublicMatchRow } from "@/components/tournament-public/public-match-row";
import { PublicRegistrationAvailability } from "@/components/public-registration-availability";
import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";

describe("Fan & Discovery Tournament Public Features", () => {
  it("generates QR code SVG string for public scoreboard URLs", async () => {
    const url = "https://brack-t.com/explore/tournaments/peach-state-classic/scores";
    const svg = await QRCode.toString(url, {
      type: "svg",
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    });

    assert.ok(svg.startsWith("<svg"), "QR output must be an SVG element");
    assert.match(svg, /viewBox/);
    assert.match(svg.trim(), /<\/svg>$/);
  });

  it("renders live and completed matches in PublicMatchRow without requiring auth", () => {
    const liveMatch: TournamentMatchContract = {
      slug: "m-court-1-live",
      status: "in_progress",
      phase: "pool",
      scheduledTime: "2026-10-15T14:00:00Z",
      courtName: "Court 1",
      divisionName: "Men's Collegiate",
      teamA: { slug: "emory-a", name: "Emory A" },
      teamB: { slug: "gatech-a", name: "Georgia Tech A" },
      winnerSlug: null,
      sets: [
        { setNumber: 1, teamAScore: 25, teamBScore: 22 },
        { setNumber: 2, teamAScore: 18, teamBScore: 25 },
      ],
    };

    const html = renderToStaticMarkup(
      createElement(PublicMatchRow, {
        match: liveMatch,
        tournamentSlug: "peach-state-classic",
      })
    );

    assert.match(html, /Emory A/);
    assert.match(html, /Georgia Tech A/);
    assert.match(html, /Court 1/);
    assert.match(html, /25-22, 18-25/);
    assert.match(html, /Live/);
  });

  it("renders public registration availability metrics properly", () => {
    const html = renderToStaticMarkup(
      createElement(PublicRegistrationAvailability, {
        availability: {
          capacity: 16,
          deadline: "2026-10-10T23:59:00.000Z",
          registeredCount: 12,
          waitlistCount: 2,
        },
      })
    );

    assert.match(html, /12 \/ 16 teams registered/);
    assert.match(html, /2 teams waiting/);
    assert.match(html, /October 10, 2026/);
  });
});
