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
import { and, asc, eq, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { updateScoreSchema } from "@/lib/validators";
import {
  canEditMatchScores,
  canHostOverrideMatchScoring,
  canRunMatchLifecycle,
} from "@/lib/tournaments/match-control-permissions";
import { getMatchTournamentId } from "@/lib/tournaments/match-query";
import { assertNoCourtScheduleConflict } from "@/lib/tournaments/court-schedule";
import { assignBracketRefsForBracket } from "@/lib/tournaments/bracket-structure";
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
import { isTournamentArchived } from "@/lib/tournament-status";
import { toApiError } from "@/lib/api/errors";
import {
  claimPointKeeperForViewer,
  claimRefCrewSlotForViewer,
  releasePointKeeperForViewer,
  releaseRefCrewSlotForViewer,
} from "@/lib/api/queries/match-ref-crew-mutations";
import {
  parseMatchRefCrewRole,
  type MatchRefCrewRole,
} from "@/lib/tournaments/match-ref-crew";
import { resolveIsTournamentOrganizer } from "@/lib/tournaments/permissions";

type MatchRow = typeof matches.$inferSelect;
type TournamentRow = typeof tournaments.$inferSelect;

interface ControlGate {
  error: string | null;
  user: { id: string; role: string } | null;
  tournament: TournamentRow | null;
  match: MatchRow | null;
  isOrganizer: boolean;
}

async function loadControlGate(matchId: string): Promise<ControlGate> {
  const fail = (error: string): ControlGate => ({
    error,
    user: null,
    tournament: null,
    match: null,
    isOrganizer: false,
  });

  const user = await requireUser();

  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);
  if (!match) return fail("Match not found");

  const tournamentId = await getMatchTournamentId(matchId);
  if (!tournamentId) return fail("Match not found");

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return fail("Tournament not found");

  const isOrganizer = await canHostOverrideMatchScoring(tournament, user);

  return { error: null, user, tournament, match, isOrganizer };
}

async function assertCanEditScores(matchId: string): Promise<ControlGate> {
  const gate = await loadControlGate(matchId);
  if (gate.error || !gate.user || !gate.tournament || !gate.match) return gate;
  if (!(await canEditMatchScores(gate.tournament, gate.user, gate.match))) {
    return {
      ...gate,
      error:
        "Only the designated point keeper or host can edit scores for this match.",
    };
  }
  return gate;
}

async function assertCanRunLifecycle(matchId: string): Promise<ControlGate> {
  const gate = await loadControlGate(matchId);
  if (gate.error || !gate.user || !gate.tournament || !gate.match) return gate;
  if (!(await canRunMatchLifecycle(gate.tournament, gate.user, gate.match))) {
    return {
      ...gate,
      error:
        "Only the designated point keeper or host can run this match.",
    };
  }
  return gate;
}

