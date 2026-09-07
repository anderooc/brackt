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
  courtScheduleSlotKey,
  findCourtScheduleConflict,
  resolveCourtScheduleApplies,
  type CourtScheduleApplyCandidate,
  type CourtScheduleOccupant,
} from "@/lib/utils/court-schedule-conflict";

describe("bulk day-of match ops time shifts and conflicts", () => {
  it("computes shifted times accurately for positive delays", () => {
    const base = new Date("2026-09-12T13:00:00.000Z");
    const shifted30 = new Date(base.getTime() + 30 * 60_000);
    assert.equal(shifted30.toISOString(), "2026-09-12T13:30:00.000Z");

    const shifted45 = new Date(base.getTime() + 45 * 60_000);
    assert.equal(shifted45.toISOString(), "2026-09-12T13:45:00.000Z");
  });

  it("computes shifted times accurately for negative advances", () => {
    const base = new Date("2026-09-12T14:30:00.000Z");
    const shiftedMinus15 = new Date(base.getTime() - 15 * 60_000);
    assert.equal(shiftedMinus15.toISOString(), "2026-09-12T14:15:00.000Z");
  });

  it("preserves relative spacing when all matches on a court shift together", () => {
    const match1 = new Date("2026-09-12T10:00:00.000Z");
    const match2 = new Date("2026-09-12T11:00:00.000Z");
    const delay = 30 * 60_000;

    const shifted1 = new Date(match1.getTime() + delay);
    const shifted2 = new Date(match2.getTime() + delay);

    assert.equal(
      shifted2.getTime() - shifted1.getTime(),
      match2.getTime() - match1.getTime()
    );
    assert.notEqual(
      courtScheduleSlotKey("court-1", shifted1),
      courtScheduleSlotKey("court-1", shifted2)
    );
  });

  it("detects when a shifted match collides with an unshifted occupant", () => {
    const occupants: CourtScheduleOccupant[] = [
      {
        matchId: "match-fixed",
        courtId: "court-1",
        scheduledTime: new Date("2026-09-12T13:30:00.000Z"),
      },
    ];

    const shiftingMatch = {
      matchId: "match-moving",
      courtId: "court-1",
      scheduledTime: new Date("2026-09-12T13:00:00.000Z"),
    };

    // Shifting by +30m lands on 13:30, where match-fixed is already scheduled
    const proposedTime = new Date(shiftingMatch.scheduledTime.getTime() + 30 * 60_000);
    const conflict = findCourtScheduleConflict(
      occupants,
      shiftingMatch.matchId,
      shiftingMatch.courtId,
      proposedTime
    );

    assert.ok(conflict);
    assert.equal(conflict.matchId, "match-fixed");
  });

  it("allows reassigning multiple matches to the same court when their times do not overlap", () => {
    const candidates: CourtScheduleApplyCandidate[] = [
      {
        matchId: "m1",
        courtId: "court-2",
        currentTime: new Date("2026-09-12T09:00:00.000Z"),
        proposedIso: "2026-09-12T09:00:00.000Z",
      },
      {
        matchId: "m2",
        courtId: "court-2",
        currentTime: new Date("2026-09-12T10:00:00.000Z"),
        proposedIso: "2026-09-12T10:00:00.000Z",
      },
    ];

    const occupancy: CourtScheduleOccupant[] = [];
    const { accepted, rejectedIds } = resolveCourtScheduleApplies(candidates, occupancy);

    assert.equal(accepted.length, 2);
    assert.equal(rejectedIds.size, 0);
  });

  it("rejects candidate when destination court is already occupied at that time", () => {
    const candidates: CourtScheduleApplyCandidate[] = [
      {
        matchId: "m-move",
        courtId: "court-3",
        currentTime: new Date("2026-09-12T11:00:00.000Z"),
        proposedIso: "2026-09-12T11:00:00.000Z",
      },
    ];

    const occupancy: CourtScheduleOccupant[] = [
      {
        matchId: "m-existing",
        courtId: "court-3",
        scheduledTime: new Date("2026-09-12T11:00:00.000Z"),
      },
    ];

    const { accepted, rejectedIds } = resolveCourtScheduleApplies(candidates, occupancy);
    assert.equal(accepted.length, 0);
    assert.ok(rejectedIds.has("m-move"));
  });
});
