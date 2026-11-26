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

import { db } from "@/lib/db";
import { resolveAppBaseUrl } from "@/lib/metadata";
import {
  brackets,
  courts,
  divisions,
  matches,
  poolTeams,
  pools,
  registrations,
  teams,
  tournaments,
  users,
} from "@/lib/db/schema";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { formatMatchFormatLabel } from "@/lib/labels/match-format";
import { formatPlayFormatLabel } from "@/lib/labels/play-format";
import {
  formatPoolTiebreakCriterionLabel,
  type PoolTiebreakCriterion,
} from "@/lib/labels/pool-tiebreak";
import { formatWarmupFormatLabel } from "@/lib/labels/warmup-format";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { getHostSchoolById } from "@/lib/tournaments/host-school";
import {
  paymentInstructionsText,
  paymentSettingsFromTournament,
} from "@/lib/tournaments/payment-settings";
import { bracketDisplayName } from "@/lib/tournaments/bracket-tiers";
import {
  buildPoolScheduleContext,
  formatSeedMatchup,
  lookupPoolMatchRound,
  lookupTeamSeed,
} from "@/lib/tournaments/packet-pool-schedule";
import {
  buildPacketBracketStructures,
  type PacketBracketStructure,
} from "@/lib/tournaments/packet-bracket-tree";
import { formatTimeInZone } from "@/lib/tournament-time";

export type PacketRegisteredTeam = {
  name: string;
};

export type PacketPoolSeedRow = {
  seed: number;
  teamName: string;
};

export type PacketPoolSeeding = {
  poolName: string;
  teams: PacketPoolSeedRow[];
};

export type PacketPoolScheduleRow = {
  scheduledTime: Date;
  courtName: string | null;
  poolName: string;
  roundNumber: number;
  matchupLabel: string;
};

export type PacketBracketScheduleRow = {
  scheduledTime: Date;
  courtName: string | null;
  roundLabel: string;
  teamAName: string;
  teamBName: string;
};

export type PacketData = {
  generatedAt: Date;
  /** IANA zone used for every time printed in the packet. */
  timeZone: string;
  liveUrl: string;
  name: string;
  date: string;
  dateDisplay: string;
  location: string;
  address: string | null;
  description: string | null;
  packetNotes: string | null;
  paymentInstructions: string | null;
  hostSchoolName: string | null;
  organizerName: string;
  registeredTeams: PacketRegisteredTeam[];
  playFormatLabel: string;
  poolRules: {
    matchFormat: string;
    matchFormatLabel: string;
    setStartingScore: number;
    setTargetScore: number;
    tiebreakTargetScore: number;
    warmupFormatLabel: string;
    tiebreakCriteria: string[];
  };
  bracketRules: {
    summary: string;
    bracketCount: number;
  } | null;
  poolSeedings: PacketPoolSeeding[];
  poolSchedule: PacketPoolScheduleRow[];
  bracketSchedule: PacketBracketScheduleRow[];
  bracketStructures: PacketBracketStructure[];
  accentColor: string;
};

const PACKET_REGISTRATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
] as const;

function tournamentLiveUrl(slug: string): string {
  return `${resolveAppBaseUrl()}/tournaments/${slug}`;
}

function bracketRoundLabel(round: number, maxRound: number): string {
  if (round === maxRound) return "Final";
  if (round === maxRound - 1) return "Semifinals";
  if (round === maxRound - 2) return "Quarterfinals";
  return `Round ${round}`;
}

function bracketTierSummary(
  bracketCount: number,
  goldTeamCount: number | null,
  silverTeamCount: number | null
): string {
  if (bracketCount <= 1) {
    return "Single elimination bracket (all pools combine). Sets start at 0–0.";
  }
  if (bracketCount === 2) {
    return `Gold (${goldTeamCount ?? "?"} teams) and Silver (remainder) brackets. All pools combine. Sets start at 0–0.`;
  }
  return `Gold (${goldTeamCount ?? "?"}), Silver (${silverTeamCount ?? "?"}), and Bronze (remainder) brackets. All pools combine. Sets start at 0–0.`;
}

