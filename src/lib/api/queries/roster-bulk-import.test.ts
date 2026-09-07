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
import { isValidEmail } from "@/lib/roster/bulk-import-parser";
import type { BulkImportRowInput } from "./roster-bulk-import";

describe("roster bulk import row preparation and validation", () => {
  it("deduplicates batch rows case-insensitively keeping the first occurrence", () => {
    const rawRows: BulkImportRowInput[] = [
      { email: "ALEX@purdue.edu", jerseyNumber: 12, role: "member" },
      { email: "alex@purdue.edu", jerseyNumber: 99, role: "officer" },
      { email: "sam@purdue.edu", jerseyNumber: 5, role: "member" },
      { email: "Sam@Purdue.edu", jerseyNumber: 7, role: "member" },
    ];

    const uniqueRows: BulkImportRowInput[] = [];
    const seenEmails = new Set<string>();

    for (const r of rawRows) {
      const email = r.email.trim().toLowerCase();
      if (!email || !isValidEmail(email)) continue;
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      uniqueRows.push({ ...r, email });
    }

    assert.equal(uniqueRows.length, 2);
    assert.equal(uniqueRows[0].email, "alex@purdue.edu");
    assert.equal(uniqueRows[0].jerseyNumber, 12);
    assert.equal(uniqueRows[1].email, "sam@purdue.edu");
    assert.equal(uniqueRows[1].jerseyNumber, 5);
  });

  it("filters out invalid emails from the batch", () => {
    const rawRows: BulkImportRowInput[] = [
      { email: "not-an-email" },
      { email: "valid@college.edu" },
      { email: "" },
      { email: "@missingusername.com" },
    ];

    const validRows = rawRows.filter((r) => isValidEmail(r.email));
    assert.equal(validRows.length, 1);
    assert.equal(validRows[0].email, "valid@college.edu");
  });

  it("handles team jersey collisions by falling back safely to null", () => {
    const occupiedTeamJerseys = new Set<number>([10, 12, 14]);

    const candidates: Array<{ email: string; requestedJersey: number | null }> = [
      { email: "player1@college.edu", requestedJersey: 7 },
      { email: "player2@college.edu", requestedJersey: 12 }, // Collision!
      { email: "player3@college.edu", requestedJersey: 7 }, // Duplicate in batch!
    ];

    const assigned = candidates.map((c) => {
      let jersey = c.requestedJersey;
      if (jersey !== null && occupiedTeamJerseys.has(jersey)) {
        jersey = null;
      } else if (jersey !== null) {
        occupiedTeamJerseys.add(jersey);
      }
      return { email: c.email, jersey };
    });

    assert.equal(assigned[0].jersey, 7);
    assert.equal(assigned[1].jersey, null);
    assert.equal(assigned[2].jersey, null);
  });
});
