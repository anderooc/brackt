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
import {
  divisions,
  registrationPayments,
  registrations,
  schoolMembers,
  teamMembers,
  teams,
  tournamentStaff,
  tournamentWaivers,
  tournaments,
  waiverCompletions,
} from "@/lib/db/schema";
import type { DashboardTournamentRelation } from "@/lib/labels/dashboard-relation";
import { isTournamentArchived, todayISO } from "@/lib/tournament-status";
import {
  collectAttentionItems,
  type AttentionItem,
} from "@/lib/tournaments/dashboard-attention";
import type {
  RegistrationPaymentStatus,
  RegistrationStatus,
  TournamentStatus,
} from "@/types";
import { and, count, desc, eq, inArray, or } from "drizzle-orm";

export type { DashboardTournamentRelation };

export type DashboardTournament = {
  id: string;
  slug: string;
  name: string;
  date: string;
  location: string;
  status: TournamentStatus;
  relation: DashboardTournamentRelation;
  /** Team the user is registered with, when applicable. */
  teamName: string | null;
  divisionName: string | null;
  registrationStatus: RegistrationStatus | null;
  isOrganizer: boolean;
  isHostSchool: boolean;
};

const RELATION_PRIORITY: Record<DashboardTournamentRelation, number> = {
  pending: 0,
  signed_up: 1,
  hosting: 2,
  past: 3,
};

const REG_PRIORITY: Record<RegistrationStatus, number> = {
  checked_in: 0,
  confirmed: 1,
  pending: 2,
};

function resolveRelation(args: {
  date: string;
  tournamentStatus: TournamentStatus;
  registrationStatus: RegistrationStatus | null;
  isOrganizer: boolean;
  isHostSchool: boolean;
  today: string;
}): DashboardTournamentRelation {
  const past =
    isTournamentArchived(args.date, args.today) ||
    args.tournamentStatus === "completed";

  if (past) return "past";
  if (args.registrationStatus === "pending") return "pending";
  if (
    args.registrationStatus === "confirmed" ||
    args.registrationStatus === "checked_in"
  ) {
    return "signed_up";
  }
  if (args.isOrganizer || args.isHostSchool) return "hosting";
  // Fallback — should be rare once rows are filtered to connected tournaments.
  return "signed_up";
}

/**
 * Tournaments the user is connected to via team registration, organizing,
 * co-host/staff assignment, or membership in the host school.
 * Upcoming / in-progress first, then past.
 */
