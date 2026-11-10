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

import { and, asc, eq, gte, inArray, isNotNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  brackets,
  divisions,
  matchRefCrew,
  matches,
  pools,
  teamMembers,
  tournaments,
} from "@/lib/db/schema";
import { enrichScheduledMatches } from "@/lib/schedule/enrich-scheduled-matches";
import type {
  PersonalScheduleContract,
  PersonalScheduleMatchContract,
  PersonalScheduleRole,
} from "../contracts/personal-schedule";
import type { MatchStatus } from "@/types";

const divFromPool = alias(divisions, "ps_div_pool");
const divFromBracket = alias(divisions, "ps_div_bracket");

const DEFAULT_LIMIT = 100;

function asMatchStatus(status: string): MatchStatus {
  if (status === "in_progress" || status === "completed") return status;
  return "upcoming";
}

function resolveRole(
  match: {
    id: string;
    teamAId: string | null;
    teamBId: string | null;
    refTeamId: string | null;
    pointKeeperUserId: string | null;
    teamAName: string;
    teamBName: string;
    refTeamName: string | null;
  },
  userId: string,
  teamIds: Set<string>,
  crewMatchIds: Set<string>
): { role: PersonalScheduleRole; myTeamName: string | null } {
  if (match.teamAId && teamIds.has(match.teamAId)) {
    return { role: "playing", myTeamName: match.teamAName };
  }
  if (match.teamBId && teamIds.has(match.teamBId)) {
    return { role: "playing", myTeamName: match.teamBName };
  }
  if (match.refTeamId && teamIds.has(match.refTeamId)) {
    return { role: "reffing", myTeamName: match.refTeamName };
  }
  if (crewMatchIds.has(match.id)) {
    return { role: "crew", myTeamName: null };
  }
  if (match.pointKeeperUserId === userId) {
    return { role: "scorekeeping", myTeamName: null };
  }
  return { role: "playing", myTeamName: null };
}

type ScheduleFilterOptions = {
  includeCompleted?: boolean;
  /** Restrict to one tournament (the tournament page's "Your matches"). */
  tournamentId?: string;
  /** Skip tournaments dated before this YYYY-MM-DD (leftovers from archived events). */
  fromDate?: string;
};

async function loadViewerInvolvement(user: AppUser) {
  const [teamRows, crewRows] = await Promise.all([
    db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id)),
    db
      .select({ matchId: matchRefCrew.matchId })
      .from(matchRefCrew)
      .where(eq(matchRefCrew.userId, user.id)),
  ]);

  const teamIds = teamRows.map((row) => row.teamId);
  const crewMatchIds = new Set(crewRows.map((row) => row.matchId));

  const involvement: ReturnType<typeof or>[] = [];
  if (teamIds.length > 0) {
    involvement.push(
      inArray(matches.teamAId, teamIds),
      inArray(matches.teamBId, teamIds),
      inArray(matches.refTeamId, teamIds)
    );
  }
  if (crewMatchIds.size > 0) {
    involvement.push(inArray(matches.id, [...crewMatchIds]));
  }
  involvement.push(eq(matches.pointKeeperUserId, user.id));

  return { teamIdSet: new Set(teamIds), crewMatchIds, involvement };
}

/** Scheduled, released, non-draft matches the viewer plays, refs, or works. */
function scheduleWhere(
  involvement: ReturnType<typeof or>[],
  options?: ScheduleFilterOptions
) {
  return and(
    ne(tournaments.status, "draft"),
    isNotNull(matches.scheduledTime),
    or(...involvement),
    or(
      isNotNull(divFromPool.poolsReleasedAt),
      isNotNull(divFromBracket.poolsReleasedAt)
    ),
    options?.includeCompleted ? undefined : ne(matches.status, "completed"),
    options?.tournamentId
      ? eq(matches.tournamentId, options.tournamentId)
      : undefined,
    options?.fromDate ? gte(tournaments.date, options.fromDate) : undefined
  );
}

/** Cheap check used to decide whether a tournament shows "Your matches". */
export async function viewerHasScheduleInTournament(
  user: AppUser,
  tournamentId: string
): Promise<boolean> {
  const { involvement } = await loadViewerInvolvement(user);
  const rows = await db
    .select({ id: matches.id })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(pools, eq(pools.id, matches.poolId))
    .leftJoin(divFromPool, eq(divFromPool.id, pools.divisionId))
    .leftJoin(brackets, eq(brackets.id, matches.bracketId))
    .leftJoin(divFromBracket, eq(divFromBracket.id, brackets.divisionId))
    .where(
      scheduleWhere(involvement, { includeCompleted: true, tournamentId })
    )
    .limit(1);
  return rows.length > 0;
}

export async function loadPersonalScheduleForViewer(
  user: AppUser,
  options?: { limit?: number } & ScheduleFilterOptions
): Promise<PersonalScheduleContract> {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  const { teamIdSet, crewMatchIds, involvement } =
    await loadViewerInvolvement(user);

  const rows = await db
    .select({
      match: matches,
      tournamentSlug: tournaments.slug,
      tournamentName: tournaments.name,
      tournamentDate: tournaments.date,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(pools, eq(pools.id, matches.poolId))
    .leftJoin(divFromPool, eq(divFromPool.id, pools.divisionId))
    .leftJoin(brackets, eq(brackets.id, matches.bracketId))
    .leftJoin(divFromBracket, eq(divFromBracket.id, brackets.divisionId))
    .where(scheduleWhere(involvement, options))
    .orderBy(asc(matches.scheduledTime))
    .limit(limit);

  if (rows.length === 0) {
    return { matches: [] };
  }

  const enriched = await enrichScheduledMatches(rows.map((row) => row.match));
  const tournamentByMatchId = new Map(
    rows.map((row) => [
      row.match.id,
      {
        slug: row.tournamentSlug,
        name: row.tournamentName,
        date: row.tournamentDate,
      },
    ])
  );

  const contractMatches: PersonalScheduleMatchContract[] = enriched.map(
    (match) => {
      const tournament = tournamentByMatchId.get(match.id);
      if (!tournament) {
        throw new Error(`Missing tournament metadata for match ${match.id}`);
      }
      const { role, myTeamName } = resolveRole(
        {
          id: match.id,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          refTeamId: match.refTeamId,
          pointKeeperUserId: match.pointKeeperUserId,
          teamAName: match.teamAName,
          teamBName: match.teamBName,
          refTeamName: match.refTeamName,
        },
        user.id,
        teamIdSet,
        crewMatchIds
      );

      return {
        id: match.id,
        matchSlug: match.slug,
        tournamentSlug: tournament.slug,
        tournamentName: tournament.name,
        tournamentDate: tournament.date,
        status: asMatchStatus(match.status),
        scheduledTime: match.scheduledTime!.toISOString(),
        warmupStart: match.warmupStart?.toISOString() ?? null,
        teamAName: match.teamAName,
        teamBName: match.teamBName,
        courtName: match.courtName,
        refTeamName: match.refTeamName,
        contextLabel: match.contextLabel,
        gender: match.gender,
        region: match.region,
        role,
        myTeamName,
      };
    }
  );

  return { matches: contractMatches };
}
