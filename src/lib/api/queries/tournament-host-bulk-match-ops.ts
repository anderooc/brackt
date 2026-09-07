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

import "server-only";

import { and, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { courts, matches, poolTeams } from "@/lib/db/schema";
import { assignBracketRefsForBracket } from "@/lib/tournaments/bracket-structure";
import {
  eligibleBracketRefIds,
  type BracketMatchForRefs,
} from "@/lib/tournaments/bracket-refs";
import { loadTournamentCourtOccupancy } from "@/lib/tournaments/court-schedule";
import { resolveCourtScheduleApplies } from "@/lib/utils/court-schedule-conflict";
import { isTournamentArchived } from "@/lib/tournament-status";
import { badRequest } from "../errors";
import { requireHostTournament } from "./tournament-host";
import type {
  TournamentHostBulkMatchAction,
  TournamentHostBulkMatchesRequestContract,
} from "../contracts/tournament-host";

export interface BulkMatchOpsResult {
  success: true;
  action: TournamentHostBulkMatchAction;
  updatedCount: number;
  skippedCount: number;
  message: string;
}

export async function bulkReassignCourtsInternal(
  tournamentId: string,
  matchIds: string[],
  courtId: string | null
): Promise<{ updatedCount: number; skippedCount: number; message: string }> {
  if (matchIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0, message: "No matches selected." };
  }

  let courtName = "Unassigned";
  if (courtId !== null) {
    const [court] = await db
      .select({ id: courts.id, name: courts.name })
      .from(courts)
      .where(and(eq(courts.id, courtId), eq(courts.tournamentId, tournamentId)))
      .limit(1);
    if (!court) {
      throw badRequest("Court not found.");
    }
    courtName = court.name;
  }

  const targetMatches = await db
    .select({
      id: matches.id,
      bracketId: matches.bracketId,
      status: matches.status,
      courtId: matches.courtId,
      scheduledTime: matches.scheduledTime,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.id, matchIds),
        ne(matches.status, "completed")
      )
    );

  if (targetMatches.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      message: "No active matches found to update.",
    };
  }

  if (courtId === null) {
    await db
      .update(matches)
      .set({ courtId: null, updatedAt: new Date() })
      .where(inArray(matches.id, targetMatches.map((m) => m.id)));

    const bracketIds = [
      ...new Set(targetMatches.map((m) => m.bracketId).filter((v): v is string => Boolean(v))),
    ];
    for (const bId of bracketIds) {
      await assignBracketRefsForBracket(bId, db, { resetRoundOneCourtId: null });
    }

    return {
      updatedCount: targetMatches.length,
      skippedCount: 0,
      message: `Removed court assignment from ${targetMatches.length} match(es).`,
    };
  }

  const occupancy = await loadTournamentCourtOccupancy(tournamentId);
  const timedMatches = targetMatches.filter((m) => m.scheduledTime != null);
  const untimedMatches = targetMatches.filter((m) => m.scheduledTime == null);

  const candidates = timedMatches.map((m) => ({
    matchId: m.id,
    courtId,
    currentTime: m.scheduledTime,
    proposedIso: m.scheduledTime!.toISOString(),
  }));

  const { accepted, rejectedIds } = resolveCourtScheduleApplies(candidates, occupancy);
  const acceptedIds = [
    ...untimedMatches.map((m) => m.id),
    ...accepted.map((c) => c.matchId),
  ];

  if (acceptedIds.length > 0) {
    await db
      .update(matches)
      .set({ courtId, updatedAt: new Date() })
      .where(inArray(matches.id, acceptedIds));

    const updatedBracketMatches = targetMatches.filter((m) =>
      acceptedIds.includes(m.id) && m.bracketId
    );
    const bracketIds = [
      ...new Set(updatedBracketMatches.map((m) => m.bracketId!).filter(Boolean)),
    ];
    for (const bId of bracketIds) {
      await assignBracketRefsForBracket(bId, db, { resetRoundOneCourtId: courtId });
    }
  }

  const skipped = rejectedIds.size;
  const message =
    skipped > 0
      ? `Assigned ${acceptedIds.length} match(es) to ${courtName}. ${skipped} match(es) skipped due to schedule conflicts.`
      : `Assigned ${acceptedIds.length} match(es) to ${courtName}.`;

  return {
    updatedCount: acceptedIds.length,
    skippedCount: skipped,
    message,
  };
}

