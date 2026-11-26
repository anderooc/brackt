/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type {
  PublicMatchStatus,
  TournamentMatchSetContract,
} from "@/lib/api/contracts/tournament";
import { formatTimeInZone } from "@/lib/tournament-time";

export const MATCH_STATUS_LABELS: Record<PublicMatchStatus, string> = {
  upcoming: "Upcoming",
  in_progress: "Live",
  completed: "Final",
};

export function formatMatchTime(iso: string, timeZone: string): string {
  return formatTimeInZone(iso, timeZone);
}

export function formatSetLine(sets: TournamentMatchSetContract[]): string | null {
  if (sets.length === 0) return null;
  return sets
    .map((set) => `${set.teamAScore}-${set.teamBScore}`)
    .join(", ");
}

export function bracketRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
}
