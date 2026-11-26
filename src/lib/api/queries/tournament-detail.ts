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

import { and, asc, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  brackets,
  courts,
  divisions,
  matches,
  pools,
  registrations,
  schools,
  sets,
  teams,
  tournaments,
  users,
} from "@/lib/db/schema";
import { isTournamentArchived } from "@/lib/tournament-status";
import type { PublicTournamentListItem } from "@/lib/tournaments/public-list-projection";
import type {
  PublicMatchPhase,
  PublicMatchStatus,
  TournamentDivisionContract,
  TournamentMatchContract,
  TournamentMatchDetailContract,
  TournamentTeamContract,
} from "../contracts/tournament";

export function findPublicTournamentBySlug(
  items: PublicTournamentListItem[],
  slug: string
): PublicTournamentListItem | null {
  return items.find((item) => item.slug === slug) ?? null;
}

const teamA = alias(teams, "match_team_a");
const teamB = alias(teams, "match_team_b");
const winner = alias(teams, "match_winner");
const refTeam = alias(teams, "match_ref");
const divFromPool = alias(divisions, "match_div_pool");
const divFromBracket = alias(divisions, "match_div_bracket");

export async function findPostedTournamentId(
  slug: string
): Promise<{ id: string; name: string; date: string; status: string } | null> {
  return db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      date: tournaments.date,
      status: tournaments.status,
    })
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

const DIVISION_FORMATS = new Set<TournamentDivisionContract["format"]>([
  "pool_to_bracket",
  "single_elimination",
  "double_elimination",
]);

function asDivisionFormat(
  format: string
): TournamentDivisionContract["format"] {
  if (DIVISION_FORMATS.has(format as TournamentDivisionContract["format"])) {
    return format as TournamentDivisionContract["format"];
  }
  return "pool_to_bracket";
}

export async function loadPublicTournamentExtras(slug: string): Promise<{
  address: string | null;
  organizerName: string;
  registrationOpen: boolean;
  divisions: TournamentDivisionContract[];
} | null> {
  const tournament = await db
    .select({
      id: tournaments.id,
      date: tournaments.date,
      status: tournaments.status,
      address: tournaments.address,
      organizerName: users.fullName,
    })
    .from(tournaments)
    .innerJoin(users, eq(users.id, tournaments.organizerId))
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!tournament) return null;

  const rows = await db
    .select({
      name: divisions.name,
      format: divisions.format,
      poolsReleasedAt: divisions.poolsReleasedAt,
    })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournament.id))
    .orderBy(asc(divisions.name));

  return {
    address: tournament.address,
    organizerName: tournament.organizerName,
    registrationOpen:
      tournament.status === "registration_open" &&
      !isTournamentArchived(tournament.date),
    divisions: rows.map((row) => ({
      name: row.name,
      format: asDivisionFormat(row.format),
      poolsReleased: row.poolsReleasedAt !== null,
    })),
  };
}

/** Confirmed and checked-in teams only — pending applications stay private. */
export async function loadPublicTournamentTeams(
  tournamentId: string
): Promise<TournamentTeamContract[]> {
  const rows = await db
    .select({
      slug: teams.slug,
      name: teams.name,
      university: teams.university,
      schoolName: schools.name,
      divisionName: divisions.name,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .leftJoin(schools, eq(schools.id, teams.schoolId))
    .leftJoin(divisions, eq(divisions.id, registrations.divisionId))
    .where(
      and(
        eq(registrations.tournamentId, tournamentId),
        inArray(registrations.status, ["confirmed", "checked_in"])
      )
    )
    .orderBy(asc(divisions.name), asc(teams.name));

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    university: row.university,
    schoolName: row.schoolName,
    divisionName: row.divisionName,
  }));
}

const MATCH_STATUSES = new Set<PublicMatchStatus>([
  "upcoming",
  "in_progress",
  "completed",
]);

export function asMatchStatus(status: string): PublicMatchStatus {
  return MATCH_STATUSES.has(status as PublicMatchStatus)
    ? (status as PublicMatchStatus)
    : "upcoming";
}