export async function bulkShiftMatchTimesInternal(
  tournamentId: string,
  options: {
    minutes: number;
    matchIds?: string[];
    courtId?: string;
    afterIso?: string | null;
  }
): Promise<{ updatedCount: number; skippedCount: number; message: string }> {
  const { minutes, matchIds, courtId, afterIso } = options;
  if (!Number.isInteger(minutes) || minutes === 0) {
    throw badRequest("Enter a non-zero whole number of minutes to shift.");
  }
  if (Math.abs(minutes) > 720) {
    throw badRequest("Time shift cannot exceed 12 hours.");
  }

  let queryWhere = and(
    eq(matches.tournamentId, tournamentId),
    ne(matches.status, "completed"),
    isNotNull(matches.scheduledTime)
  );

  if (matchIds && matchIds.length > 0) {
    queryWhere = and(queryWhere, inArray(matches.id, matchIds));
  } else if (courtId) {
    queryWhere = and(queryWhere, eq(matches.courtId, courtId));
    if (afterIso) {
      const parsedAfter = new Date(afterIso);
      if (!Number.isNaN(parsedAfter.getTime())) {
        queryWhere = and(queryWhere, gte(matches.scheduledTime, parsedAfter));
      }
    }
  } else {
    throw badRequest("Provide matchIds or a courtId to shift times.");
  }

  const targetMatches = await db
    .select({
      id: matches.id,
      bracketId: matches.bracketId,
      status: matches.status,
      courtId: matches.courtId,
      scheduledTime: matches.scheduledTime,
    })
    .from(matches)
    .where(queryWhere);

  if (targetMatches.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      message: "No scheduled active matches found to shift.",
    };
  }

  const occupancy = await loadTournamentCourtOccupancy(tournamentId);
  const onCourtMatches = targetMatches.filter((m) => m.courtId != null);
  const offCourtMatches = targetMatches.filter((m) => m.courtId == null);

  const candidates = onCourtMatches.map((m) => ({
    matchId: m.id,
    courtId: m.courtId,
    currentTime: m.scheduledTime,
    proposedIso: new Date(m.scheduledTime!.getTime() + minutes * 60_000).toISOString(),
  }));

  const { accepted, rejectedIds } = resolveCourtScheduleApplies(candidates, occupancy);
  const acceptedIds = new Set([
    ...offCourtMatches.map((m) => m.id),
    ...accepted.map((c) => c.matchId),
  ]);

  for (const match of targetMatches) {
    if (!acceptedIds.has(match.id)) continue;
    const newScheduledTime = new Date(match.scheduledTime!.getTime() + minutes * 60_000);
    await db
      .update(matches)
      .set({ scheduledTime: newScheduledTime, updatedAt: new Date() })
      .where(eq(matches.id, match.id));
  }

  const bracketIds = [
    ...new Set(
      targetMatches
        .filter((m) => acceptedIds.has(m.id) && m.bracketId)
        .map((m) => m.bracketId!)
    ),
  ];
  for (const bId of bracketIds) {
    await assignBracketRefsForBracket(bId, db);
  }

  const sign = minutes > 0 ? `+${minutes}` : `${minutes}`;
  const skipped = rejectedIds.size;
  const message =
    skipped > 0
      ? `Shifted ${acceptedIds.size} match(es) by ${sign}m. ${skipped} match(es) skipped due to court schedule conflicts.`
      : `Shifted ${acceptedIds.size} match(es) by ${sign}m.`;

  return {
    updatedCount: acceptedIds.size,
    skippedCount: skipped,
    message,
  };
}

