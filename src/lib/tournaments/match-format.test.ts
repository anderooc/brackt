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
  completedSetsForFormat,
  evaluateMatchOutcome,
  setStartingScoreForMatch,
  shouldAutoFinalizeAfterScoreSave,
} from "./match-format";

describe("setStartingScoreForMatch", () => {
  const tournament = {
    setStartingScore: 4,
    bracketSetStartingScore: 0,
  };

  it("uses pool starting score for pool matches", () => {
    assert.equal(
      setStartingScoreForMatch(tournament, {
        poolId: "pool-1",
        bracketId: null,
      }),
      4
    );
  });

  it("uses bracket starting score for bracket matches", () => {
    assert.equal(
      setStartingScoreForMatch(tournament, {
        poolId: null,
        bracketId: "bracket-1",
      }),
      0
    );
  });
});

describe("shouldAutoFinalizeAfterScoreSave", () => {
  const formatSettings = {
    format: "two_with_tiebreak" as const,
    targetScore: 25,
    tiebreakTargetScore: 15,
  };

  it("finalizes when a save newly completes the match", () => {
    const before = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, [
        { teamAScore: 25, teamBScore: 20 },
        { teamAScore: 24, teamBScore: 22 },
      ])
    );
    const after = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, [
        { teamAScore: 25, teamBScore: 20 },
        { teamAScore: 25, teamBScore: 22 },
      ])
    );
    assert.equal(before.shouldFinalize, false);
    assert.equal(after.shouldFinalize, true);
    assert.equal(
      shouldAutoFinalizeAfterScoreSave(
        before.shouldFinalize,
        after.shouldFinalize
      ),
      true
    );
  });

  it("does not re-finalize after reopen when sets were already complete", () => {
    const reopenSets = [
      { teamAScore: 25, teamBScore: 18 },
      { teamAScore: 20, teamBScore: 25 },
      { teamAScore: 15, teamBScore: 10 },
    ];
    const before = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, reopenSets)
    );
    const afterBump = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, [
        { teamAScore: 25, teamBScore: 18 },
        { teamAScore: 20, teamBScore: 25 },
        { teamAScore: 16, teamBScore: 10 },
      ])
    );
    assert.equal(before.shouldFinalize, true);
    assert.equal(afterBump.shouldFinalize, true);
    assert.equal(
      shouldAutoFinalizeAfterScoreSave(
        before.shouldFinalize,
        afterBump.shouldFinalize
      ),
      false
    );
  });

  it("finalizes again after corrections make the match incomplete then complete", () => {
    const incomplete = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, [
        { teamAScore: 25, teamBScore: 18 },
        { teamAScore: 20, teamBScore: 25 },
        { teamAScore: 14, teamBScore: 14 },
      ])
    );
    const completeAgain = evaluateMatchOutcome(
      { format: "two_with_tiebreak" },
      "a",
      "b",
      completedSetsForFormat(formatSettings, [
        { teamAScore: 25, teamBScore: 18 },
        { teamAScore: 20, teamBScore: 25 },
        { teamAScore: 16, teamBScore: 14 },
      ])
    );
    assert.equal(incomplete.shouldFinalize, false);
    assert.equal(completeAgain.shouldFinalize, true);
    assert.equal(
      shouldAutoFinalizeAfterScoreSave(
        incomplete.shouldFinalize,
        completeAgain.shouldFinalize
      ),
      true
    );
  });
});
