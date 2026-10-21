/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { BracketMatchContract } from "@/lib/api/contracts/tournament";
import { decidedChampions, findBracketChampion } from "./champions";

const team = (slug: string) => ({ slug, name: slug.toUpperCase() });

const match = (
  overrides: Partial<BracketMatchContract> = {}
): BracketMatchContract => ({
  slug: "m",
  round: 2,
  position: 1,
  status: "completed",
  teamA: team("emory"),
  teamB: team("gt"),
  winnerSlug: "gt",
  sets: [
    { setNumber: 1, teamAScore: 25, teamBScore: 21 },
    { setNumber: 2, teamAScore: 19, teamBScore: 25 },
    { setNumber: 3, teamAScore: 12, teamBScore: 15 },
  ],
  ...overrides,
});

describe("findBracketChampion", () => {
  it("returns the final's winner with sets from the winner's side", () => {
    assert.deepEqual(
      findBracketChampion([match({ round: 1, winnerSlug: "emory" }), match()]),
      {
        teamName: "GT",
        runnerUpName: "EMORY",
        finalSets: { winner: 2, loser: 1 },
      }
    );
  });

  it("is null until the final is completed", () => {
    assert.equal(
      findBracketChampion([match({ status: "in_progress", winnerSlug: null })]),
      null
    );
    assert.equal(findBracketChampion([match({ winnerSlug: null })]), null);
    assert.equal(findBracketChampion([]), null);
  });

  it("ignores a winner slug that matches neither team", () => {
    assert.equal(findBracketChampion([match({ winnerSlug: "ucla" })]), null);
  });

  it("omits the set line when no sets were recorded", () => {
    assert.equal(findBracketChampion([match({ sets: [] })])?.finalSets, null);
  });
});

describe("decidedChampions", () => {
  it("skips undecided brackets and prefixes the division when needed", () => {
    const champions = decidedChampions([
      { name: "Gold", type: "single_elimination", tier: 1, matches: [match()], contextName: "Women's" },
      { name: "Silver", type: "single_elimination", tier: 2, matches: [match({ status: "in_progress", winnerSlug: null })] },
    ]);
    assert.deepEqual(
      champions.map((c) => [c.bracketName, c.teamName]),
      [["Women's Gold", "GT"]]
    );
  });
});