export async function bulkReassignRefsInternal(
  tournamentId: string,
  matchIds: string[],
  refTeamId: string | null
): Promise<{ updatedCount: number; skippedCount: number; message: string }> {
  if (matchIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0, message: "No matches selected." };
  }

  const targetMatches = await db
    .select({
      id: matches.id,
      poolId: matches.poolId,
      bracketId: matches.bracketId,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId,
      status: matches.status,
      courtId: matches.courtId,
      scheduledTime: matches.scheduledTime,
      winnerId: matches.winnerId,
      bracketRound: matches.bracketRound,
      bracketPosition: matches.bracketPosition,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.id, matchIds),
        ne(matches.status, "completed")
      )
    );

  if (targetMatches.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      message: "No active matches found to update.",
    };
  }

  if (refTeamId === null) {
    await db
      .update(matches)
      .set({ refTeamId: null, updatedAt: new Date() })
      .where(inArray(matches.id, targetMatches.map((m) => m.id)));

    return {
      updatedCount: targetMatches.length,
      skippedCount: 0,
      message: `Cleared working team for ${targetMatches.length} match(es).`,
    };
  }

  const bracketIds = [
    ...new Set(targetMatches.map((m) => m.bracketId).filter((v): v is string => Boolean(v))),
  ];
  const bracketMatchesByBracket = new Map<string, BracketMatchForRefs[]>();
  for (const bId of bracketIds) {
    const rows = await db
      .select({
        id: matches.id,
        bracketRound: matches.bracketRound,
        bracketPosition: matches.bracketPosition,
        teamAId: matches.teamAId,
        teamBId: matches.teamBId,
        winnerId: matches.winnerId,
        status: matches.status,
        courtId: matches.courtId,
        scheduledTime: matches.scheduledTime,
      })
      .from(matches)
      .where(eq(matches.bracketId, bId));

    bracketMatchesByBracket.set(
      bId,
      rows
        .filter((r) => r.bracketRound != null && r.bracketPosition != null)
        .map((r) => ({
          id: r.id,
          bracketRound: r.bracketRound!,
          bracketPosition: r.bracketPosition!,
          teamAId: r.teamAId,
          teamBId: r.teamBId,
          winnerId: r.winnerId,
          status: r.status,
          courtId: r.courtId,
          scheduledTime: r.scheduledTime,
        }))
    );
  }

  const poolIds = [
    ...new Set(targetMatches.map((m) => m.poolId).filter((v): v is string => Boolean(v))),
  ];
  const poolTeamIdsByPool = new Map<string, Set<string>>();
  if (poolIds.length > 0) {
    const members = await db
      .select({ poolId: poolTeams.poolId, teamId: poolTeams.teamId })
      .from(poolTeams)
      .where(inArray(poolTeams.poolId, poolIds));
    for (const m of members) {
      let set = poolTeamIdsByPool.get(m.poolId);
      if (!set) {
        set = new Set();
        poolTeamIdsByPool.set(m.poolId, set);
      }
      set.add(m.teamId);
    }
  }

  const validMatchIds: string[] = [];
  let skipped = 0;

  for (const match of targetMatches) {
    if (refTeamId === match.teamAId || refTeamId === match.teamBId) {
      skipped++;
      continue;
    }

    if (match.poolId) {
      const teamsInPool = poolTeamIdsByPool.get(match.poolId);
      if (!teamsInPool || !teamsInPool.has(refTeamId)) {
        skipped++;
        continue;
      }
    }

    if (match.bracketId) {
      const allInBracket = bracketMatchesByBracket.get(match.bracketId) ?? [];
      const target = allInBracket.find((r) => r.id === match.id);
      if (!target) {
        skipped++;
        continue;
      }
      const eligible = eligibleBracketRefIds(target, allInBracket);
      if (!eligible.includes(refTeamId)) {
        skipped++;
        continue;
      }
    }

    validMatchIds.push(match.id);
  }

  if (validMatchIds.length > 0) {
    await db
      .update(matches)
      .set({ refTeamId, updatedAt: new Date() })
      .where(inArray(matches.id, validMatchIds));
  }

  const message =
    skipped > 0
      ? `Assigned ref team for ${validMatchIds.length} match(es). ${skipped} match(es) skipped (team not eligible or playing).`
      : `Assigned ref team for ${validMatchIds.length} match(es).`;

  return {
    updatedCount: validMatchIds.length,
    skippedCount: skipped,
    message,
  };
}

