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

import { eq, inArray } from "drizzle-orm";
import { getDivisionPlayData } from "@/app/(dashboard)/tournaments/[slug]/brackets/data";
import type { DivisionPlayData } from "@/app/(dashboard)/tournaments/[slug]/brackets/data";
import { db } from "@/lib/db";
import { teams, tournaments } from "@/lib/db/schema";
import { bracketDisplayName } from "@/lib/tournaments/bracket-tiers";
import { calculatePoolStandings } from "@/lib/utils/pool";
import { DEFAULT_TOURNAMENT_TIME_ZONE } from "@/lib/tournament-time";
import type {
  BracketMatchContract,
  PlayDivisionContract,
  TournamentDivisionFormatContract,
  TournamentMatchContract,
  TournamentPlayContract,
} from "../contracts/tournament";
import { asMatchStatus, loadPublicTournamentMatches } from "./tournament-detail";

const DIVISION_FORMATS = new Set<TournamentDivisionFormatContract>([
  "pool_to_bracket",
  "single_elimination",
  "double_elimination",
]);

function asDivisionFormat(format: string): TournamentDivisionFormatContract {
  if (DIVISION_FORMATS.has(format as TournamentDivisionFormatContract)) {
    return format as TournamentDivisionFormatContract;
  }
  return "pool_to_bracket";
}

export async function loadPublicTournamentPlay(
  tournamentId: string
): Promise<TournamentPlayContract> {
  const [tournament, play] = await Promise.all([
    db
      .select({
        poolTiebreakCriteria: tournaments.poolTiebreakCriteria,
        timeZone: tournaments.timeZone,
      })
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getDivisionPlayData(tournamentId, { forOrganizer: false }),
  ]);

  const teamIds = collectTeamIds(play);
  const [teamRows, publicMatches] = await Promise.all([
    teamIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: teams.id, slug: teams.slug, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, teamIds)),
    loadPublicTournamentMatches(tournamentId),
  ]);

  return projectPlayContract({
    divisions: play,
    teams: teamRows,
    publicMatches,
    tiebreakCriteria: tournament?.poolTiebreakCriteria,
    timeZone: tournament?.timeZone ?? DEFAULT_TOURNAMENT_TIME_ZONE,
  });
}

function collectTeamIds(divisions: DivisionPlayData[]): string[] {
  const ids = new Set<string>();
  for (const division of divisions) {
    for (const pool of division.pools) {
      for (const team of pool.teams) ids.add(team.id);
      for (const match of pool.matches) addMatchTeamIds(ids, match);
    }
    for (const bracket of division.brackets) {
      for (const match of bracket.matches) addMatchTeamIds(ids, match);
    }
  }
  return [...ids];
}

function addMatchTeamIds(
  ids: Set<string>,
  match: { teamAId: string | null; teamBId: string | null; winnerId: string | null }
) {
  if (match.teamAId) ids.add(match.teamAId);
  if (match.teamBId) ids.add(match.teamBId);
  if (match.winnerId) ids.add(match.winnerId);
}

export function projectPlayContract(input: {
  divisions: DivisionPlayData[];
  teams: { id: string; slug: string; name: string }[];
  publicMatches: TournamentMatchContract[];
  tiebreakCriteria?: Array<
    "match_record" | "set_record" | "point_diff" | "head_to_head"
  >;
  timeZone?: string;
}): TournamentPlayContract {
  const teamsById = new Map(input.teams.map((team) => [team.id, team]));
  const matchesBySlug = new Map(
    input.publicMatches.map((match) => [match.slug, match])
  );
  const timeZone = input.timeZone ?? DEFAULT_TOURNAMENT_TIME_ZONE;

  return {
    divisions: input.divisions.map((division) =>
      projectDivision(
        division,
        teamsById,
        matchesBySlug,
        timeZone,
        input.tiebreakCriteria
      )
    ),
  };
}

