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

import { bracketAdvanceTarget } from "@/lib/utils/bracket";

/**
 * In-memory checks over already-loaded play data. Bracket writes normally
 * happen when matches finish or settings change; pages use these to run the
 * matching repair only when stored data is actually out of step.
 */

type HealthMatch = {
  bracketRound: number | null;
  bracketPosition: number | null;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  status: string;
};

export function bracketHasTeams(matches: readonly HealthMatch[]): boolean {
  return matches.some((m) => m.teamAId != null || m.teamBId != null);
}

/** Match rows exist but no team was ever placed (pre-sized legacy tree). */
export function bracketHasUnseededTree(
  matches: readonly HealthMatch[]
): boolean {
  return matches.length > 0 && !bracketHasTeams(matches);
}

/**
 * True when a completed match's winner is missing from the next-round slot it
 * feeds, i.e. `repairBracketWinnerAdvances` would change something.
 */
export function bracketHasStaleAdvance(
  matches: readonly HealthMatch[]
): boolean {
  for (const m of matches) {
    if (
      m.status !== "completed" ||
      !m.winnerId ||
      m.bracketRound == null ||
      m.bracketPosition == null
    ) {
      continue;
    }
    const feed = bracketAdvanceTarget(m.bracketRound, m.bracketPosition);
    const next = matches.find(
      (n) => n.bracketRound === feed.round && n.bracketPosition === feed.position
    );
    if (!next) continue;
    const placed = feed.slot === "A" ? next.teamAId : next.teamBId;
    if (placed !== m.winnerId) return true;
  }
  return false;
}

/** Every pool has matches and all of them are finished. */
export function poolPlayFinished(
  pools: readonly { matches: readonly { status: string }[] }[]
): boolean {
  return (
    pools.length > 0 &&
    pools.every(
      (p) =>
        p.matches.length > 0 && p.matches.every((m) => m.status === "completed")
    )
  );
}
