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
import type { TournamentDetailContract } from "@/lib/api/contracts/tournament";
import type { TournamentHostOverviewContract } from "@/lib/api/contracts/tournament-host";
import type { TournamentParticipationContract } from "@/lib/api/contracts/tournament-ops";

/**
 * The last loaded tournament screen, per slug and viewer, for this app session.
 * Reopening a tournament paints from here at once and refreshes underneath.
 */
export type CachedTournamentScreen = {
  tournament: TournamentDetailContract;
  /** Null until the viewer-specific requests finish (or when signed out). */
  viewer: {
    participation: TournamentParticipationContract | null;
    myMatches: PersonalScheduleMatchContract[];
    hostOverview: TournamentHostOverviewContract | null;
  } | null;
};

const MAX_ENTRIES = 20;
const cache = new Map<string, CachedTournamentScreen>();

function key(slug: string, viewerId: string | null) {
  return `${viewerId ?? "guest"}:${slug}`;
}

export function readTournamentScreen(slug: string, viewerId: string | null) {
  return cache.get(key(slug, viewerId)) ?? null;
}

export function writeTournamentScreen(
  slug: string,
  viewerId: string | null,
  entry: CachedTournamentScreen
) {
  const k = key(slug, viewerId);
  cache.delete(k);
  cache.set(k, entry);
  if (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value!);
  }
}