function projectDivision(
  division: DivisionPlayData,
  teamsById: Map<string, { id: string; slug: string; name: string }>,
  matchesBySlug: Map<string, TournamentMatchContract>,
  timeZone: string,
  tiebreakCriteria?: Array<
    "match_record" | "set_record" | "point_diff" | "head_to_head"
  >
): PlayDivisionContract {
  return {
    name: division.name,
    format: asDivisionFormat(division.format),
    released: division.poolsReleasedAt != null,
    pools: division.pools.map((pool) => {
      const standings = calculatePoolStandings(
        pool.teams.map((team) => team.id),
        pool.matches
          .filter((match) => match.teamAId && match.teamBId)
          .map((match) => ({
            teamAId: match.teamAId!,
            teamBId: match.teamBId!,
            winnerId: match.winnerId,
            sets: match.sets,
          })),
        { criteria: tiebreakCriteria }
      );

      return {
        name: pool.name,
        standings: standings.flatMap((row) => {
          const team = teamsById.get(row.teamId);
          if (!team) return [];
          return [
            {
              teamSlug: team.slug,
              teamName: team.name,
              wins: row.wins,
              losses: row.losses,
              setsWon: row.setsWon,
              setsLost: row.setsLost,
              setDiff: row.setDiff,
              pointDiff: row.pointDiff,
            },
          ];
        }),
        matches: pool.matches.map((match) =>
          projectPoolMatch(
            match,
            division.name,
            teamsById,
            matchesBySlug,
            timeZone
          )
        ),
      };
    }),
    brackets: division.brackets.map((bracket) => ({
      name: bracketDisplayName(bracket),
      type: bracket.bracketType,
      tier: bracket.tier,
      matches: bracket.matches
        .slice()
        .sort((a, b) => {
          const round = (a.bracketRound ?? 0) - (b.bracketRound ?? 0);
          if (round !== 0) return round;
          return (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0);
        })
        .map((match) =>
          projectBracketMatch(match, teamsById, matchesBySlug, timeZone)
        ),
    })),
  };
}

function projectPoolMatch(
  match: DivisionPlayData["pools"][number]["matches"][number],
  divisionName: string,
  teamsById: Map<string, { slug: string; name: string }>,
  matchesBySlug: Map<string, TournamentMatchContract>,
  timeZone: string
): TournamentMatchContract {
  return (
    matchesBySlug.get(match.slug) ??
    buildMatchContract(match, "pool", divisionName, teamsById, timeZone)
  );
}

function projectBracketMatch(
  match: DivisionPlayData["brackets"][number]["matches"][number],
  teamsById: Map<string, { slug: string; name: string }>,
  matchesBySlug: Map<string, TournamentMatchContract>,
  timeZone: string
): BracketMatchContract {
  const published = matchesBySlug.get(match.slug);
  const fallback = buildMatchContract(
    match,
    "bracket",
    null,
    teamsById,
    timeZone
  );
  const base = published ?? fallback;
  return {
    slug: base.slug,
    round: match.bracketRound ?? 1,
    position: match.bracketPosition ?? 0,
    status: base.status,
    teamA: base.teamA,
    teamB: base.teamB,
    winnerSlug: base.winnerSlug,
    sets: base.sets,
  };
}

function buildMatchContract(
  match: {
    slug: string;
    status: string;
    scheduledTime: Date | null;
    teamAId: string | null;
    teamBId: string | null;
    winnerId: string | null;
    teamA: { id: string; name: string } | null;
    teamB: { id: string; name: string } | null;
    sets: { teamAScore: number; teamBScore: number }[];
  },
  phase: TournamentMatchContract["phase"],
  divisionName: string | null,
  teamsById: Map<string, { slug: string; name: string }>,
  timeZone: string
): TournamentMatchContract {
  return {
    slug: match.slug,
    status: asMatchStatus(match.status),
    phase,
    scheduledTime: match.scheduledTime?.toISOString() ?? null,
    timeZone,
    courtName: null,
    divisionName,
    teamA: resolveTeam(match.teamAId, teamsById),
    teamB: resolveTeam(match.teamBId, teamsById),
    winnerSlug: match.winnerId
      ? (teamsById.get(match.winnerId)?.slug ?? null)
      : null,
    sets: match.sets.map((set, index) => ({
      setNumber: index + 1,
      teamAScore: set.teamAScore,
      teamBScore: set.teamBScore,
    })),
  };
}

function resolveTeam(
  id: string | null,
  teamsById: Map<string, { slug: string; name: string }>
): TournamentMatchContract["teamA"] {
  if (!id) return null;
  const team = teamsById.get(id);
  // A missing slug would otherwise force a UUID onto the wire.
  if (!team) return null;
  return { slug: team.slug, name: team.name };
}
