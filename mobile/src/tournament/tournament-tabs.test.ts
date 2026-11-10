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
import {
  defaultTournamentTab,
  parseTournamentLink,
  resolvePlayView,
} from "./tournament-tabs";

describe("parseTournamentLink", () => {
  it("keeps the current tab ids", () => {
    assert.deepEqual(parseTournamentLink("teams", undefined), {
      tab: "teams",
      view: null,
    });
    assert.deepEqual(parseTournamentLink("play", "mine"), {
      tab: "play",
      view: "mine",
    });
  });

  it("maps older match links into Play", () => {
    assert.deepEqual(parseTournamentLink("matches", undefined), {
      tab: "play",
      view: "all",
    });
    assert.deepEqual(parseTournamentLink("my-matches", undefined), {
      tab: "play",
      view: "mine",
    });
  });

  it("leaves the tab open when the link doesn't name a known one", () => {
    assert.deepEqual(parseTournamentLink(undefined, undefined), {
      tab: null,
      view: null,
    });
    assert.deepEqual(parseTournamentLink("setup", "sideways"), {
      tab: null,
      view: null,
    });
  });
});

describe("defaultTournamentTab", () => {
  it("opens Play only while the event is live", () => {
    assert.equal(defaultTournamentTab("in_progress"), "play");
    assert.equal(defaultTournamentTab("registration_open"), "overview");
    assert.equal(defaultTournamentTab("completed"), "overview");
  });
});

describe("resolvePlayView", () => {
  it("prefers your matches when you have some", () => {
    assert.equal(resolvePlayView(null, true), "mine");
    assert.equal(resolvePlayView("all", true), "all");
    assert.equal(resolvePlayView("mine", false), "all");
  });
});
