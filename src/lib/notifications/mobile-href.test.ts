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
import { mapNotificationHrefForMobile } from "./mobile-href";

describe("mapNotificationHrefForMobile", () => {
  it("maps tournament overview links", () => {
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open"),
      "/tournament/spring-open"
    );
  });

  it("maps tournament tab links", () => {
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=chat"),
      "/tournament/spring-open/chat"
    );
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=teams"),
      "/tournament/spring-open?tab=teams"
    );
  });

  it("maps play and team-task tabs to their app screens", () => {
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=my-matches"),
      "/tournament/spring-open?tab=play&view=mine"
    );
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=pool-play"),
      "/tournament/spring-open/pools"
    );
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=waiver"),
      "/tournament/spring-open/waiver"
    );
    assert.equal(
      mapNotificationHrefForMobile("/tournaments/spring-open?tab=setup"),
      "/tournament/spring-open"
    );
  });

  it("maps the dashboard to the home tab", () => {
    assert.equal(
      mapNotificationHrefForMobile("/dashboard#your-schedule"),
      "/"
    );
  });

  it("maps school links", () => {
    assert.equal(
      mapNotificationHrefForMobile("/schools/state-u"),
      "/schools/state-u"
    );
  });

  it("rejects unsafe hrefs", () => {
    assert.equal(mapNotificationHrefForMobile("//evil.test"), null);
    assert.equal(mapNotificationHrefForMobile("https://evil.test"), null);
  });
});
