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
import { uniqueRegions } from "@/lib/tournaments/posting-announcement-copy";
import { defaultPostingAnnouncement } from "@/lib/tournaments/posting-announcement-copy";

describe("uniqueRegions", () => {
  it("dedupes while preserving first-seen order", () => {
    assert.deepEqual(uniqueRegions(["northeast", "pacific", "northeast"]), ["northeast", "pacific"]);
  });
});

describe("defaultPostingAnnouncement", () => {
  it("names the gender and selected regions", () => {
    const message = defaultPostingAnnouncement({
      tournamentName: "Spring Invite",
      dateDisplay: "April 4, 2026",
      location: "Atlanta, GA",
      gender: "womens",
      regions: ["southeast", "south_central"],
    });
    assert.match(message.subject, /Women's/);
    assert.match(message.subject, /Spring Invite/);
    assert.match(message.body, /Southeast/);
    assert.match(message.body, /South Central/);
    assert.match(message.body, /{{captainName}}/);
  });
});
