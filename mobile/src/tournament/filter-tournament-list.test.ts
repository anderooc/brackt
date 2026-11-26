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
import type { TournamentListItemContract } from "@/lib/api/contracts/tournament";
import {
  buildScheduleGroups,
  countActiveTournamentFilters,
  emptyScheduleCopy,
  filterTournamentList,
  monthCellIsos,
  registrationAvailabilityOpen,
  shiftMonth,
} from "./filter-tournament-list";

function item(
  overrides: Partial<TournamentListItemContract> = {}
): TournamentListItemContract {
  return {
    slug: "spring-invite",
    name: "Spring Invite",
    description: "Pool play on campus",
    location: "Boston, MA",
    date: "2026-08-23",
    status: "registration_open",
    gender: "mens",
    region: "northeast",
    registrationAvailability: {
      capacity: 16,
      deadline: "2026-08-20T12:00:00.000Z",
      registeredCount: 8,
      waitlistCount: 0,
    },
    hostSchool: { name: "Boston University", slug: "bu", verificationStatus: "verified" },
    ...overrides,
  };
}

const baseFilters = {
  query: "",
  genderFilter: new Set<"mens" | "womens">(),
  regionFilter: new Set<
    | "new_england"
    | "northeast"
    | "mid_atlantic"
    | "southeast"
    | "midwest"
    | "south_central"
    | "mountain"
    | "pacific"
  >(),
  hideArchived: false,
  registrationOpenOnly: false,
  today: "2026-08-22",
  now: "2026-08-19T12:00:00.000Z",
};

describe("filterTournamentList", () => {
  it("matches name, location, description, and host", () => {
    const list = [
      item(),
      item({ slug: "west", name: "West Classic", location: "Seattle", description: null, hostSchool: null }),
    ];
    assert.equal(filterTournamentList(list, { ...baseFilters, query: "boston" }).length, 1);
    assert.equal(filterTournamentList(list, { ...baseFilters, query: "campus" }).length, 1);
    assert.equal(filterTournamentList(list, { ...baseFilters, query: "university" }).length, 1);
  });

  it("hides dates strictly before today", () => {
    const list = [
      item({ slug: "past", date: "2026-08-21" }),
      item({ slug: "today", date: "2026-08-22" }),
    ];
    const filtered = filterTournamentList(list, { ...baseFilters, hideArchived: true });
    assert.deepEqual(filtered.map((t) => t.slug), ["today"]);
  });

  it("keeps registration-open events whose deadline is still ahead", () => {
    const list = [
      item({ slug: "open" }),
      item({
        slug: "closed",
        status: "registration_closed",
        registrationAvailability: {
          capacity: 16,
          deadline: null,
          registeredCount: 16,
          waitlistCount: 2,
        },
      }),
      item({
        slug: "expired",
        registrationAvailability: {
          capacity: 16,
          deadline: "2026-08-18T12:00:00.000Z",
          registeredCount: 4,
          waitlistCount: 0,
        },
      }),
    ];
    const filtered = filterTournamentList(list, {
      ...baseFilters,
      registrationOpenOnly: true,
    });
    assert.deepEqual(filtered.map((t) => t.slug), ["open"]);
  });

  it("filters gender and region as unions", () => {
    const list = [
      item(),
      item({
        slug: "womens-south",
        gender: "womens",
        region: "south_central",
      }),
    ];
    assert.equal(
      filterTournamentList(list, {
        ...baseFilters,
        genderFilter: new Set(["womens"]),
      }).length,
      1
    );
    assert.equal(
      filterTournamentList(list, {
        ...baseFilters,
        regionFilter: new Set(["south_central"]),
      })[0]?.slug,
      "womens-south"
    );
  });
});

describe("registrationAvailabilityOpen", () => {
  it("treats a missing deadline as open", () => {
    assert.equal(
      registrationAvailabilityOpen("registration_open", null, "2026-08-19T12:00:00.000Z"),
      true
    );
  });
});

describe("buildScheduleGroups", () => {
  it("inserts today and the selected date when they have no events", () => {
    const groups = buildScheduleGroups([item({ date: "2026-08-29" })], {
      today: "2026-08-22",
      selectedDate: "2026-08-25",
    });
    assert.deepEqual(
      groups.map((group) => [group.date, group.tournaments.length]),
      [
        ["2026-08-22", 0],
        ["2026-08-25", 0],
        ["2026-08-29", 1],
      ]
    );
  });
});

describe("monthCellIsos", () => {
  it("pads August 2026 from Saturday and fills six weeks", () => {
    const cells = monthCellIsos(2026, 7);
    assert.equal(cells[0], null);
    assert.equal(cells[6], "2026-08-01");
    assert.equal(cells[36], "2026-08-31");
    assert.equal(cells.length % 7, 0);
  });
});

describe("shiftMonth", () => {
  it("wraps December into the next year", () => {
    assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, monthIndex: 0 });
  });
});

describe("countActiveTournamentFilters", () => {
  it("counts hide-archived only when it differs from the default", () => {
    assert.equal(
      countActiveTournamentFilters({
        genderFilter: new Set(),
        regionFilter: new Set(),
        hideArchived: false,
        registrationOpenOnly: false,
      }),
      0
    );
    assert.equal(
      countActiveTournamentFilters({
        genderFilter: new Set(["mens"]),
        regionFilter: new Set(),
        hideArchived: true,
        registrationOpenOnly: true,
      }),
      3
    );
  });
});

describe("emptyScheduleCopy", () => {
  it("teaches search versus filters", () => {
    assert.equal(
      emptyScheduleCopy({ loadedCount: 0, query: "", hasActiveFilters: false }).title,
      "No tournaments yet"
    );
    assert.match(
      emptyScheduleCopy({
        loadedCount: 4,
        query: "yale",
        hasActiveFilters: true,
      }).body,
      /yale/
    );
  });
});
