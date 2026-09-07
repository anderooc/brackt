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

import { VOLLEYBALL_POSITIONS } from "@/lib/constants/profile";
import { parseJerseyNumber } from "@/lib/profile/jersey-number";
import type { VolleyballPosition } from "@/types";

export type ParsedRosterRow = {
  rawIndex: number;
  email: string;
  fullName: string | null;
  jerseyNumber: number | null;
  volleyballPosition: VolleyballPosition | null;
  role: string;
  title: string | null;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export type ParseRosterResult = {
  rows: ParsedRosterRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateEmails: string[];
};

/** Normalizes volleyball position strings (e.g. "OH", "Outside", "Setter", "L/DS") */
export function normalizeVolleyballPosition(
  value: string | null | undefined
): VolleyballPosition | null | "invalid" {
  if (!value) return null;
  const raw = value.trim().toLowerCase().replace(/[-_/]/g, " ");

  if (raw === "" || raw === "none" || raw === "n/a" || raw === "-") {
    return null;
  }

  // Exact canonical match
  if ((VOLLEYBALL_POSITIONS as readonly string[]).includes(raw)) {
    return raw as VolleyballPosition;
  }

  // Common aliases and abbreviations
  if (
    raw === "oh" ||
    raw === "outside" ||
    raw === "outside hitter" ||
    raw === "left side" ||
    raw === "ls"
  ) {
    return "outside_hitter";
  }

  if (
    raw === "mb" ||
    raw === "middle" ||
    raw === "middle blocker" ||
    raw === "middle hitter" ||
    raw === "mh" ||
    raw === "m"
  ) {
    return "middle_blocker";
  }

  if (
    raw === "opp" ||
    raw === "opposite" ||
    raw === "opposite hitter" ||
    raw === "right side" ||
    raw === "rs" ||
    raw === "rh"
  ) {
    return "opposite_hitter";
  }

  if (raw === "s" || raw === "setter" || raw === "set") {
    return "setter";
  }

  if (
    raw === "l" ||
    raw === "ds" ||
    raw === "l ds" ||
    raw === "libero" ||
    raw === "defensive specialist" ||
    raw === "libero ds" ||
    raw === "def specialist"
  ) {
    return "libero_ds";
  }

  return "invalid";
}

/** Parses raw jersey number representation like "#12", "07", "5" */
export function normalizeJerseyNumber(
  value: string | null | undefined
): number | null | "invalid" {
  if (!value) return null;
  const cleaned = value.trim().replace(/^(?:#|no\.?\s*)/i, "");
  if (cleaned === "" || cleaned === "-" || cleaned.toLowerCase() === "n/a") {
    return null;
  }
  return parseJerseyNumber(cleaned);
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

/** Parse lines respecting quoted CSV values */
function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Detects the likely delimiter (comma, tab, semicolon) */
function detectDelimiter(headerOrFirstLine: string): string {
  if (headerOrFirstLine.includes("\t")) return "\t";
  if (headerOrFirstLine.includes(",")) return ",";
  if (headerOrFirstLine.includes(";")) return ";";
  return ",";
}

type ColumnMapping = {
  email: number;
  name?: number;
  firstName?: number;
  lastName?: number;
  jersey?: number;
  position?: number;
  role?: number;
  title?: number;
};

function normalizeHeaderName(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function detectHeaders(fields: string[]): ColumnMapping | null {
  const mapping: Partial<ColumnMapping> = {};

  for (let idx = 0; idx < fields.length; idx++) {
    const norm = normalizeHeaderName(fields[idx]);

    if (norm === "email" || norm === "emailaddress" || norm === "mail" || norm === "useremail") {
      mapping.email = idx;
    } else if (
      norm === "name" ||
      norm === "fullname" ||
      norm === "player" ||
      norm === "playername" ||
      norm === "athlete" ||
      norm === "membername"
    ) {
      mapping.name = idx;
    } else if (norm === "firstname" || norm === "first") {
      mapping.firstName = idx;
    } else if (norm === "lastname" || norm === "last") {
      mapping.lastName = idx;
    } else if (
      norm === "jersey" ||
      norm === "jerseynumber" ||
      norm === "number" ||
      norm === "uniform" ||
      norm === "num"
    ) {
      mapping.jersey = idx;
    } else if (
      norm === "position" ||
      norm === "pos" ||
      norm === "volleyballposition" ||
      norm === "primaryposition"
    ) {
      mapping.position = idx;
    } else if (norm === "role" || norm === "memberrole" || norm === "type") {
      mapping.role = idx;
    } else if (norm === "title" || norm === "officertitle" || norm === "positiontitle") {
      mapping.title = idx;
    }
  }

  if (mapping.email !== undefined) {
    return mapping as ColumnMapping;
  }

  return null;
}

/** Fallback heuristic when no explicit header row is found */
function inferMappingFromRow(fields: string[]): ColumnMapping {
  const mapping: Partial<ColumnMapping> = {};

  // Find email column
  for (let i = 0; i < fields.length; i++) {
    if (isValidEmail(fields[i])) {
      mapping.email = i;
      break;
    }
  }

  if (mapping.email === undefined) {
    mapping.email = 0;
  }

  // Look for other columns
  for (let i = 0; i < fields.length; i++) {
    if (i === mapping.email) continue;
    const val = fields[i].trim();

    // Check if it looks like a jersey number
    if (/^\d{1,2}$/.test(val) && mapping.jersey === undefined) {
      mapping.jersey = i;
      continue;
    }

    // Check if it looks like a position
    const pos = normalizeVolleyballPosition(val);
    if (pos !== null && pos !== "invalid" && mapping.position === undefined) {
      mapping.position = i;
      continue;
    }

    // Otherwise, first non-email text is probably a name
    if (val.length > 0 && mapping.name === undefined) {
      mapping.name = i;
    }
  }

  return mapping as ColumnMapping;
}

export function parseRosterInput(
  rawText: string,
  options?: {
    defaultRole?: string;
    context?: "school" | "team";
  }
): ParseRosterResult {
  const defaultRole =
    options?.defaultRole ?? (options?.context === "team" ? "player" : "member");
  const isTeam = options?.context === "team";

  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) {
    return {
      rows: [],
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateEmails: [],
    };
  }

  const delimiter = detectDelimiter(rawLines[0]);
  const firstLineFields = parseCsvLine(rawLines[0], delimiter);
  const detectedHeader = detectHeaders(firstLineFields);

  let startIndex = 0;
  let mapping: ColumnMapping;

  if (detectedHeader) {
    mapping = detectedHeader;
    startIndex = 1;
  } else {
    // If first line doesn't have headers, infer from the data
    mapping = inferMappingFromRow(firstLineFields);
    startIndex = 0;
  }

  const rows: ParsedRosterRow[] = [];
  const seenEmails = new Map<string, number>();
  const duplicateEmailsSet = new Set<string>();

  for (let i = startIndex; i < rawLines.length; i++) {
    const line = rawLines[i];
    const fields = parseCsvLine(line, delimiter);

    // Skip empty lines or comment lines
    if (fields.length === 0 || (fields.length === 1 && fields[0] === "")) {
      continue;
    }
    if (line.startsWith("#")) {
      continue;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const rawEmail = fields[mapping.email] ?? "";
    const email = rawEmail.trim().toLowerCase();

    if (!email) {
      errors.push("Missing email address");
    } else if (!isValidEmail(email)) {
      errors.push(`Invalid email format: "${rawEmail}"`);
    } else {
      const prevIndex = seenEmails.get(email);
      if (prevIndex !== undefined) {
        duplicateEmailsSet.add(email);
        warnings.push(`Duplicate email in list (already on row ${prevIndex + 1})`);
      } else {
        seenEmails.set(email, rows.length);
      }
    }

    // Name
    let fullName: string | null = null;
    if (mapping.name !== undefined && fields[mapping.name]) {
      fullName = fields[mapping.name].trim();
    } else if (
      mapping.firstName !== undefined ||
      mapping.lastName !== undefined
    ) {
      const first = mapping.firstName !== undefined ? fields[mapping.firstName]?.trim() ?? "" : "";
      const last = mapping.lastName !== undefined ? fields[mapping.lastName]?.trim() ?? "" : "";
      fullName = [first, last].filter(Boolean).join(" ") || null;
    }

    // Jersey Number
    let jerseyNumber: number | null = null;
    if (mapping.jersey !== undefined && fields[mapping.jersey]) {
      const parsedJersey = normalizeJerseyNumber(fields[mapping.jersey]);
      if (parsedJersey === "invalid") {
        errors.push(`Invalid jersey number: "${fields[mapping.jersey]}" (must be 0–99)`);
      } else {
        jerseyNumber = parsedJersey;
      }
    }

    // Volleyball Position
    let volleyballPosition: VolleyballPosition | null = null;
    if (mapping.position !== undefined && fields[mapping.position]) {
      const parsedPos = normalizeVolleyballPosition(fields[mapping.position]);
      if (parsedPos === "invalid") {
        warnings.push(`Unrecognized volleyball position: "${fields[mapping.position]}"`);
      } else {
        volleyballPosition = parsedPos;
      }
    }

    // Role & Title
    let role = defaultRole;
    let title: string | null = null;

    if (mapping.role !== undefined && fields[mapping.role]) {
      const rawRole = fields[mapping.role].trim().toLowerCase();
      if (isTeam) {
        if (rawRole === "captain" || rawRole === "co-captain" || rawRole === "capt") {
          role = "captain";
        } else {
          role = "player";
        }
      } else {
        if (rawRole === "president" || rawRole === "pres") {
          role = "president";
        } else if (
          rawRole === "officer" ||
          rawRole === "vp" ||
          rawRole === "vice president" ||
          rawRole === "treasurer" ||
          rawRole === "secretary"
        ) {
          role = "officer";
          if (rawRole !== "officer") {
            title = fields[mapping.role].trim();
          }
        } else {
          role = "member";
        }
      }
    }

    if (mapping.title !== undefined && fields[mapping.title]) {
      title = fields[mapping.title].trim() || title;
    }

    rows.push({
      rawIndex: i + 1,
      email,
      fullName,
      jerseyNumber,
      volleyballPosition,
      role,
      title,
      valid: errors.length === 0,
      errors,
      warnings,
    });
  }

  const validRows = rows.filter((r) => r.valid).length;

  return {
    rows,
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    duplicateEmails: Array.from(duplicateEmailsSet),
  };
}

/** Generates sample CSV template for users to copy or download */
export function generateSampleRosterCsv(context: "school" | "team" = "school"): string {
  if (context === "team") {
    return [
      "email,name,jersey,position,role",
      "alex.morgan@college.edu,Alex Morgan,12,OH,player",
      "sam.lee@college.edu,Sam Lee,5,Setter,captain",
      "jordan.bell@college.edu,Jordan Bell,9,MB,player",
      "pat.chen@college.edu,Pat Chen,14,L/DS,player",
      "chris.taylor@college.edu,Chris Taylor,7,Opp,player",
    ].join("\n");
  }

  return [
    "email,name,role,jersey,position,title",
    "alex.morgan@college.edu,Alex Morgan,member,12,OH,",
    "sam.lee@college.edu,Sam Lee,officer,5,Setter,Vice President",
    "jordan.bell@college.edu,Jordan Bell,member,9,MB,",
    "pat.chen@college.edu,Pat Chen,member,14,L/DS,",
    "taylor.swift@college.edu,Taylor Swift,officer,22,Opp,Treasurer",
  ].join("\n");
}
