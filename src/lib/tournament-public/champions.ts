/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import type { BracketMatchContract } from "@/lib/api/contracts/tournament";
import type { DisplayBracket } from "@/lib/tournament-public/flatten-brackets";

export type BracketChampion = {
  teamName: string;
  runnerUpName: string | null;
  finalSets: { winner: number; loser: number } | null;
};

/** The completed final's winner, or null while the bracket is still live. */
export function findBracketChampion(
  matches: BracketMatchContract[]
): BracketChampion | null {
  if (matches.length === 0) return null;
  const lastRound = Math.max(...matches.map((m) => m.round));
  const final = matches
    .filter((m) => m.round === lastRound)
    .sort((a, b) => a.position - b.position)[0];
  if (!final || final.status !== "completed" || !final.winnerSlug) return null;

  const winnerIsA = final.teamA?.slug === final.winnerSlug;
  const winner = winnerIsA ? final.teamA : final.teamB;
  if (!winner || winner.slug !== final.winnerSlug) return null;
  const runnerUp = winnerIsA ? final.teamB : final.teamA;

  let a = 0;
  let b = 0;
  for (const s of final.sets) {
    if (s.teamAScore > s.teamBScore) a++;
    else if (s.teamBScore > s.teamAScore) b++;
  }
  const finalSets =
    a === 0 && b === 0
      ? null
      : winnerIsA
        ? { winner: a, loser: b }
        : { winner: b, loser: a };

  return {
    teamName: winner.name,
    runnerUpName: runnerUp?.name ?? null,
    finalSets,
  };
}

/** Champions for every decided bracket, in display order. */
export function decidedChampions(brackets: DisplayBracket[]) {
  return brackets.flatMap((bracket) => {
    const champion = findBracketChampion(bracket.matches);
    if (!champion) return [];
    const bracketName = bracket.contextName
      ? `${bracket.contextName} ${bracket.name}`
      : bracket.name;
    return [{ bracketName, ...champion }];
  });
}