export async function loadPublicTournamentMatches(
  tournamentId: string
): Promise<TournamentMatchContract[]> {
  const rows = await db
    .select({
      id: matches.id,
      slug: matches.slug,
      status: matches.status,
      scheduledTime: matches.scheduledTime,
      timeZone: tournaments.timeZone,
      courtName: courts.name,
      teamASlug: teamA.slug,
      teamAName: teamA.name,
      teamBSlug: teamB.slug,
      teamBName: teamB.name,
      winnerSlug: winner.slug,
      poolDivisionName: divFromPool.name,
      bracketDivisionName: divFromBracket.name,
      poolId: matches.poolId,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(courts, eq(courts.id, matches.courtId))
    .leftJoin(teamA, eq(teamA.id, matches.teamAId))
    .leftJoin(teamB, eq(teamB.id, matches.teamBId))
    .leftJoin(winner, eq(winner.id, matches.winnerId))
    .leftJoin(pools, eq(pools.id, matches.poolId))
    .leftJoin(divFromPool, eq(divFromPool.id, pools.divisionId))
    .leftJoin(brackets, eq(brackets.id, matches.bracketId))
    .leftJoin(divFromBracket, eq(divFromBracket.id, brackets.divisionId))
    .where(
      and(
        eq(matches.tournamentId, tournamentId),
        or(
          isNotNull(divFromPool.poolsReleasedAt),
          isNotNull(divFromBracket.poolsReleasedAt)
        )
      )
    );

  const matchIds = rows.map((row) => row.id);
  const setRows =
    matchIds.length === 0
      ? []
      : await db
          .select({
            matchId: sets.matchId,
            setNumber: sets.setNumber,
            teamAScore: sets.teamAScore,
            teamBScore: sets.teamBScore,
          })
          .from(sets)
          .where(inArray(sets.matchId, matchIds))
          .orderBy(asc(sets.setNumber));

  const setsByMatchId = new Map<string, TournamentMatchContract["sets"]>();
  for (const set of setRows) {
    const list = setsByMatchId.get(set.matchId) ?? [];
    list.push({
      setNumber: set.setNumber,
      teamAScore: set.teamAScore,
      teamBScore: set.teamBScore,
    });
    setsByMatchId.set(set.matchId, list);
  }

  return rows
    .map((row): TournamentMatchContract => {
      const phase: PublicMatchPhase = row.poolId ? "pool" : "bracket";
      return {
        slug: row.slug,
        status: asMatchStatus(row.status),
        phase,
        scheduledTime: row.scheduledTime?.toISOString() ?? null,
        timeZone: row.timeZone,
        courtName: row.courtName,
        divisionName: row.poolDivisionName ?? row.bracketDivisionName,
        teamA:
          row.teamASlug && row.teamAName
            ? { slug: row.teamASlug, name: row.teamAName }
            : null,
        teamB:
          row.teamBSlug && row.teamBName
            ? { slug: row.teamBSlug, name: row.teamBName }
            : null,
        winnerSlug: row.winnerSlug,
        sets: setsByMatchId.get(row.id) ?? [],
      };
    })
    .sort(comparePublicMatches);
}

function comparePublicMatches(
  a: TournamentMatchContract,
  b: TournamentMatchContract
): number {
  const rank = (status: PublicMatchStatus) =>
    status === "in_progress" ? 0 : status === "upcoming" ? 1 : 2;
  const byStatus = rank(a.status) - rank(b.status);
  if (byStatus !== 0) return byStatus;
  if (a.scheduledTime && b.scheduledTime) {
    return a.scheduledTime.localeCompare(b.scheduledTime);
  }
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.slug.localeCompare(b.slug);
}

export async function loadPublicTournamentMatch(
  tournamentId: string,
  tournamentName: string,
  matchSlug: string
): Promise<TournamentMatchDetailContract | null> {
  const [row] = await db
    .select({
      id: matches.id,
      slug: matches.slug,
      status: matches.status,
      scheduledTime: matches.scheduledTime,
      timeZone: tournaments.timeZone,
      courtName: courts.name,
      teamASlug: teamA.slug,
      teamAName: teamA.name,
      teamBSlug: teamB.slug,
      teamBName: teamB.name,
      winnerSlug: winner.slug,
      refTeamName: refTeam.name,
      poolDivisionName: divFromPool.name,
      bracketDivisionName: divFromBracket.name,
      poolId: matches.poolId,
      poolReleasedAt: divFromPool.poolsReleasedAt,
      bracketReleasedAt: divFromBracket.poolsReleasedAt,
    })
    .from(matches)
    .innerJoin(tournaments, eq(tournaments.id, matches.tournamentId))
    .leftJoin(courts, eq(courts.id, matches.courtId))
    .leftJoin(teamA, eq(teamA.id, matches.teamAId))
    .leftJoin(teamB, eq(teamB.id, matches.teamBId))
    .leftJoin(winner, eq(winner.id, matches.winnerId))
    .leftJoin(refTeam, eq(refTeam.id, matches.refTeamId))
    .leftJoin(pools, eq(pools.id, matches.poolId))
    .leftJoin(divFromPool, eq(divFromPool.id, pools.divisionId))
    .leftJoin(brackets, eq(brackets.id, matches.bracketId))
    .leftJoin(divFromBracket, eq(divFromBracket.id, brackets.divisionId))
    .where(
      and(eq(matches.tournamentId, tournamentId), eq(matches.slug, matchSlug))
    )
    .limit(1);

  if (!row) return null;
  if (row.poolReleasedAt == null && row.bracketReleasedAt == null) {
    return null;
  }

  const setRows = await db
    .select({
      setNumber: sets.setNumber,
      teamAScore: sets.teamAScore,
      teamBScore: sets.teamBScore,
    })
    .from(sets)
    .where(eq(sets.matchId, row.id))
    .orderBy(asc(sets.setNumber));

  return {
    slug: row.slug,
    status: asMatchStatus(row.status),
    phase: row.poolId ? "pool" : "bracket",
    scheduledTime: row.scheduledTime?.toISOString() ?? null,
    timeZone: row.timeZone,
    courtName: row.courtName,
    divisionName: row.poolDivisionName ?? row.bracketDivisionName,
    teamA:
      row.teamASlug && row.teamAName
        ? { slug: row.teamASlug, name: row.teamAName }
        : null,
    teamB:
      row.teamBSlug && row.teamBName
        ? { slug: row.teamBSlug, name: row.teamBName }
        : null,
    winnerSlug: row.winnerSlug,
    sets: setRows,
    tournamentName,
    refTeamName: row.refTeamName,
  };
}
