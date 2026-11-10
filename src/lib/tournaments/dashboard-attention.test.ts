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
  collectAttentionItems,
  type AttentionInputs,
  type AttentionRegistrationInput,
} from "./dashboard-attention";

const early = { id: "t1", slug: "early", name: "Early Open", date: "2026-11-14" };
const late = { id: "t2", slug: "late", name: "Late Classic", date: "2026-12-05" };

function inputs(overrides: Partial<AttentionInputs> = {}): AttentionInputs {
  return {
    userId: "me",
    hosted: [],
    registrations: [],
    latestWaiverByTournament: new Map(),
    completions: [],
    rosterByTeam: new Map(),
    ...overrides,
  };
}

function registration(
  overrides: Partial<AttentionRegistrationInput> = {}
): AttentionRegistrationInput {
  return {
    tournament: early,
    teamId: "team-a",
    teamName: "Team A",
    isCaptain: false,
    paymentStatus: null,
    amountCents: null,
    waiverEnabled: false,
    waiverAllowDigitalAck: false,
    ...overrides,
  };
}

describe("collectAttentionItems", () => {
  it("lists host approvals and payment reviews only when there are some", () => {
    const items = collectAttentionItems(
      inputs({
        hosted: [
          { tournament: early, pendingCount: 3, paymentsToReview: 0 },
          { tournament: late, pendingCount: 0, paymentsToReview: 2 },
        ],
      })
    );
    assert.deepEqual(
      items.map((i) => [i.kind, i.count]),
      [
        ["approve_teams", 3],
        ["review_payments", 2],
      ]
    );
  });

  it("asks only captains to pay unpaid fees", () => {
    const items = collectAttentionItems(
      inputs({
        registrations: [
          registration({ paymentStatus: "unpaid", amountCents: 5000 }),
          registration({
            teamId: "team-b",
            isCaptain: true,
            paymentStatus: "unpaid",
            amountCents: 4000,
          }),
          registration({
            teamId: "team-c",
            isCaptain: true,
            paymentStatus: "submitted",
          }),
        ],
      })
    );
    assert.deepEqual(
      items.map((i) => [i.kind, i.amountCents]),
      [["pay_fee", 4000]]
    );
  });

  it("prompts a digital waiver signature once, against the latest version", () => {
    const waiverOn = { waiverEnabled: true, waiverAllowDigitalAck: true };
    const items = collectAttentionItems(
      inputs({
        registrations: [
          registration(waiverOn),
          registration({ ...waiverOn, teamId: "team-b" }),
        ],
        latestWaiverByTournament: new Map([["t1", "w2"]]),
        completions: [{ waiverId: "w1", userId: "me" }],
      })
    );
    assert.deepEqual(items.map((i) => i.kind), ["sign_waiver"]);
  });

  it("skips waivers the viewer can't sign or that aren't uploaded", () => {
    const items = collectAttentionItems(
      inputs({
        registrations: [
          registration({ waiverEnabled: true, waiverAllowDigitalAck: false }),
          registration({
            tournament: late,
            waiverEnabled: true,
            waiverAllowDigitalAck: true,
          }),
        ],
        latestWaiverByTournament: new Map([["t1", "w1"]]),
      })
    );
    assert.deepEqual(items, []);
  });

  it("tells captains how many teammates still owe a waiver", () => {
    const items = collectAttentionItems(
      inputs({
        registrations: [
          registration({
            isCaptain: true,
            waiverEnabled: true,
            waiverAllowDigitalAck: false,
          }),
        ],
        latestWaiverByTournament: new Map([["t1", "w1"]]),
        completions: [{ waiverId: "w1", userId: "p1" }],
        rosterByTeam: new Map([["team-a", ["me", "p1", "p2", "p3"]]]),
      })
    );
    assert.deepEqual(
      items.map((i) => [i.kind, i.count]),
      [["collect_waivers", 2]]
    );
  });

  it("orders by event date, then by kind", () => {
    const items = collectAttentionItems(
      inputs({
        hosted: [{ tournament: late, pendingCount: 1, paymentsToReview: 0 }],
        registrations: [
          registration({ isCaptain: true, paymentStatus: "unpaid" }),
        ],
      })
    );
    assert.deepEqual(
      items.map((i) => [i.tournament.id, i.kind]),
      [
        ["t1", "pay_fee"],
        ["t2", "approve_teams"],
      ]
    );
  });
});