export async function getDashboardTournaments(
  userId: string,
  options: { limit?: number } = {}
): Promise<DashboardTournament[]> {
  const limit = options.limit;
  const today = todayISO();

  const [memberTeams, schoolRows] = await Promise.all([
    db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId)),
    db
      .select({ schoolId: schoolMembers.schoolId })
      .from(schoolMembers)
      .where(eq(schoolMembers.userId, userId)),
  ]);

  const teamIds = memberTeams.map((r) => r.teamId);
  const schoolIds = schoolRows.map((r) => r.schoolId);

  const [registrationRows, organizedRows, staffRows, hostSchoolRows] =
    await Promise.all([
      teamIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              tournamentId: tournaments.id,
              slug: tournaments.slug,
              name: tournaments.name,
              date: tournaments.date,
              location: tournaments.location,
              status: tournaments.status,
              registrationStatus: registrations.status,
              registeredAt: registrations.registeredAt,
              teamName: teams.name,
              divisionName: divisions.name,
            })
            .from(registrations)
            .innerJoin(
              tournaments,
              eq(registrations.tournamentId, tournaments.id)
            )
            .innerJoin(teams, eq(registrations.teamId, teams.id))
            .leftJoin(divisions, eq(registrations.divisionId, divisions.id))
            .where(inArray(registrations.teamId, teamIds))
            .orderBy(desc(registrations.registeredAt)),
      db
        .select({
          tournamentId: tournaments.id,
          slug: tournaments.slug,
          name: tournaments.name,
          date: tournaments.date,
          location: tournaments.location,
          status: tournaments.status,
        })
        .from(tournaments)
        .where(eq(tournaments.organizerId, userId)),
      db
        .select({
          tournamentId: tournaments.id,
          slug: tournaments.slug,
          name: tournaments.name,
          date: tournaments.date,
          location: tournaments.location,
          status: tournaments.status,
        })
        .from(tournamentStaff)
        .innerJoin(
          tournaments,
          eq(tournamentStaff.tournamentId, tournaments.id)
        )
        .where(eq(tournamentStaff.userId, userId)),
      schoolIds.length === 0
        ? Promise.resolve([])
        : db
            .select({
              tournamentId: tournaments.id,
              slug: tournaments.slug,
              name: tournaments.name,
              date: tournaments.date,
              location: tournaments.location,
              status: tournaments.status,
            })
            .from(tournaments)
            .where(inArray(tournaments.hostSchoolId, schoolIds)),
    ]);

  // Host-school drafts stay organizer/staff-only; other school members see
  // published host events (registration open and beyond).
  const organizedIds = new Set([
    ...organizedRows.map((o) => o.tournamentId),
    ...staffRows.map((o) => o.tournamentId),
  ]);
  const hostVisible = hostSchoolRows.filter(
    (row) => row.status !== "draft" || organizedIds.has(row.tournamentId)
  );

  type Acc = {
    id: string;
    slug: string;
    name: string;
    date: string;
    location: string;
    status: TournamentStatus;
    registrationStatus: RegistrationStatus | null;
    teamName: string | null;
    divisionName: string | null;
    isOrganizer: boolean;
    isHostSchool: boolean;
    regRank: number;
  };

  const byId = new Map<string, Acc>();

  function upsertBase(row: {
    tournamentId: string;
    slug: string;
    name: string;
    date: string;
    location: string;
    status: TournamentStatus;
  }) {
    const existing = byId.get(row.tournamentId);
    if (existing) return existing;
    const created: Acc = {
      id: row.tournamentId,
      slug: row.slug,
      name: row.name,
      date: row.date,
      location: row.location,
      status: row.status,
      registrationStatus: null,
      teamName: null,
      divisionName: null,
      isOrganizer: false,
      isHostSchool: false,
      regRank: Number.POSITIVE_INFINITY,
    };
    byId.set(row.tournamentId, created);
    return created;
  }

  for (const row of organizedRows) {
    const acc = upsertBase(row);
    acc.isOrganizer = true;
  }

  for (const row of staffRows) {
    const acc = upsertBase(row);
    acc.isOrganizer = true;
  }

  for (const row of hostVisible) {
    const acc = upsertBase(row);
    acc.isHostSchool = true;
  }

  for (const row of registrationRows) {
    const acc = upsertBase(row);
    const rank = REG_PRIORITY[row.registrationStatus];
    if (rank < acc.regRank) {
      acc.regRank = rank;
      acc.registrationStatus = row.registrationStatus;
      acc.teamName = row.teamName;
      acc.divisionName = row.divisionName;
    }
  }

  const items: DashboardTournament[] = [...byId.values()].map((acc) => ({
    id: acc.id,
    slug: acc.slug,
    name: acc.name,
    date: acc.date,
    location: acc.location,
    status: acc.status,
    registrationStatus: acc.registrationStatus,
    teamName: acc.teamName,
    divisionName: acc.divisionName,
    isOrganizer: acc.isOrganizer,
    isHostSchool: acc.isHostSchool,
    relation: resolveRelation({
      date: acc.date,
      tournamentStatus: acc.status,
      registrationStatus: acc.registrationStatus,
      isOrganizer: acc.isOrganizer,
      isHostSchool: acc.isHostSchool,
      today,
    }),
  }));

  items.sort((a, b) => {
    const aPast = a.relation === "past" ? 1 : 0;
    const bPast = b.relation === "past" ? 1 : 0;
    if (aPast !== bPast) return aPast - bPast;
    if (a.date !== b.date) {
      // Upcoming: soonest first. Past: most recent first.
      return aPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
    }
    return RELATION_PRIORITY[a.relation] - RELATION_PRIORITY[b.relation];
  });

  return limit == null ? items : items.slice(0, limit);
}

export type DashboardHostingStats = {
  /** Confirmed + checked-in teams. */
  teamCount: number;
  pendingCount: number;
  capacity: number | null;
  deadline: Date | null;
  deadlinePassed: boolean;
  paymentsToReview: number;
};

export type DashboardActivity = {
  attention: AttentionItem[];
  hosting: Map<string, DashboardHostingStats>;
};

const ACTIVE_REGISTRATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
] as const;

/**
 * Action items and hosting stats for the dashboard, in one parallel wave.
 * Only upcoming tournaments are considered.
 */
