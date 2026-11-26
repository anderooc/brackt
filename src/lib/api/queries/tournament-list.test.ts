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
import { ApiError } from "../errors";
import type { PublicTournamentListItem } from "@/lib/tournaments/public-list-projection";
import {
  DEFAULT_TOURNAMENT_PAGE_SIZE,
  MAX_TOURNAMENT_PAGE_SIZE,
  applyTournamentListQuery,
  parseTournamentListQuery,
} from "./tournament-list";

function query(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

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

describe("parseTournamentListQuery", () => {
  it("applies defaults when no params are supplied", () => {
    const parsed = parseTournamentListQuery(query(""));
    assert.equal(parsed.limit, DEFAULT_TOURNAMENT_PAGE_SIZE);
    assert.equal(parsed.offset, 0);
    assert.equal(parsed.status, undefined);
  });

  it("treats empty string params as absent", () => {
    const parsed = parseTournamentListQuery(query("status=&search="));
    assert.equal(parsed.status, undefined);
    assert.equal(parsed.search, undefined);
  });

  it("reads filters and coerces numbers", () => {
    const parsed = parseTournamentListQuery(
      query("status=in_progress&gender=womens&region=midwest&limit=5&offset=10")
    );
    assert.equal(parsed.status, "in_progress");
    assert.equal(parsed.gender, "womens");
    assert.equal(parsed.region, "midwest");
    assert.equal(parsed.limit, 5);
    assert.equal(parsed.offset, 10);
  });

  it("trims the search term", () => {
    assert.equal(parseTournamentListQuery(query("search=%20cup%20")).search, "cup");
  });

  it("rejects draft as a filter, since drafts are never returned", () => {
    assert.throws(() => parseTournamentListQuery(query("status=draft")), ApiError);
  });

  it("rejects malformed values rather than silently defaulting", () => {
    assert.throws(() => parseTournamentListQuery(query("limit=abc")), ApiError);
    assert.throws(() => parseTournamentListQuery(query("limit=0")), ApiError);
    assert.throws(() => parseTournamentListQuery(query("offset=-1")), ApiError);
    assert.throws(() => parseTournamentListQuery(query("gender=coed")), ApiError);
  });

  it("caps the page size so one request cannot pull the whole table", () => {
    assert.throws(
      () =>
        parseTournamentListQuery(
          query(`limit=${MAX_TOURNAMENT_PAGE_SIZE + 1}`)
        ),
      ApiError
    );
  });

  it("reports the offending field in error details", () => {
    try {
      parseTournamentListQuery(query("limit=abc"));
      assert.fail("expected a validation error");
    } catch (cause) {
      assert.ok(cause instanceof ApiError);
      assert.equal(cause.code, "bad_request");
      assert.ok(cause.details?.limit);
    }
  });
});

describe("applyTournamentListQuery", () => {
  const items = [
    tournament({ slug: "a", name: "Ann Arbor Open", region: "midwest" }),
    tournament({
      slug: "b",
      name: "Boston Invite",
      region: "northeast",
      gender: "womens",
      status: "completed",
    }),
    tournament({
      slug: "c",
      name: "Chicago Classic",
      location: "Chicago, IL",
      hostSchool: {
        name: "Northwestern",
        slug: "northwestern",
        verificationStatus: "verified",
      },
    }),
  ];

  it("returns everything when unfiltered", () => {
    const page = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query(""))
    );
    assert.equal(page.items.length, 3);
    assert.equal(page.total, 3);
    assert.equal(page.nextOffset, null);
  });

  it("filters by status, gender, and region", () => {
    const byStatus = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("status=completed"))
    );
    assert.deepEqual(byStatus.items.map((i) => i.slug), ["b"]);

    const byGender = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("gender=womens"))
    );
    assert.deepEqual(byGender.items.map((i) => i.slug), ["b"]);

    const byRegion = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("region=northeast"))
    );
    assert.deepEqual(byRegion.items.map((i) => i.slug), ["b"]);
  });

  it("searches name, location, and host school case-insensitively", () => {
    const byName = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("search=boston"))
    );
    assert.deepEqual(byName.items.map((i) => i.slug), ["b"]);

    const byLocation = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("search=Chicago"))
    );
    assert.deepEqual(byLocation.items.map((i) => i.slug), ["c"]);

    const byHost = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("search=northwestern"))
    );
    assert.deepEqual(byHost.items.map((i) => i.slug), ["c"]);
  });

  it("combines filters conjunctively", () => {
    const page = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("gender=womens&region=midwest"))
    );
    assert.equal(page.items.length, 0);
    assert.equal(page.total, 0);
  });

  it("paginates and reports the next offset", () => {
    const first = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("limit=2"))
    );
    assert.deepEqual(first.items.map((i) => i.slug), ["a", "b"]);
    assert.equal(first.total, 3);
    assert.equal(first.nextOffset, 2);

    const second = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("limit=2&offset=2"))
    );
    assert.deepEqual(second.items.map((i) => i.slug), ["c"]);
    assert.equal(second.nextOffset, null);
  });

  it("counts the filtered total, not the unfiltered one", () => {
    const page = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("gender=mens&limit=1"))
    );
    assert.equal(page.total, 2);
    assert.equal(page.nextOffset, 1);
  });

  it("returns an empty page when the offset is past the end", () => {
    const page = applyTournamentListQuery(
      items,
      parseTournamentListQuery(query("offset=99"))
    );
    assert.deepEqual(page.items, []);
    assert.equal(page.nextOffset, null);
  });
});