export async function gatherPacketData(
  tournamentId: string
): Promise<PacketData | null> {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) return null;

  const [
    organizer,
    hostSchool,
    registrationRows,
    scheduledMatchRows,
    divisionRows,
  ] = await Promise.all([
    db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, tournament.organizerId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    getHostSchoolById(tournament.hostSchoolId),
    db
      .select({ teamName: teams.name })
      .from(registrations)
      .innerJoin(teams, eq(registrations.teamId, teams.id))
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          inArray(registrations.status, [...PACKET_REGISTRATION_STATUSES])
        )
      )
      .orderBy(asc(teams.name)),
    db
      .select({
        scheduledTime: matches.scheduledTime,
        bracketRound: matches.bracketRound,
        bracketId: matches.bracketId,
        poolId: matches.poolId,
        teamAId: matches.teamAId,
        teamBId: matches.teamBId,
        courtId: matches.courtId,
      })
      .from(matches)
      .where(
        and(
          eq(matches.tournamentId, tournamentId),
          isNotNull(matches.scheduledTime)
        )
      )
      .orderBy(asc(matches.scheduledTime)),
    db
      .select({ id: divisions.id })
      .from(divisions)
      .where(eq(divisions.tournamentId, tournamentId)),
  ]);

  const divisionIds = divisionRows.map((d) => d.id);

  const allPoolRows =
    divisionIds.length > 0
      ? await db
          .select({ id: pools.id, name: pools.name })
          .from(pools)
          .where(inArray(pools.divisionId, divisionIds))
          .orderBy(asc(pools.name))
      : [];

  const allPoolIds = allPoolRows.map((p) => p.id);

  const allBracketRows =
    divisionIds.length > 0
      ? await db
          .select({
            id: brackets.id,
            name: brackets.name,
            tier: brackets.tier,
          })
          .from(brackets)
          .where(inArray(brackets.divisionId, divisionIds))
          .orderBy(asc(brackets.tier), asc(brackets.name))
      : [];

  const allBracketIds = allBracketRows.map((b) => b.id);

  const allBracketMatchRows =
    allBracketIds.length > 0
      ? await db
          .select({
            bracketId: matches.bracketId,
            bracketRound: matches.bracketRound,
            bracketPosition: matches.bracketPosition,
            teamAId: matches.teamAId,
            teamBId: matches.teamBId,
          })
          .from(matches)
          .where(
            and(
              eq(matches.tournamentId, tournamentId),
              inArray(matches.bracketId, allBracketIds)
            )
          )
          .orderBy(asc(matches.bracketRound), asc(matches.bracketPosition))
      : [];

  const allPoolMemberRows =
    allPoolIds.length > 0
      ? await db
          .select({
            poolId: poolTeams.poolId,
            teamId: poolTeams.teamId,
            seed: poolTeams.seed,
            teamName: teams.name,
          })
          .from(poolTeams)
          .innerJoin(teams, eq(poolTeams.teamId, teams.id))
          .where(inArray(poolTeams.poolId, allPoolIds))
          .orderBy(asc(poolTeams.seed), asc(teams.name))
      : [];

  const teamIds = [
    ...new Set(
      [
        ...scheduledMatchRows.flatMap((m) => [m.teamAId, m.teamBId]),
        ...allBracketMatchRows.flatMap((m) => [m.teamAId, m.teamBId]),
      ].filter((id): id is string => Boolean(id))
    ),
  ];
  const courtIds = [
    ...new Set(
      scheduledMatchRows
        .map((m) => m.courtId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const bracketIds = [
    ...new Set(
      scheduledMatchRows
        .map((m) => m.bracketId)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [teamRows, courtRows, bracketRows, bracketMaxRounds] =
    await Promise.all([
      teamIds.length
        ? db
            .select({ id: teams.id, name: teams.name })
            .from(teams)
            .where(inArray(teams.id, teamIds))
        : Promise.resolve([]),
      courtIds.length
        ? db
            .select({ id: courts.id, name: courts.name })
            .from(courts)
            .where(inArray(courts.id, courtIds))
        : Promise.resolve([]),
      bracketIds.length
        ? db
            .select({
              id: brackets.id,
              name: brackets.name,
              tier: brackets.tier,
            })
            .from(brackets)
            .where(inArray(brackets.id, bracketIds))
        : Promise.resolve([]),
      bracketIds.length
        ? db
            .select({
              bracketId: matches.bracketId,
              maxRound: matches.bracketRound,
            })
            .from(matches)
            .where(
              and(
                eq(matches.tournamentId, tournamentId),
                inArray(matches.bracketId, bracketIds)
              )
            )
        : Promise.resolve([]),
    ]);

  const teamNameById = new Map(teamRows.map((t) => [t.id, t.name]));
  const courtNameById = new Map(courtRows.map((c) => [c.id, c.name]));
  const poolNameById = new Map(allPoolRows.map((p) => [p.id, p.name]));
  const bracketNameById = new Map(
    bracketRows.map((b) => [b.id, bracketDisplayName(b)])
  );

  const maxRoundByBracket = new Map<string, number>();
  for (const row of bracketMaxRounds) {
    if (!row.bracketId || row.maxRound == null) continue;
    const prev = maxRoundByBracket.get(row.bracketId) ?? 0;
    if (row.maxRound > prev) {
      maxRoundByBracket.set(row.bracketId, row.maxRound);
    }
  }

  const membersByPool = new Map<
    string,
    Array<{ teamId: string; seed: number | null; teamName: string }>
  >();
  for (const row of allPoolMemberRows) {
    const bucket = membersByPool.get(row.poolId) ?? [];
    bucket.push({
      teamId: row.teamId,
      seed: row.seed,
      teamName: row.teamName,
    });
    membersByPool.set(row.poolId, bucket);
  }

  const poolContextById = new Map<
    string,
    ReturnType<typeof buildPoolScheduleContext>
  >();
  for (const pool of allPoolRows) {
    const members = membersByPool.get(pool.id) ?? [];
    if (members.length > 0) {
      poolContextById.set(
        pool.id,
        buildPoolScheduleContext(
          members.map((m) => ({ teamId: m.teamId, seed: m.seed }))
        )
      );
    }
  }

  const poolSeedings: PacketPoolSeeding[] = allPoolRows
    .map((pool) => {
      const members = membersByPool.get(pool.id) ?? [];
      const context = poolContextById.get(pool.id);
      if (!context || members.length === 0) return null;

      const teams: PacketPoolSeedRow[] = context.teamIds.map((teamId) => ({
        seed: context.seedByTeamId.get(teamId) ?? 0,
        teamName:
          members.find((m) => m.teamId === teamId)?.teamName ?? "TBD",
      }));

      return { poolName: pool.name, teams };
    })
    .filter((row): row is PacketPoolSeeding => row != null);

  const poolSchedule: PacketPoolScheduleRow[] = [];
  const bracketSchedule: PacketBracketScheduleRow[] = [];

  const bracketStructures = buildPacketBracketStructures({
    brackets: allBracketRows,
    matches: allBracketMatchRows,
    teamNameById,
  });

  for (const m of scheduledMatchRows) {
    if (!m.scheduledTime) continue;

    if (m.poolId) {
      const context = poolContextById.get(m.poolId);
      const poolName = poolNameById.get(m.poolId) ?? "Pool";
      const seedA = context
        ? lookupTeamSeed(context.seedByTeamId, m.teamAId)
        : null;
      const seedB = context
        ? lookupTeamSeed(context.seedByTeamId, m.teamBId)
        : null;
      const roundNumber = context
        ? (lookupPoolMatchRound(context.roundByPair, m.teamAId, m.teamBId) ??
          0)
        : 0;

      const matchupLabel =
        seedA != null && seedB != null
          ? formatSeedMatchup(seedA, seedB)
          : `${
              m.teamAId ? (teamNameById.get(m.teamAId) ?? "TBD") : "TBD"
            } vs ${m.teamBId ? (teamNameById.get(m.teamBId) ?? "TBD") : "TBD"}`;

      poolSchedule.push({
        scheduledTime: m.scheduledTime,
        courtName: m.courtId ? (courtNameById.get(m.courtId) ?? null) : null,
        poolName,
        roundNumber,
        matchupLabel,
      });
      continue;
    }

    let roundLabel = "Match";
    if (m.bracketId && m.bracketRound != null) {
      const maxRound = maxRoundByBracket.get(m.bracketId) ?? m.bracketRound;
      const bracketName = bracketNameById.get(m.bracketId);
      roundLabel = `${bracketName} · ${bracketRoundLabel(m.bracketRound, maxRound)}`;
    }

    bracketSchedule.push({
      scheduledTime: m.scheduledTime,
      courtName: m.courtId ? (courtNameById.get(m.courtId) ?? null) : null,
      roundLabel,
      teamAName: m.teamAId ? (teamNameById.get(m.teamAId) ?? "TBD") : "TBD",
      teamBName: m.teamBId ? (teamNameById.get(m.teamBId) ?? "TBD") : "TBD",
    });
  }

  const playFormat = tournament.playFormat ?? "pool_to_bracket";
  const hasBracketPlay =
    playFormat === "pool_to_bracket" ||
    playFormat === "single_elimination" ||
    playFormat === "double_elimination";

  const tiebreakCriteria = (tournament.poolTiebreakCriteria ?? []).map((c) =>
    formatPoolTiebreakCriterionLabel(c as PoolTiebreakCriterion)
  );

  return {
    generatedAt: new Date(),
    timeZone: tournament.timeZone,
    liveUrl: tournamentLiveUrl(tournament.slug),
    name: tournament.name,
    date: tournament.date,
    dateDisplay: formatTournamentDateDisplay(tournament.date),
    location: tournament.location,
    address: tournament.address,
    description: tournament.description,
    packetNotes: tournament.packetNotes,
    paymentInstructions: paymentInstructionsText(
      paymentSettingsFromTournament(tournament)
    ),
    hostSchoolName: hostSchool?.name ?? null,
    organizerName: organizer?.fullName ?? "Tournament host",
    registeredTeams: registrationRows.map((r) => ({ name: r.teamName })),
    playFormatLabel: formatPlayFormatLabel(playFormat),
    poolRules: {
      matchFormat: tournament.matchFormat,
      matchFormatLabel: formatMatchFormatLabel(tournament.matchFormat),
      setStartingScore: tournament.setStartingScore,
      setTargetScore: tournament.setTargetScore,
      tiebreakTargetScore: tournament.tiebreakTargetScore,
      warmupFormatLabel: formatWarmupFormatLabel(tournament.warmupFormat),
      tiebreakCriteria,
    },
    bracketRules: hasBracketPlay
      ? {
          summary: bracketTierSummary(
            tournament.bracketCount ?? 1,
            tournament.goldTeamCount,
            tournament.silverTeamCount
          ),
          bracketCount: tournament.bracketCount ?? 1,
        }
      : null,
    poolSeedings,
    poolSchedule,
    bracketSchedule,
    bracketStructures,
    accentColor: tournament.packetAccentColor ?? "#C93D2E",
  };
}

/** Format a schedule row time for the PDF. */
export function formatPacketTime(date: Date, timeZone: string): string {
  return formatTimeInZone(date, timeZone);
}

/** Format generated timestamp for the PDF footer. */
export function formatPacketGeneratedAt(date: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(date);
  return `${day} at ${formatTimeInZone(date, timeZone)}`;
}