export async function getDashboardActivity(
  userId: string,
  tournamentsForUser: DashboardTournament[],
  memberships: Array<{ teamId: string; role: string }>
): Promise<DashboardActivity> {
  const upcoming = tournamentsForUser.filter((t) => t.relation !== "past");
  const hostedIds = upcoming.filter((t) => t.isOrganizer).map((t) => t.id);
  const registeredIds = upcoming
    .filter((t) => t.registrationStatus != null)
    .map((t) => t.id);
  const teamIds = memberships.map((m) => m.teamId);
  const captainTeamIds = memberships
    .filter((m) => m.role === "captain")
    .map((m) => m.teamId);

  const none = Promise.resolve([] as never[]);
  const [
    hostedRows,
    hostedRegCounts,
    hostedPaymentCounts,
    myRegistrations,
    waiverRows,
    completionRows,
    rosterRows,
  ] = await Promise.all([
    hostedIds.length === 0
      ? none
      : db
          .select({
            id: tournaments.id,
            capacity: tournaments.registrationCapacity,
            deadline: tournaments.registrationDeadline,
          })
          .from(tournaments)
          .where(inArray(tournaments.id, hostedIds)),
    hostedIds.length === 0
      ? none
      : db
          .select({
            tournamentId: registrations.tournamentId,
            status: registrations.status,
            value: count(),
          })
          .from(registrations)
          .where(inArray(registrations.tournamentId, hostedIds))
          .groupBy(registrations.tournamentId, registrations.status),
    hostedIds.length === 0
      ? none
      : db
          .select({
            tournamentId: registrationPayments.tournamentId,
            value: count(),
          })
          .from(registrationPayments)
          .where(
            and(
              inArray(registrationPayments.tournamentId, hostedIds),
              eq(registrationPayments.status, "submitted")
            )
          )
          .groupBy(registrationPayments.tournamentId),
    registeredIds.length === 0 || teamIds.length === 0
      ? none
      : db
          .select({
            tournamentId: registrations.tournamentId,
            teamId: registrations.teamId,
            teamName: teams.name,
            waiverEnabled: tournaments.waiverEnabled,
            waiverAllowDigitalAck: tournaments.waiverAllowDigitalAck,
            paymentStatus: registrationPayments.status,
            amountCents: registrationPayments.amountCents,
          })
          .from(registrations)
          .innerJoin(teams, eq(registrations.teamId, teams.id))
          .innerJoin(
            tournaments,
            eq(registrations.tournamentId, tournaments.id)
          )
          .leftJoin(
            registrationPayments,
            eq(registrationPayments.registrationId, registrations.id)
          )
          .where(
            and(
              inArray(registrations.tournamentId, registeredIds),
              inArray(registrations.teamId, teamIds),
              inArray(registrations.status, [...ACTIVE_REGISTRATION_STATUSES])
            )
          ),
    registeredIds.length === 0
      ? none
      : db
          .select({
            id: tournamentWaivers.id,
            tournamentId: tournamentWaivers.tournamentId,
            version: tournamentWaivers.version,
          })
          .from(tournamentWaivers)
          .where(inArray(tournamentWaivers.tournamentId, registeredIds)),
    registeredIds.length === 0
      ? none
      : db
          .select({
            waiverId: waiverCompletions.waiverId,
            userId: waiverCompletions.userId,
          })
          .from(waiverCompletions)
          .where(
            and(
              inArray(waiverCompletions.tournamentId, registeredIds),
              captainTeamIds.length === 0
                ? eq(waiverCompletions.userId, userId)
                : or(
                    eq(waiverCompletions.userId, userId),
                    inArray(waiverCompletions.teamId, captainTeamIds)
                  )
            )
          ),
    registeredIds.length === 0 || captainTeamIds.length === 0
      ? none
      : db
          .select({ teamId: teamMembers.teamId, userId: teamMembers.userId })
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, captainTeamIds)),
  ]);

  const byId = new Map(upcoming.map((t) => [t.id, t]));
  const ref = (id: string) => {
    const t = byId.get(id)!;
    return { id: t.id, slug: t.slug, name: t.name, date: t.date };
  };

  const now = Date.now();
  const hosting = new Map<string, DashboardHostingStats>();
  for (const row of hostedRows) {
    hosting.set(row.id, {
      teamCount: 0,
      pendingCount: 0,
      capacity: row.capacity,
      deadline: row.deadline,
      deadlinePassed: row.deadline != null && row.deadline.getTime() < now,
      paymentsToReview: 0,
    });
  }
  for (const row of hostedRegCounts) {
    const stats = hosting.get(row.tournamentId);
    if (!stats) continue;
    if (row.status === "pending") stats.pendingCount += row.value;
    else stats.teamCount += row.value;
  }
  for (const row of hostedPaymentCounts) {
    const stats = hosting.get(row.tournamentId);
    if (stats) stats.paymentsToReview = row.value;
  }

  const latestWaiver = new Map<string, { id: string; version: number }>();
  for (const row of waiverRows) {
    const current = latestWaiver.get(row.tournamentId);
    if (!current || row.version > current.version) {
      latestWaiver.set(row.tournamentId, { id: row.id, version: row.version });
    }
  }

  const rosterByTeam = new Map<string, string[]>();
  for (const row of rosterRows) {
    const roster = rosterByTeam.get(row.teamId) ?? [];
    roster.push(row.userId);
    rosterByTeam.set(row.teamId, roster);
  }

  const captainSet = new Set(captainTeamIds);
  const attention = collectAttentionItems({
    userId,
    hosted: [...hosting.entries()].map(([id, stats]) => ({
      tournament: ref(id),
      pendingCount: stats.pendingCount,
      paymentsToReview: stats.paymentsToReview,
    })),
    registrations: myRegistrations.map((row) => ({
      tournament: ref(row.tournamentId),
      teamId: row.teamId,
      teamName: row.teamName,
      isCaptain: captainSet.has(row.teamId),
      paymentStatus: row.paymentStatus as RegistrationPaymentStatus | null,
      amountCents: row.amountCents,
      waiverEnabled: row.waiverEnabled,
      waiverAllowDigitalAck: row.waiverAllowDigitalAck,
    })),
    latestWaiverByTournament: new Map(
      [...latestWaiver.entries()].map(([tid, w]) => [tid, w.id])
    ),
    completions: completionRows,
    rosterByTeam,
  });

  return { attention, hosting };
}