export async function startWarmup(matchId: string) {
  const gate = await assertCanRunLifecycle(matchId);
  if (gate.error || !gate.match) return { error: gate.error };

  if (gate.match.status !== "upcoming") {
    return { error: "Warmup can only start before the match begins." };
  }

  await db
    .update(matches)
    .set({ warmupStartedAt: new Date(), updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function startMatch(matchId: string) {
  const gate = await assertCanRunLifecycle(matchId);
  if (gate.error || !gate.match) return { error: gate.error };

  if (gate.match.status === "completed") {
    return { error: "This match is already completed." };
  }

  const now = new Date();
  await db
    .update(matches)
    .set({
      status: "in_progress",
      startedAt: gate.match.startedAt ?? now,
      warmupStartedAt: gate.match.warmupStartedAt ?? now,
      updatedAt: now,
    })
    .where(eq(matches.id, matchId));

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

/**
 * Take a live match out of in-progress. Scores and `startedAt` are kept so the
 * ref can resume later; status returns to `upcoming` and warmup is cleared.
 */
export async function pauseMatch(matchId: string) {
  const gate = await assertCanRunLifecycle(matchId);
  if (gate.error || !gate.match) return { error: gate.error };

  if (gate.match.status !== "in_progress") {
    return { error: "Only an in-progress match can be paused." };
  }

  await db
    .update(matches)
    .set({
      status: "upcoming",
      warmupStartedAt: null,
      // Preserve startedAt so the console treats this as paused, not fresh.
      startedAt: gate.match.startedAt ?? new Date(),
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

/**
 * Save absolute scores for a single set. The client scorekeeper debounces +1/-1
 * taps and sends the resulting totals here. Auto-finalizes only when this save
 * newly makes the match decidable (reopen corrections stay editable until then
 * or until an explicit finalize).
 */
export async function saveSetScore(formData: FormData) {
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

  const gate = await assertCanEditScores(matchId);
  if (gate.error || !gate.match || !gate.tournament) {
    return { error: gate.error };
  }

  const formatSettings = {
    format: gate.tournament.matchFormat,
    targetScore: gate.tournament.setTargetScore,
    tiebreakTargetScore: gate.tournament.tiebreakTargetScore,
  };

  // Snapshot before the write so reopen corrections (already-complete sets)
  // do not auto-finalize again on the first +1.
  const setsBefore =
    gate.match.teamAId && gate.match.teamBId
      ? await db
          .select({ teamAScore: sets.teamAScore, teamBScore: sets.teamBScore })
          .from(sets)
          .where(eq(sets.matchId, matchId))
          .orderBy(asc(sets.setNumber))
      : [];
  const beforeOutcome =
    gate.match.teamAId && gate.match.teamBId
      ? evaluateMatchOutcome(
          { format: gate.tournament.matchFormat },
          gate.match.teamAId,
          gate.match.teamBId,
          completedSetsForFormat(formatSettings, setsBefore)
        )
      : null;

  await upsertSetScore(matchId, setNumber, teamAScore, teamBScore);

  // First score entry promotes an upcoming/warmup match to in progress.
  if (gate.match.status !== "in_progress" && gate.match.status !== "completed") {
    const now = new Date();
    await db
      .update(matches)
      .set({
        status: "in_progress",
        startedAt: gate.match.startedAt ?? now,
        warmupStartedAt: gate.match.warmupStartedAt ?? now,
        updatedAt: now,
      })
      .where(
        and(eq(matches.id, matchId), ne(matches.status, "completed"))
      );
  }

  if (gate.match.teamAId && gate.match.teamBId && beforeOutcome) {
    const setsAfter = await db
      .select({ teamAScore: sets.teamAScore, teamBScore: sets.teamBScore })
      .from(sets)
      .where(eq(sets.matchId, matchId))
      .orderBy(asc(sets.setNumber));

    // Only fully-finished sets (target reached, win by two) count toward
    // finalizing — running scores from the live scorekeeper must not trip an
    // early finish.
    const afterOutcome = evaluateMatchOutcome(
      { format: gate.tournament.matchFormat },
      gate.match.teamAId,
      gate.match.teamBId,
      completedSetsForFormat(formatSettings, setsAfter)
    );

    if (
      shouldAutoFinalizeAfterScoreSave(
        beforeOutcome.shouldFinalize,
        afterOutcome.shouldFinalize
      )
    ) {
      const [poolRow] = gate.match.poolId
        ? await db
            .select({ divisionId: pools.divisionId })
            .from(pools)
            .where(eq(pools.id, gate.match.poolId))
            .limit(1)
        : [];

      await completeMatchAndRunSideEffects({
        matchId,
        winnerId: afterOutcome.winnerId,
        tournamentId: gate.tournament.id,
        divisionId: poolRow?.divisionId,
      });
    }
  }

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function finalizeMatch(matchId: string, winnerId: string | null) {
  const gate = await assertCanRunLifecycle(matchId);
  if (gate.error || !gate.match) return { error: gate.error };

  if (gate.match.status === "completed") {
    return { success: true as const };
  }

  const [row] = await db
    .select({ poolId: matches.poolId, divisionId: pools.divisionId })
    .from(matches)
    .leftJoin(pools, eq(matches.poolId, pools.id))
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!gate.tournament) {
    return { error: "Tournament not found" };
  }

  await completeMatchAndRunSideEffects({
    matchId,
    winnerId,
    tournamentId: gate.tournament.id,
    divisionId: row?.divisionId,
  });

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

/** Host-only: reopen a completed match for corrections. */
export async function reopenMatch(matchId: string) {
  const gate = await assertCanRunLifecycle(matchId);
  if (gate.error || !gate.match) return { error: gate.error };
  if (!gate.isOrganizer) {
    return { error: "Only the host can reopen a completed match." };
  }

  await db
    .update(matches)
    .set({ status: "in_progress", winnerId: null, updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  if (gate.tournament) {
    await revertTournamentIfBracketsIncomplete(gate.tournament.id);
  }

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

/** Host-only: edit a match's planned start time from the match/pool/bracket UI. */
export async function updateMatchScheduledTime(
  matchId: string,
  isoTime: string | null
) {
  const user = await requireUser();
  const tournamentId = await getMatchTournamentId(matchId);
  if (!tournamentId) return { error: "Match not found" };

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || !await resolveIsTournamentOrganizer(tournament, user)) {
    return { error: "Only the host can edit the start time." };
  }
  if (isTournamentArchived(tournament.date)) {
    return { error: "This tournament is archived." };
  }

  let scheduledTime: Date | null = null;
  if (isoTime) {
    const parsed = new Date(isoTime);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Enter a valid start time." };
    }
    scheduledTime = parsed;
  }

  const [match] = await db
    .select({
      bracketId: matches.bracketId,
      courtId: matches.courtId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (scheduledTime) {
    const conflict = await assertNoCourtScheduleConflict({
      tournamentId,
      matchId,
      courtId: match?.courtId ?? null,
      scheduledTime,
    });
    if (conflict) return conflict;
  }

  await db
    .update(matches)
    .set({ scheduledTime, updatedAt: new Date() })
    .where(eq(matches.id, matchId));

  if (match?.bracketId) {
    await assignBracketRefsForBracket(match.bracketId, db, {
      resetRoundOneCourtId: match.courtId,
    });
  }

  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

function revalidateMatchPages() {
  revalidatePath(`/tournaments/[slug]/matches/[matchSlug]`, "page");
  revalidatePath("/tournaments/[slug]", "page");
}

async function runCrewMutation(
  _matchId: string,
  run: (user: Awaited<ReturnType<typeof requireUser>>) => Promise<unknown>
) {
  try {
    const user = await requireUser();
    await run(user);
    revalidateMatchPages();
    return { success: true as const };
  } catch (cause) {
    const error = toApiError(cause);
    return { error: error.message };
  }
}

export async function claimRefCrewSlot(matchId: string, role: MatchRefCrewRole) {
  return runCrewMutation(matchId, (user) =>
    claimRefCrewSlotForViewer(matchId, role, user)
  );
}

export async function releaseRefCrewSlot(matchId: string) {
  return runCrewMutation(matchId, (user) =>
    releaseRefCrewSlotForViewer(matchId, user)
  );
}

export async function claimPointKeeper(matchId: string) {
  return runCrewMutation(matchId, (user) =>
    claimPointKeeperForViewer(matchId, user)
  );
}

export async function releasePointKeeper(matchId: string) {
  return runCrewMutation(matchId, (user) =>
    releasePointKeeperForViewer(matchId, user)
  );
}

export async function claimRefCrewSlotFromForm(formData: FormData) {
  const matchId = formData.get("matchId");
  const role = parseMatchRefCrewRole(formData.get("role"));
  if (typeof matchId !== "string" || !matchId) {
    return { error: "Match not found." };
  }
  if (role === "invalid") {
    return { error: "Choose a crew role." };
  }
  return claimRefCrewSlot(matchId, role);
}
