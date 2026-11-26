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
import type { PublicTournamentListItem } from "@/lib/tournaments/public-list-projection";
import { findPublicTournamentBySlug } from "./tournament-detail";

function tournament(
  overrides: Partial<PublicTournamentListItem> = {}
): PublicTournamentListItem {
  return {
    slug: "spring-classic",
    name: "Spring Classic",
    description: null,
    location: "Ann Arbor, MI",
    date: "2026-04-11",
    status: "registration_open",
    gender: "mens",
    region: "midwest",
    registrationAvailability: {
      capacity: 24,
      deadline: null,
      registeredCount: 8,
      waitlistCount: 0,
    },
    hostSchool: null,
    ...overrides,
  };
}

describe("findPublicTournamentBySlug", () => {
  it("returns the matching posted tournament", () => {
    const found = findPublicTournamentBySlug(
      [tournament(), tournament({ slug: "fall-invite", name: "Fall Invite" })],
      "fall-invite"
    );
    assert.equal(found?.name, "Fall Invite");
  });

  it("returns null when the slug is absent", () => {
    assert.equal(findPublicTournamentBySlug([tournament()], "missing"), null);
  });
});
