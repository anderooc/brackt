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

import { TournamentCompleteIllustration } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

export type FinalSets = { winner: number; loser: number };

/** Sets won by each side of a finished match, winner first. */
export function finalSetsFor(
  sets: { teamAScore: number; teamBScore: number }[] | undefined,
  winnerIsTeamA: boolean
): FinalSets | null {
  if (!sets || sets.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.teamAScore > s.teamBScore) a++;
    else if (s.teamBScore > s.teamAScore) b++;
  }
  if (a === 0 && b === 0) return null;
  return winnerIsTeamA ? { winner: a, loser: b } : { winner: b, loser: a };
}

/**
 * Celebrates a decided bracket: trophy art, the champion in the brand
 * gradient, and how the final went.
 */
export function ChampionMoment({
  teamName,
  bracketName,
  runnerUpName,
  finalSets,
  className,
}: {
  teamName: string;
  bracketName: string;
  runnerUpName?: string | null;
  finalSets?: FinalSets | null;
  className?: string;
}) {
  const result = [
    runnerUpName ? `Beat ${runnerUpName} in the final` : "Won the final",
    finalSets ? `${finalSets.winner}–${finalSets.loser}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl bg-card bg-hero-wash px-5 py-5 text-center ring-1 ring-border/60 sm:flex-row sm:gap-6 sm:px-6 sm:text-left",
        "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-500",
        className
      )}
    >
      <TournamentCompleteIllustration
        viewBox="40 30 560 400"
        className="h-auto w-36 shrink-0 sm:w-40"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">
          {bracketName} champion
        </p>
        <p className="mt-1 text-balance font-heading text-3xl font-black italic leading-tight tracking-tight sm:text-4xl">
          <span className="text-gradient-brand">{teamName}</span>
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">{result}</p>
      </div>
    </div>
  );
}
