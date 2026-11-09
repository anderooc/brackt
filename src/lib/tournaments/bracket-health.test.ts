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
import {
  bracketHasStaleAdvance,
  bracketHasTeams,
  bracketHasUnseededTree,
  poolPlayFinished,
} from "./bracket-health";

function match(
  round: number,
  position: number,
  fields: Partial<{
    teamAId: string | null;
    teamBId: string | null;
    winnerId: string | null;
    status: string;
  }> = {}
) {
  return {
    bracketRound: round,
    bracketPosition: position,
    teamAId: null,
    teamBId: null,
    winnerId: null,
    status: "upcoming",
    ...fields,
  };
}

describe("bracketHasStaleAdvance", () => {
  it("is false when every winner already sits in the next slot", () => {
    const matches = [
      match(1, 1, { teamAId: "a", teamBId: "b", winnerId: "a", status: "completed" }),
      match(1, 2, { teamAId: "c", teamBId: "d", winnerId: "d", status: "completed" }),
      match(2, 1, { teamAId: "a", teamBId: "d" }),
    ];
    assert.equal(bracketHasStaleAdvance(matches), false);
  });

  it("flags a winner missing from the slot it feeds", () => {
    const matches = [
      match(1, 1, { teamAId: "a", teamBId: "b", winnerId: "a", status: "completed" }),
      match(1, 2, { teamAId: "c", teamBId: "d", winnerId: "d", status: "completed" }),
      match(2, 1, { teamAId: "a", teamBId: null }),
    ];
    assert.equal(bracketHasStaleAdvance(matches), true);
  });

  it("ignores finals and unfinished matches", () => {
    const matches = [
      match(1, 1, { teamAId: "a", teamBId: "b", status: "in_progress" }),
      match(2, 1, { teamAId: "a", teamBId: "d", winnerId: "a", status: "completed" }),
    ];
    assert.equal(bracketHasStaleAdvance(matches), false);
  });
});

describe("bracketHasTeams / bracketHasUnseededTree", () => {
  it("treats an empty shell as neither seeded nor a legacy tree", () => {
    assert.equal(bracketHasTeams([]), false);
    assert.equal(bracketHasUnseededTree([]), false);
  });

  it("detects a tree with rows but no placed teams", () => {
    assert.equal(bracketHasUnseededTree([match(1, 1), match(2, 1)]), true);
    assert.equal(
      bracketHasUnseededTree([match(1, 1, { teamAId: "a" })]),
      false
    );
  });
});

describe("poolPlayFinished", () => {
  it("requires every pool to have only completed matches", () => {
    assert.equal(poolPlayFinished([]), false);
    assert.equal(poolPlayFinished([{ matches: [] }]), false);
    assert.equal(
      poolPlayFinished([
        { matches: [{ status: "completed" }] },
        { matches: [{ status: "completed" }, { status: "upcoming" }] },
      ]),
      false
    );
    assert.equal(
      poolPlayFinished([{ matches: [{ status: "completed" }] }]),
      true
    );
  });
});
