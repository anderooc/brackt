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

import { and, asc, eq, ne } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  matches,
  pools,
  sets,
  tournaments,
} from "@/lib/db/schema";
import { updateScoreSchema } from "@/lib/validators";
import {
  canEditMatchScores,
  canHostOverrideMatchScoring,
  canRunMatchLifecycle,
} from "@/lib/tournaments/match-control-permissions";
import { getMatchTournamentId } from "@/lib/tournaments/match-query";
import { revertTournamentIfBracketsIncomplete } from "@/lib/tournaments/tournament-completion";
import {
  upsertSetScore,
  completeMatchAndRunSideEffects,
} from "@/lib/tournaments/match-finalize";
import {
  completedSetsForFormat,
  evaluateMatchOutcome,
  shouldAutoFinalizeAfterScoreSave,
} from "@/lib/tournaments/match-format";
import { badRequest, forbidden, notFound } from "../errors";

type MatchRow = typeof matches.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;

interface ControlGate {
  tournament: TournamentRow;
  match: MatchRow;
  isOrganizer: boolean;
}

async function loadControlGate(
  matchId: string,
  user: AppUser
): Promise<ControlGate> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) throw notFound("Match not found.");

  const tournamentId = await getMatchTournamentId(matchId);
  if (!tournamentId) throw notFound("Match not found.");

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) throw notFound("Tournament not found.");

  const isOrganizer = await canHostOverrideMatchScoring(tournament, user);
  return { tournament, match, isOrganizer };
}

async function assertCanEditScores(matchId: string, user: AppUser) {
  const gate = await loadControlGate(matchId, user);
  if (!(await canEditMatchScores(gate.tournament, user, gate.match))) {
    throw forbidden(
      "Only the designated point keeper or host can edit scores for this match."
    );
  }
  return gate;
}

async function assertCanRunLifecycle(matchId: string, user: AppUser) {
  const gate = await loadControlGate(matchId, user);
  if (!(await canRunMatchLifecycle(gate.tournament, user, gate.match))) {
    throw forbidden(
      "Only the designated point keeper or host can run this match."
    );
  }
  return gate;
}

export async function startWarmupForViewer(matchId: string, user: AppUser) {
  const { match } = await assertCanRunLifecycle(matchId, user);

  if (match.status !== "upcoming") {
    throw badRequest("Warmup can only start before the match begins.");
  }

  await db
    .update(matches)
    .set({ warmupStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(matches.id, matchId));
}

export async function startMatchForViewer(matchId: string, user: AppUser) {
  const { match } = await assertCanRunLifecycle(matchId, user);

  if (match.status === "completed") {
    throw badRequest("This match is already completed.");
  }

  const now = new Date();
  await db
    .update(matches)
    .set({
      status: "in_progress",
      startedAt: match.startedAt ?? now,
      warmupStartedAt: match.warmupStartedAt ?? now,
      updatedAt: now,
    })
    .where(eq(matches.id, matchId));
}

export async function pauseMatchForViewer(matchId: string, user: AppUser) {
  const { match } = await assertCanRunLifecycle(matchId, user);

  if (match.status !== "in_progress") {
    throw badRequest("Only an in-progress match can be paused.");
  }

  await db
    .update(matches)
    .set({
      status: "upcoming",
      warmupStartedAt: null,
      startedAt: match.startedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));
}

export async function saveSetScoreForViewer(
  matchId: string,
  setNumber: number,
  teamAScore: number,
  teamBScore: number,
  user: AppUser
) {
  const parsed = updateScoreSchema.safeParse({
    matchId,
    setNumber,
    teamAScore,
    teamBScore,
  });
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid score.");
  }

  const { match, tournament } = await assertCanEditScores(matchId, user);

  const formatSettings = {
    format: tournament.matchFormat,
    targetScore: tournament.setTargetScore,
    tiebreakTargetScore: tournament.tiebreakTargetScore,
  };

  const setsBefore =
    match.teamAId && match.teamBId
      ? await db
          .select({ teamAScore: sets.teamAScore, teamBScore: sets.teamBScore })
          .from(sets)
          .where(eq(sets.matchId, matchId))
          .orderBy(asc(sets.setNumber))
      : [];
  const beforeOutcome =
    match.teamAId && match.teamBId
      ? evaluateMatchOutcome(
          { format: tournament.matchFormat },
          match.teamAId,
          match.teamBId,
          completedSetsForFormat(formatSettings, setsBefore)
        )
      : null;

  await upsertSetScore(matchId, setNumber, teamAScore, teamBScore);

  if (match.status !== "in_progress" && match.status !== "completed") {
    const now = new Date();
    await db
      .update(matches)
      .set({
        status: "in_progress",
        startedAt: match.startedAt ?? now,
        warmupStartedAt: match.warmupStartedAt ?? now,
        updatedAt: now,
      })
      .where(and(eq(matches.id, matchId), ne(matches.status, "completed")));
  }

  if (match.teamAId && match.teamBId && beforeOutcome) {
    const setsAfter = await db
      .select({ teamAScore: sets.teamAScore, teamBScore: sets.teamBScore })
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

      await completeMatchAndRunSideEffects({
        matchId,
        winnerId: afterOutcome.winnerId,
        tournamentId: tournament.id,
        divisionId: poolRow?.divisionId,
      });
    }
  }
}

export async function finalizeMatchForViewer(
  matchId: string,
  winnerId: string | null,
  user: AppUser
) {
  const { match, tournament } = await assertCanRunLifecycle(matchId, user);

  if (match.status === "completed") return;

  const [row] = await db
    .select({ poolId: matches.poolId, divisionId: pools.divisionId })
    .from(matches)
    .leftJoin(pools, eq(matches.poolId, pools.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  await completeMatchAndRunSideEffects({
    matchId,
    winnerId,
    tournamentId: tournament.id,
    divisionId: row?.divisionId,
  });
}

export async function reopenMatchForViewer(matchId: string, user: AppUser) {
  const { tournament, isOrganizer } = await loadControlGate(matchId, user);

  if (!isOrganizer) {
    throw forbidden("Only the host can reopen a completed match.");
  }

  await db
    .update(matches)
    .set({ status: "in_progress", winnerId: null, updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  await revertTournamentIfBracketsIncomplete(tournament.id);
}