export async function bulkClearScheduleInternal(
  tournamentId: string,
  matchIds: string[],
  options: { clearTime?: boolean; clearCourt?: boolean }
): Promise<{ updatedCount: number; skippedCount: number; message: string }> {
  if (matchIds.length === 0) {
    return { updatedCount: 0, skippedCount: 0, message: "No matches selected." };
  }
  if (!options.clearTime && !options.clearCourt) {
    return { updatedCount: 0, skippedCount: 0, message: "Choose time or court to clear." };
  }

  const targetMatches = await db
    .select({
      id: matches.id,
      bracketId: matches.bracketId,
      status: matches.status,
    })
    .from(matches)
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        inArray(matches.id, matchIds),
        ne(matches.status, "completed")
      )
    );

  if (targetMatches.length === 0) {
    return {
      updatedCount: 0,
      skippedCount: 0,
      message: "No active matches found to update.",
    };
  }

  const patch: Partial<typeof matches.$inferInsert> = { updatedAt: new Date() };
  if (options.clearTime) patch.scheduledTime = null;
  if (options.clearCourt) patch.courtId = null;

  await db
    .update(matches)
    .set(patch)
    .where(inArray(matches.id, targetMatches.map((m) => m.id)));

  if (options.clearCourt) {
    const bracketIds = [
      ...new Set(targetMatches.map((m) => m.bracketId).filter((v): v is string => Boolean(v))),
    ];
    for (const bId of bracketIds) {
      await assignBracketRefsForBracket(bId, db, { resetRoundOneCourtId: null });
    }
  }

  const parts: string[] = [];
  if (options.clearTime) parts.push("start times");
  if (options.clearCourt) parts.push("courts");
  const clearedLabel = parts.join(" and ");

  return {
    updatedCount: targetMatches.length,
    skippedCount: 0,
    message: `Cleared ${clearedLabel} for ${targetMatches.length} match(es).`,
  };
}

export async function executeBulkMatchOps(
  slug: string,
  user: AppUser,
  request: TournamentHostBulkMatchesRequestContract
): Promise<BulkMatchOpsResult> {
  const tournament = await requireHostTournament(slug, user);
  if (isTournamentArchived(tournament.date)) {
    throw badRequest("This tournament is archived.");
  }

  switch (request.action) {
    case "reassign_court": {
      const matchIds = request.matchIds ?? [];
      const courtId = request.courtId ?? null;
      const res = await bulkReassignCourtsInternal(tournament.id, matchIds, courtId);
      return { success: true, action: request.action, ...res };
    }
    case "shift_time": {
      const minutes = request.minutes;
      if (minutes === undefined) {
        throw badRequest("Provide minutes to shift.");
      }
      const res = await bulkShiftMatchTimesInternal(tournament.id, {
        minutes,
        matchIds: request.matchIds,
        courtId: request.courtId ?? undefined,
        afterIso: request.afterIso ?? undefined,
      });
      return { success: true, action: request.action, ...res };
    }
    case "reassign_ref": {
      const matchIds = request.matchIds ?? [];
      const refTeamId = request.refTeamId ?? null;
      const res = await bulkReassignRefsInternal(tournament.id, matchIds, refTeamId);
      return { success: true, action: request.action, ...res };
    }
    case "clear_schedule": {
      const matchIds = request.matchIds ?? [];
      const res = await bulkClearScheduleInternal(tournament.id, matchIds, {
        clearTime: request.clearTime,
        clearCourt: request.clearCourt,
      });
      return { success: true, action: request.action, ...res };
    }
    default:
      throw badRequest(`Unsupported action: ${(request as { action?: string }).action}`);
  }
}
