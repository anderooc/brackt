"use server";

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

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { matches, pools, sets, tournaments } from "@/lib/db/schema";
import { asc, eq, and, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { updateScoreSchema } from "@/lib/validators";
import { canScoreMatches } from "@/lib/tournaments/permissions";
import { getMatchTournamentId } from "@/lib/tournaments/match-query";
import {
  upsertSetScore,
  completeMatchAndRunSideEffects,
} from "@/lib/tournaments/match-finalize";
import {
  completedSetsForFormat,
  evaluateMatchOutcome,
  shouldAutoFinalizeAfterScoreSave,
} from "@/lib/tournaments/match-format";

async function assertCanScoreMatch(matchId: string) {
  const user = await requireUser();
  const tournamentId = await getMatchTournamentId(matchId);

  if (!tournamentId) {
    return { error: "Match not found" as const, user: null, tournament: null };
  }

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || !await canScoreMatches(tournament, user)) {
    return {
      error: "Only the organizer can score matches while the event is in progress." as const,
      user: null,
      tournament: null,
    };
  }

  return { error: null, user, tournament };
}

export async function updateScore(formData: FormData) {
  const parsed = updateScoreSchema.safeParse({
    matchId: formData.get("matchId"),
    setNumber: parseInt(formData.get("setNumber") as string, 10),
    teamAScore: parseInt(formData.get("teamAScore") as string, 10),
    teamBScore: parseInt(formData.get("teamBScore") as string, 10),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { matchId, setNumber, teamAScore, teamBScore } = parsed.data;

  const gate = await assertCanScoreMatch(matchId);
  if (gate.error) return { error: gate.error };

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match) return { error: "Match not found" };

  const tournament = gate.tournament;
  const formatSettings = {
    format: tournament.matchFormat,
    targetScore: tournament.setTargetScore,
    tiebreakTargetScore: tournament.tiebreakTargetScore,
  };

  const setsBefore =
    match.teamAId && match.teamBId && match.status !== "completed"
      ? await db
          .select({
            teamAScore: sets.teamAScore,
            teamBScore: sets.teamBScore,
          })
          .from(sets)
          .where(eq(sets.matchId, matchId))
          .orderBy(asc(sets.setNumber))
      : [];
  const beforeOutcome =
    match.teamAId && match.teamBId && match.status !== "completed"
      ? evaluateMatchOutcome(
          { format: tournament.matchFormat },
          match.teamAId,
          match.teamBId,
          completedSetsForFormat(formatSettings, setsBefore)
        )
      : null;

  await upsertSetScore(matchId, setNumber, teamAScore, teamBScore);

  if (match.status === "upcoming") {
    await db
      .update(matches)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(
        and(eq(matches.id, matchId), ne(matches.status, "completed"))
      );
  }

  // Auto-finalize only when this save newly makes the match decidable
  // (reopen corrections must not re-complete on the first +1).
  if (match.teamAId && match.teamBId && beforeOutcome) {
    const setsAfter = await db
      .select({
        teamAScore: sets.teamAScore,
        teamBScore: sets.teamBScore,
      })
      .from(sets)
      .where(eq(sets.matchId, matchId))
      .orderBy(asc(sets.setNumber));

    const afterOutcome = evaluateMatchOutcome(
      { format: tournament.matchFormat },
      match.teamAId,
      match.teamBId,
      completedSetsForFormat(formatSettings, setsAfter)
    );

    if (
      shouldAutoFinalizeAfterScoreSave(
        beforeOutcome.shouldFinalize,
        afterOutcome.shouldFinalize
      )
    ) {
      const [poolRow] = match.poolId
        ? await db
            .select({ divisionId: pools.divisionId })
            .from(pools)
            .where(eq(pools.id, match.poolId))
            .limit(1)
        : [];

      const { newlyCompleted } = await completeMatchAndRunSideEffects({
        matchId,
        winnerId: afterOutcome.winnerId,
        tournamentId: tournament.id,
        divisionId: poolRow?.divisionId,
      });

      if (newlyCompleted) {
        revalidatePath("/tournaments/[slug]", "page");
      }
    }
  }

  revalidatePath(`/tournaments/[slug]/scoring`, "page");
  return { success: true };
}

export async function finalizeMatch(matchId: string, winnerId: string) {
  const gate = await assertCanScoreMatch(matchId);
  if (gate.error) return { error: gate.error };

  const [match] = await db
    .select({
      status: matches.status,
      poolId: matches.poolId,
      divisionId: pools.divisionId,
    })
    .from(matches)
    .leftJoin(pools, eq(matches.poolId, pools.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (match?.status === "completed") {
    return { success: true };
  }

  await completeMatchAndRunSideEffects({
    matchId,
    winnerId,
    tournamentId: gate.tournament!.id,
    divisionId: match?.divisionId,
  });

  revalidatePath(`/tournaments/[slug]/scoring`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true };
}

export async function startMatch(matchId: string) {
  const gate = await assertCanScoreMatch(matchId);
  if (gate.error) return { error: gate.error };

  await db
    .update(matches)
    .set({ status: "in_progress", updatedAt: new Date() })
    .where(
      and(eq(matches.id, matchId), ne(matches.status, "completed"))
    );

  revalidatePath(`/tournaments/[slug]/scoring`, "page");
  return { success: true };
}
