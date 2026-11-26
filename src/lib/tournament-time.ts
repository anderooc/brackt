/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

export const DEFAULT_TOURNAMENT_TIME_ZONE = "America/New_York";

export const TOURNAMENT_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
] as const;

const REGION_TIME_ZONES: Record<string, string> = {
  west: "America/Los_Angeles",
  northwest: "America/Los_Angeles",
  north: "America/Chicago",
  central: "America/Chicago",
  south: "America/Chicago",
};

/** Best guess for a new event's zone; hosts can change it in listing details. */
export function defaultTimeZoneForRegion(region: string): string {
  return REGION_TIME_ZONES[region] ?? DEFAULT_TOURNAMENT_TIME_ZONE;
}

export function isSupportedTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** "9:00 AM" in the given zone (or the runtime's zone when omitted). */
export function formatTimeInZone(
  value: Date | string,
  timeZone?: string | null
): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** Calendar date (YYYY-MM-DD) of `now` in the given zone. */
export function dateISOInZone(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
