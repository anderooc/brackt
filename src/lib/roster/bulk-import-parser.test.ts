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
  generateSampleRosterCsv,
  isValidEmail,
  normalizeJerseyNumber,
  normalizeVolleyballPosition,
  parseRosterInput,
} from "./bulk-import-parser";

describe("bulk import parser utilities", () => {
  it("validates emails strictly", () => {
    assert.equal(isValidEmail("user@purdue.edu"), true);
    assert.equal(isValidEmail("first.last+club@cal.berkeley.edu"), true);
    assert.equal(isValidEmail("invalid-email"), false);
    assert.equal(isValidEmail("missing@domain"), false);
    assert.equal(isValidEmail("@school.edu"), false);
  });

  it("normalizes volleyball positions and aliases", () => {
    assert.equal(normalizeVolleyballPosition("OH"), "outside_hitter");
    assert.equal(normalizeVolleyballPosition("Outside"), "outside_hitter");
    assert.equal(normalizeVolleyballPosition("outside hitter"), "outside_hitter");
    assert.equal(normalizeVolleyballPosition("Left Side"), "outside_hitter");

    assert.equal(normalizeVolleyballPosition("MB"), "middle_blocker");
    assert.equal(normalizeVolleyballPosition("Middle"), "middle_blocker");
    assert.equal(normalizeVolleyballPosition("middle blocker"), "middle_blocker");

    assert.equal(normalizeVolleyballPosition("Opp"), "opposite_hitter");
    assert.equal(normalizeVolleyballPosition("Opposite"), "opposite_hitter");
    assert.equal(normalizeVolleyballPosition("Right Side"), "opposite_hitter");
    assert.equal(normalizeVolleyballPosition("RS"), "opposite_hitter");

    assert.equal(normalizeVolleyballPosition("S"), "setter");
    assert.equal(normalizeVolleyballPosition("Setter"), "setter");

    assert.equal(normalizeVolleyballPosition("L"), "libero_ds");
    assert.equal(normalizeVolleyballPosition("DS"), "libero_ds");
    assert.equal(normalizeVolleyballPosition("L/DS"), "libero_ds");
    assert.equal(normalizeVolleyballPosition("Libero"), "libero_ds");
    assert.equal(normalizeVolleyballPosition("Defensive Specialist"), "libero_ds");

    assert.equal(normalizeVolleyballPosition(""), null);
    assert.equal(normalizeVolleyballPosition("none"), null);
    assert.equal(normalizeVolleyballPosition("unknown_pos"), "invalid");
  });

  it("normalizes jersey numbers and handles leading # or 0", () => {
    assert.equal(normalizeJerseyNumber("12"), 12);
    assert.equal(normalizeJerseyNumber("#7"), 7);
    assert.equal(normalizeJerseyNumber("No. 5"), 5);
    assert.equal(normalizeJerseyNumber("0"), 0);
    assert.equal(normalizeJerseyNumber("99"), 99);
    assert.equal(normalizeJerseyNumber("100"), "invalid");
    assert.equal(normalizeJerseyNumber("-3"), "invalid");
    assert.equal(normalizeJerseyNumber("abc"), "invalid");
    assert.equal(normalizeJerseyNumber(""), null);
  });
});

describe("parseRosterInput", () => {
  it("parses standard CSV with full headers", () => {
    const csv = `
email,name,role,jersey,position,title
alex@college.edu,Alex Morgan,member,#12,OH,
sam@college.edu,Sam Lee,officer,5,Setter,Vice President
taylor@college.edu,Taylor Bell,member,22,MB,
`;

    const res = parseRosterInput(csv, { context: "school" });
    assert.equal(res.totalRows, 3);
    assert.equal(res.validRows, 3);
    assert.equal(res.invalidRows, 0);

    assert.deepEqual(res.rows[0], {
      rawIndex: 2,
      email: "alex@college.edu",
      fullName: "Alex Morgan",
      jerseyNumber: 12,
      volleyballPosition: "outside_hitter",
      role: "member",
      title: null,
      valid: true,
      errors: [],
      warnings: [],
    });

    assert.equal(res.rows[1].role, "officer");
    assert.equal(res.rows[1].title, "Vice President");
    assert.equal(res.rows[1].volleyballPosition, "setter");
    assert.equal(res.rows[1].jerseyNumber, 5);
  });

  it("handles TSV (tab-separated) pasted from spreadsheets", () => {
    const tsv = [
      "email\tname\tjersey\tposition",
      "alex@college.edu\tAlex Morgan\t12\tOH",
      "sam@college.edu\tSam Lee\t5\tS",
    ].join("\n");

    const res = parseRosterInput(tsv, { context: "team" });
    assert.equal(res.totalRows, 2);
    assert.equal(res.validRows, 2);
    assert.equal(res.rows[0].email, "alex@college.edu");
    assert.equal(res.rows[0].fullName, "Alex Morgan");
    assert.equal(res.rows[0].jerseyNumber, 12);
    assert.equal(res.rows[0].volleyballPosition, "outside_hitter");
  });

  it("parses raw email list with newlines without headers", () => {
    const text = `
player1@school.edu
player2@school.edu
player3@school.edu
`;
    const res = parseRosterInput(text, { context: "school" });
    assert.equal(res.totalRows, 3);
    assert.equal(res.validRows, 3);
    assert.equal(res.rows[0].email, "player1@school.edu");
    assert.equal(res.rows[0].role, "member");
  });

  it("handles firstName and lastName columns", () => {
    const csv = `
email,first_name,last_name,jersey
john@school.edu,John,Doe,10
`;
    const res = parseRosterInput(csv);
    assert.equal(res.rows[0].fullName, "John Doe");
    assert.equal(res.rows[0].jerseyNumber, 10);
  });

  it("flags invalid emails and bad jersey numbers", () => {
    const csv = `
email,name,jersey
not-an-email,Bad Player,15
good@school.edu,Good Player,150
valid@school.edu,Valid Player,8
`;
    const res = parseRosterInput(csv);
    assert.equal(res.totalRows, 3);
    assert.equal(res.validRows, 1);
    assert.equal(res.invalidRows, 2);

    assert.equal(res.rows[0].valid, false);
    assert.match(res.rows[0].errors[0], /Invalid email format/);

    assert.equal(res.rows[1].valid, false);
    assert.match(res.rows[1].errors[0], /Invalid jersey number/);

    assert.equal(res.rows[2].valid, true);
  });

  it("detects and flags duplicate emails in the input", () => {
    const csv = `
email,name
dup@school.edu,Player One
other@school.edu,Player Two
dup@school.edu,Player One Repeat
`;
    const res = parseRosterInput(csv);
    assert.equal(res.totalRows, 3);
    assert.deepEqual(res.duplicateEmails, ["dup@school.edu"]);
    assert.match(res.rows[2].warnings[0], /Duplicate email in list/);
  });

  it("handles quoted CSV values with commas", () => {
    const csv = `
email,name,position,role,title
user1@school.edu,"Morgan, Alex",OH,officer,"VP, Operations"
`;
    const res = parseRosterInput(csv);
    assert.equal(res.rows[0].fullName, "Morgan, Alex");
    assert.equal(res.rows[0].title, "VP, Operations");
  });

  it("generates sample CSV templates for school and team", () => {
    const schoolSample = generateSampleRosterCsv("school");
    assert.match(schoolSample, /email,name,role,jersey,position,title/);

    const teamSample = generateSampleRosterCsv("team");
    assert.match(teamSample, /email,name,jersey,position,role/);
  });
});
