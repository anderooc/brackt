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
import { alias } from "drizzle-orm/pg-core";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  brackets,
  divisions,
  matches,
  pools,
  teams,
  tournaments,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { resolveIsTournamentOrganizer } from "@/lib/tournaments/permissions";
import { isTournamentArchived } from "@/lib/tournament-status";
import { assignBracketRefsForBracket } from "@/lib/tournaments/bracket-structure";
import { bracketScheduleLabel } from "@/lib/tournaments/bracket-tiers";
import { loadTournamentCourtOccupancy } from "@/lib/tournaments/court-schedule";
import { isBracketRoundOneByeMatch } from "@/lib/utils/bracket";
import {
  assignIndexWaves,
  clampMatchIntervalMinutes,
  proposeMatchTimeFill,
  type MatchTimeFillInput,
  type MatchTimeFillStatus,
  type ScheduleTimesScope,
} from "@/lib/utils/match-time-fill";

const teamA = alias(teams, "fill_team_a");
const teamB = alias(teams, "fill_team_b");

function asStatus(status: string): MatchTimeFillStatus {
  if (status === "in_progress" || status === "completed") return status;
  return "upcoming";
}

async function authorizeSchedule(tournamentId: string) {
  const user = await requireUser();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the host can edit start times." as const };
  }
  if (isTournamentArchived(tournament.date)) {
    return { error: "This tournament is archived." as const };
  }
  return { tournament };
}

async function loadPoolDivisionMatches(
  tournamentId: string,
  divisionId: string
): Promise<
  { matches: MatchTimeFillInput[]; bracketId: string | null } | { error: string }
> {
  const [division] = await db
    .select({ id: divisions.id, tournamentId: divisions.tournamentId })
    .from(divisions)
    .where(eq(divisions.id, divisionId))
    .limit(1);
  if (!division || division.tournamentId !== tournamentId) {
    return { error: "Division not found" };
  }

  const divisionPools = await db
    .select({ id: pools.id, name: pools.name })
    .from(pools)
    .where(eq(pools.divisionId, divisionId))
    .orderBy(asc(pools.createdAt), asc(pools.id));
  const poolIds = divisionPools.map((row) => row.id);
  if (poolIds.length === 0) return { error: "No pools in this division." };

  const poolNameById = new Map(divisionPools.map((row) => [row.id, row.name]));
  const rows = await db
    .select({
      id: matches.id,
      poolId: matches.poolId,
      status: matches.status,
      scheduledTime: matches.scheduledTime,
      courtId: matches.courtId,
      teamAName: teamA.name,
      teamBName: teamB.name,
    })
    .from(matches)
    .leftJoin(teamA, eq(matches.teamAId, teamA.id))
    .leftJoin(teamB, eq(matches.teamBId, teamB.id))
    .where(inArray(matches.poolId, poolIds))
    .orderBy(asc(matches.createdAt), asc(matches.id));

  const idsByPool = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.poolId) continue;
    const list = idsByPool.get(row.poolId) ?? [];
    list.push(row.id);
    idsByPool.set(row.poolId, list);
  }
  const waves = assignIndexWaves(idsByPool);

  return {
    bracketId: null,
    matches: rows.flatMap((row) => {
      if (!row.poolId) return [];
      return [
        {
          id: row.id,
          groupId: row.poolId,
          groupName: poolNameById.get(row.poolId) ?? "Pool",
          wave: waves.get(row.id) ?? 0,
          status: asStatus(row.status),
          scheduledTime: row.scheduledTime,
          courtId: row.courtId,
          teamAName: row.teamAName,
          teamBName: row.teamBName,
          isBye: false,
        },
      ];
    }),
  };
}

async function loadBracketMatches(
  tournamentId: string,
  bracketId: string
): Promise<
  { matches: MatchTimeFillInput[]; bracketId: string | null } | { error: string }
> {
  const [bracket] = await db
    .select({
      id: brackets.id,
      name: brackets.name,
      tier: brackets.tier,
      tournamentId: divisions.tournamentId,
    })
    .from(brackets)
    .innerJoin(divisions, eq(brackets.divisionId, divisions.id))
    .where(eq(brackets.id, bracketId))
    .limit(1);
  if (!bracket || bracket.tournamentId !== tournamentId) {
    return { error: "Bracket not found" };
  }

  const rows = await db
    .select({
      id: matches.id,
      status: matches.status,
      scheduledTime: matches.scheduledTime,
      courtId: matches.courtId,
      bracketRound: matches.bracketRound,
      teamAId: matches.teamAId,
      teamBId: matches.teamBId,
      teamAName: teamA.name,
      teamBName: teamB.name,
    })
    .from(matches)
    .leftJoin(teamA, eq(matches.teamAId, teamA.id))
    .leftJoin(teamB, eq(matches.teamBId, teamB.id))
    .where(eq(matches.bracketId, bracketId))
    .orderBy(asc(matches.bracketRound), asc(matches.id));

  const groupName = bracketScheduleLabel(bracket);
  return {
    bracketId,
    matches: rows.map((row) => ({
      id: row.id,
      groupId: bracketId,
      groupName,
      wave: row.bracketRound ?? 1,
      status: asStatus(row.status),
      scheduledTime: row.scheduledTime,
      courtId: row.courtId,
      teamAName: row.teamAName,
      teamBName: row.teamBName,
      isBye: isBracketRoundOneByeMatch({
        teamAId: row.teamAId,
        teamBId: row.teamBId,
        bracketRound: row.bracketRound,
      }),
    })),
  };
}

export async function applyMatchTimeFill(
  tournamentId: string,
  scope: ScheduleTimesScope,
  firstStartIso: string,
  intervalMinutes: number,
  overwrite: boolean
) {
  const auth = await authorizeSchedule(tournamentId);
  if ("error" in auth) return { error: auth.error };

  const firstStart = new Date(firstStartIso);
  if (Number.isNaN(firstStart.getTime())) {
    return { error: "Enter a valid first start time." as const };
  }

  const loaded =
    scope.type === "division-pools"
      ? await loadPoolDivisionMatches(tournamentId, scope.divisionId)
      : await loadBracketMatches(tournamentId, scope.bracketId);
  if ("error" in loaded) return { error: loaded.error };

  const occupancy = await loadTournamentCourtOccupancy(tournamentId);
  const groupIds = new Set(loaded.matches.map((match) => match.id));
  const externalOccupancy = occupancy.filter(
    (occupant) => !groupIds.has(occupant.matchId)
  );

  const rows = proposeMatchTimeFill({
    matches: loaded.matches,
    firstStart,
    intervalMinutes: clampMatchIntervalMinutes(intervalMinutes),
    overwrite,
    externalOccupancy,
  });
  const toApply = rows.filter((row) => row.kind === "apply");
  if (toApply.length === 0) {
    return { error: "No matches to update." as const };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const row of toApply) {
      await tx
        .update(matches)
        .set({
          scheduledTime: new Date(row.proposedIso),
          updatedAt: now,
        })
        .where(and(eq(matches.id, row.matchId), eq(matches.status, "upcoming")));
    }
  });

  if (loaded.bracketId) {
    await assignBracketRefsForBracket(loaded.bracketId, db);
  }

  revalidatePath("/tournaments/[slug]", "page");
  revalidatePath("/tournaments/[slug]/matches/[matchSlug]", "page");
  return { success: true as const, updated: toApply.length };
}
