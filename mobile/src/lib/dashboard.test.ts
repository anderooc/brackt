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
import type {
  DashboardAttentionContract,
  DashboardHostingContract,
} from "@/lib/api/contracts/dashboard";
import {
  attentionRoute,
  headlineSummary,
  hostingFacts,
  hostingFill,
  relativeDay,
} from "./dashboard";

function hosting(
  overrides: Partial<DashboardHostingContract> = {}
): DashboardHostingContract {
  return {
    slug: "fall-classic",
    name: "Fall Classic",
    date: "2026-11-14",
    status: "registration_open",
    teamCount: 12,
    pendingCount: 0,
    capacity: 16,
    deadline: "2026-11-12T23:59:00.000Z",
    deadlinePassed: false,
    ...overrides,
  };
}

describe("relativeDay", () => {
  it("counts calendar days and stops after two weeks", () => {
    assert.equal(relativeDay("2026-11-09", "2026-11-09"), "Today");
    assert.equal(relativeDay("2026-11-10", "2026-11-09"), "Tomorrow");
    assert.equal(relativeDay("2026-11-14", "2026-11-09"), "In 5 days");
    assert.equal(relativeDay("2026-11-23", "2026-11-09"), null);
    assert.equal(relativeDay("2026-11-08", "2026-11-09"), null);
  });
});

describe("headlineSummary", () => {
  it("leads with what needs the viewer, then the next event", () => {
    assert.equal(
      headlineSummary(2, { name: "Fall Classic", date: "2026-11-14" }, "2026-11-09"),
      "2 things need you. Fall Classic is in 5 days."
    );
    assert.equal(
      headlineSummary(0, null, "2026-11-09"),
      "You’re all caught up. Nothing on the calendar yet."
    );
  });

  it("falls back to the date for events further out", () => {
    assert.match(
      headlineSummary(1, { name: "Winter Open", date: "2027-01-16" }, "2026-11-09"),
      /^1 thing needs you\. Winter Open is on Jan 16\.$/
    );
  });
});

describe("attentionRoute", () => {
  it("opens the screen that resolves each target", () => {
    const item = (target: DashboardAttentionContract["target"]) =>
      ({
        key: "k",
        kind: "pay_fee",
        target,
        title: "",
        detail: null,
        cta: "",
        tournament: { slug: "fall-classic", name: "Fall Classic", date: "2026-11-14" },
      }) satisfies DashboardAttentionContract;
    assert.equal(
      attentionRoute(item("pending")),
      "/tournament/fall-classic/host/registrations?tab=pending"
    );
    assert.equal(attentionRoute(item("payment")), "/tournament/fall-classic/payment");
    assert.equal(attentionRoute(item("waiver")), "/tournament/fall-classic/waiver");
  });
});

describe("hostingFacts", () => {
  it("shows fill, pending, and the deadline while registration is open", () => {
    assert.deepEqual(hostingFacts(hosting({ pendingCount: 3 })).slice(0, 2), [
      "12 of 16 teams",
      "3 pending",
    ]);
    assert.equal(hostingFacts(hosting({ deadlinePassed: true }))[1], "Deadline passed");
  });

  it("drops the cap and deadline when they don't apply", () => {
    assert.deepEqual(
      hostingFacts(hosting({ capacity: null, teamCount: 1, status: "registration_closed" })),
      ["1 team"]
    );
  });
});

describe("hostingFill", () => {
  it("is null without a cap or for drafts, and never exceeds 1", () => {
    assert.equal(hostingFill(hosting({ capacity: null })), null);
    assert.equal(hostingFill(hosting({ status: "draft" })), null);
    assert.equal(hostingFill(hosting({ teamCount: 20 })), 1);
    assert.equal(hostingFill(hosting()), 0.75);
  });
});
