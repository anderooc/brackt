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

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DivisionPlayData } from "@/app/(dashboard)/tournaments/[slug]/brackets/data";
import type { TournamentMatchContract } from "../contracts/tournament";
import { projectPlayContract } from "./tournament-play";

function emptyDivision(
  overrides: Partial<DivisionPlayData> = {}
): DivisionPlayData {
  return {
    id: "div-1",
    name: "Open",
    format: "pool_to_bracket",
    poolsReleasedAt: new Date("2026-04-01T12:00:00Z"),
    pools: [],
    brackets: [],
    eligibleTeams: [],
    ...overrides,
  };
}

describe("projectPlayContract", () => {
  it("maps standings to slugs and never emits team UUIDs", () => {
    const projected = projectPlayContract({
      teams: [
        { id: "team-a-id", slug: "north-a", name: "North A" },
        { id: "team-b-id", slug: "south-b", name: "South B" },
      ],
      publicMatches: [],
      divisions: [
        emptyDivision({
          pools: [
            {
              id: "pool-a",
              name: "Pool A",
              teams: [
                {
                  id: "team-a-id",
                  name: "North A",
                  university: "North",
                  seed: 1,
                },
                {
                  id: "team-b-id",
                  name: "South B",
                  university: "South",
                  seed: 2,
                },
              ],
              matchCount: 1,
              matches: [
                {
                  id: "match-1",
                  slug: "north-a-vs-south-b",
                  teamAId: "team-a-id",
                  teamBId: "team-b-id",
                  refTeamId: null,
                  winnerId: "team-a-id",
                  status: "completed",
                  scheduledTime: null,
                  courtId: null,
                  teamA: { id: "team-a-id", name: "North A" },
                  teamB: { id: "team-b-id", name: "South B" },
                  ref: null,
                  sets: [{ teamAScore: 25, teamBScore: 20 }],
                },
              ],
            },
          ],
        }),
      ],
    });

    const standing = projected.divisions[0].pools[0].standings[0];
    assert.equal(standing.teamSlug, "north-a");
    assert.equal(standing.wins, 1);
    assert.equal(standing.losses, 0);
    assert.doesNotMatch(JSON.stringify(projected), /team-a-id|team-b-id|div-1/);
  });

  it("keeps unreleased divisions empty", () => {
    const projected = projectPlayContract({
      teams: [],
      publicMatches: [],
      divisions: [
        emptyDivision({
          poolsReleasedAt: null,
          pools: [],
          brackets: [],
        }),
      ],
    });

    assert.equal(projected.divisions[0].released, false);
    assert.deepEqual(projected.divisions[0].pools, []);
    assert.deepEqual(projected.divisions[0].brackets, []);
  });

  it("prefers the public match payload when one exists", () => {
    const published: TournamentMatchContract = {
      slug: "gold-final",
      status: "in_progress",
      phase: "bracket",
      scheduledTime: "2026-04-11T18:00:00.000Z",
      timeZone: "America/New_York",
      courtName: "Court 1",
      divisionName: "Open",
      teamA: { slug: "north-a", name: "North A" },
      teamB: { slug: "south-b", name: "South B" },
      winnerSlug: null,
      sets: [{ setNumber: 1, teamAScore: 12, teamBScore: 8 }],
    };

    const projected = projectPlayContract({
      teams: [
        { id: "team-a-id", slug: "north-a", name: "North A" },
        { id: "team-b-id", slug: "south-b", name: "South B" },
      ],
      publicMatches: [published],
      divisions: [
        emptyDivision({
          format: "single_elimination",
          brackets: [
            {
              id: "gold",
              bracketType: "single_elimination",
              seedCount: 2,
              name: "Gold",
              tier: 0,
              matches: [
                {
                  id: "m1",
                  slug: "gold-final",
                  teamAId: "team-a-id",
                  teamBId: "team-b-id",
                  teamAName: "North A",
                  teamBName: "South B",
                  bracketRound: 1,
                  bracketPosition: 0,
                  refTeamId: null,
                  courtId: "court-1",
                  winnerId: null,
                  status: "upcoming",
                  scheduledTime: null,
                  teamA: { id: "team-a-id", name: "North A" },
                  teamB: { id: "team-b-id", name: "South B" },
                  ref: null,
                  courtName: "Court 1",
                  sets: [],
                },
              ],
            },
          ],
        }),
      ],
    });

    const match = projected.divisions[0].brackets[0].matches[0];
    assert.equal(match.status, "in_progress");
    assert.equal(match.round, 1);
    assert.deepEqual(match.sets, published.sets);
    assert.equal(projected.divisions[0].brackets[0].name, "Gold");
  });
});
