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

import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { resolveAppBaseUrl } from "@/lib/metadata";

/** Default match length when no end time is known (warmup + play). */
const DEFAULT_MATCH_DURATION_MS = 90 * 60 * 1000;

const ROLE_LABELS: Record<PersonalScheduleMatchContract["role"], string> = {
  playing: "Playing",
  reffing: "Reffing",
  crew: "Officiating",
  scorekeeping: "Scorekeeping",
};

/** RFC 5545 TEXT escaping. */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n/g, "\\n")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\n");
}

/** Format a Date as UTC iCalendar DATETIME (YYYYMMDDTHHMMSSZ). */
export function formatIcsUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const h = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const s = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

/**
 * Fold long content lines per RFC 5545 §3.1 (75 octets; continuation with
 * CRLF + space). ASCII-safe for our payloads.
 */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 0) {
    parts.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return parts.join("\r\n");
}

export type IcsEventInput = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  stamp?: Date;
};

export function buildIcsEvent(event: IcsEventInput): string {
  const stamp = event.stamp ?? new Date();
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatIcsUtc(stamp)}`,
    `DTSTART:${formatIcsUtc(event.start)}`,
    `DTEND:${formatIcsUtc(event.end)}`,
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.url) {
    lines.push(`URL:${escapeIcsText(event.url)}`);
  }
  lines.push("END:VEVENT");
  return lines.map(foldIcsLine).join("\r\n");
}

export function buildIcsCalendar(
  events: IcsEventInput[],
  options?: { productId?: string; name?: string }
): string {
  const productId = options?.productId ?? "-//brackt//EN";
  const calName = options?.name ?? "My schedule";
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${productId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    ...events.map((event) => buildIcsEvent(event)),
    "END:VCALENDAR",
  ];
  return `${body.join("\r\n")}\r\n`;
}

export function personalScheduleMatchToIcsEvent(
  match: PersonalScheduleMatchContract,
  options?: { baseUrl?: string; stamp?: Date }
): IcsEventInput {
  const baseUrl = options?.baseUrl ?? resolveAppBaseUrl();
  const start = new Date(match.warmupStart ?? match.scheduledTime);
  const end = new Date(start.getTime() + DEFAULT_MATCH_DURATION_MS);
  const role = ROLE_LABELS[match.role];
  const summary = `${role}: ${match.teamAName} vs ${match.teamBName}`;
  const descriptionParts = [
    match.tournamentName,
    match.contextLabel || null,
    `Role: ${role}`,
    match.myTeamName ? `Your team: ${match.myTeamName}` : null,
    match.refTeamName ? `Ref: ${match.refTeamName}` : null,
  ].filter(Boolean);

  return {
    uid: `match-${match.id}@brackt.app`,
    start,
    end,
    summary,
    description: descriptionParts.join("\n"),
    location: match.courtName,
    url: `${baseUrl}/tournaments/${match.tournamentSlug}/matches/${match.matchSlug}`,
    stamp: options?.stamp,
  };
}

export function buildPersonalScheduleIcs(
  matches: PersonalScheduleMatchContract[],
  options?: { baseUrl?: string; stamp?: Date; name?: string }
): string {
  const stamp = options?.stamp ?? new Date();
  const events = matches.map((match) =>
    personalScheduleMatchToIcsEvent(match, {
      baseUrl: options?.baseUrl,
      stamp,
    })
  );
  return buildIcsCalendar(events, {
    name: options?.name ?? "brackt · My schedule",
  });
}
