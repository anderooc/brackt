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

import { and, count, eq, inArray } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { db } from "@/lib/db";
import {
  courtDivisions,
  courts,
  divisions,
  registrations,
  tournamentWaitlistEntries,
  tournaments,
} from "@/lib/db/schema";
import { isTournamentArchived } from "@/lib/tournament-status";
import { ensureDivisionBracketSkeleton } from "@/lib/tournaments/bracket-structure";
import { ensureDivisionAutoPool } from "@/lib/tournaments/division-pools";
import { loadLockedTournamentForOrganizer } from "@/lib/tournaments/locked-tournament-authorization";
import { getTournamentPlaySignals } from "@/lib/tournaments/match-query";
import {
  canAssignTeamsToPools,
  canCheckInRegistrations,
  canEditRegistrations,
  canEditTournamentSetup,
  canScheduleMatches,
  hostChecklistSteps,
  resolveIsTournamentOrganizer,
  tournamentPreparationLockedReason,
} from "@/lib/tournaments/permissions";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import { registrationAvailabilityLockedStateError } from "@/lib/tournaments/registrations";
import {
  createDivisionSchema,
  registrationAvailabilitySchema,
} from "@/lib/validators";
import type { TournamentStatus } from "@/types";
import type {
  TournamentHostEntityResultContract,
  TournamentHostOverviewContract,
  TournamentHostOverviewResultContract,
  TournamentHostSetupContract,
  TournamentHostSetupResultContract,
} from "../contracts/tournament-host";
import { badRequest, forbidden, notFound } from "../errors";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ALLOWED_STATUSES: TournamentStatus[] = [
  "draft",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
];

type TournamentRow = typeof tournaments.$inferSelect;

async function invalidateTournamentHostCaches(tournamentId: string): Promise<void> {
  await invalidatePublicTournamentCachesByIds([tournamentId], {
    listing: true,
  });
}

export async function requireHostTournament(
  slug: string,
  user: AppUser
): Promise<TournamentRow> {
  const [row] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);
  if (!row) throw notFound("Tournament not found.");
  if (!(await resolveIsTournamentOrganizer(row, user))) {
    throw forbidden("Only the tournament host can access host tools.");
  }
  return row;
}

async function loadRegistrationCounts(tournamentId: string) {
  const [statusRows, waitlistRow] = await Promise.all([
    db
      .select({
        status: registrations.status,
        value: count(),
      })
      .from(registrations)
      .where(eq(registrations.tournamentId, tournamentId))
      .groupBy(registrations.status),
    db
      .select({ value: count() })
      .from(tournamentWaitlistEntries)
      .where(eq(tournamentWaitlistEntries.tournamentId, tournamentId)),
  ]);

  let pendingCount = 0;
  let confirmedCount = 0;
  let checkedInCount = 0;
  let registrationCount = 0;
  for (const row of statusRows) {
    registrationCount += row.value;
    if (row.status === "pending") pendingCount = row.value;
    if (row.status === "confirmed") confirmedCount += row.value;
    if (row.status === "checked_in") checkedInCount += row.value;
  }

  return {
    registrationCount,
    pendingCount,
    confirmedCount,
    checkedInCount,
    waitlistCount: waitlistRow[0]?.value ?? 0,
  };
}

async function loadDivisionRows(tournamentId: string) {
  return db
    .select({
      id: divisions.id,
      name: divisions.name,
      format: divisions.format,
      poolsReleasedAt: divisions.poolsReleasedAt,
    })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournamentId));
}

async function loadCourtCount(tournamentId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(courts)
    .where(eq(courts.tournamentId, tournamentId));
  return row?.value ?? 0;
}

async function buildOverview(
  tournament: TournamentRow,
  user: AppUser
): Promise<TournamentHostOverviewContract> {
  const [
    divisionRows,
    courtCount,
    registrationCounts,
    playSignals,
    canEditSetup,
    canEditRegs,
    canCheckIn,
    canSchedule,
    preparationLockedReason,
  ] = await Promise.all([
    loadDivisionRows(tournament.id),
    loadCourtCount(tournament.id),
    loadRegistrationCounts(tournament.id),
    getTournamentPlaySignals(tournament.id, { forOrganizer: true }),
    canEditTournamentSetup(tournament, user),
    canEditRegistrations(tournament, user),
    canCheckInRegistrations(tournament, user),
    canScheduleMatches(tournament, user),
    Promise.resolve(tournamentPreparationLockedReason(tournament)),
  ]);
  const canAssignPools = await canAssignTeamsToPools(
    tournament,
    user,
    registrationCounts.pendingCount
  );

  const hasPoolPlayFormat = divisionRows.some(
    (division) => division.format === "pool_to_bracket"
  );
  const hasBracketFormat = divisionRows.some(
    (division) =>
      division.format === "pool_to_bracket" ||
      division.format === "single_elimination" ||
      division.format === "double_elimination"
  );
  const hasReleasedPoolPlay = divisionRows.some(
    (division) => division.poolsReleasedAt != null
  );

  const checklist = hostChecklistSteps({
    status: tournament.status,
    description: tournament.description,
    address: tournament.address,
    playFormat: tournament.playFormat ?? "pool_to_bracket",
    divisionCount: divisionRows.length,
    courtCount,
    registrationCount: registrationCounts.registrationCount,
    pendingCount: registrationCounts.pendingCount,
    matchFormat: tournament.matchFormat,
    setStartingScore: tournament.setStartingScore,
    setTargetScore: tournament.setTargetScore,
    tiebreakTargetScore: tournament.tiebreakTargetScore,
    warmupFormat: tournament.warmupFormat,
    poolTiebreakCriteria: tournament.poolTiebreakCriteria,
    poolSettingsSavedAt: tournament.poolSettingsSavedAt,
    bracketCount: tournament.bracketCount ?? 1,
    goldTeamCount: tournament.goldTeamCount,
    silverTeamCount: tournament.silverTeamCount,
    bracketSettingsSavedAt: tournament.bracketSettingsSavedAt,
    hasPools: playSignals.hasPoolMatches,
    hasPoolsReleased: hasReleasedPoolPlay,
    hasSeededBrackets: playSignals.hasSeededBrackets,
    hasScheduledMatches: playSignals.hasScheduledMatches,
  });

  return {
    slug: tournament.slug,
    name: tournament.name,
    status: tournament.status as TournamentStatus,
    date: tournament.date,
    isArchived: isTournamentArchived(tournament.date),
    playFormat: tournament.playFormat ?? "pool_to_bracket",
    canEditSetup,
    canEditRegistrations: canEditRegs,
    canCheckIn,
    canAssignPools,
    canSchedule,
    preparationLockedReason,
    checklist,
    counts: {
      divisionCount: divisionRows.length,
      courtCount,
      registrationCount: registrationCounts.registrationCount,
      pendingCount: registrationCounts.pendingCount,
      confirmedCount: registrationCounts.confirmedCount,
      checkedInCount: registrationCounts.checkedInCount,
      waitlistCount: registrationCounts.waitlistCount,
    },
    sections: {
      setup: true,
      registrations: true,
      pending: true,
      pools: playSignals.hasPoolMatches || hasPoolPlayFormat,
      bracket: playSignals.hasBrackets || hasBracketFormat,
      schedule: playSignals.hasVisibleMatches,
      poolSettings: true,
      bracketSettings: hasBracketFormat,
    },
  };
}

async function loadSetupContract(
  tournament: TournamentRow,
  user: AppUser
): Promise<TournamentHostSetupContract> {
  const [divisionRows, courtRows, courtLinks, registrationCounts, canEdit, preparationLockedReason] =
    await Promise.all([
      loadDivisionRows(tournament.id),
      db
        .select({ id: courts.id, name: courts.name })
        .from(courts)
        .where(eq(courts.tournamentId, tournament.id)),
      db
        .select({
          divisionId: courtDivisions.divisionId,
          courtId: courtDivisions.courtId,
        })
        .from(courtDivisions)
        .innerJoin(courts, eq(courtDivisions.courtId, courts.id))
        .where(eq(courts.tournamentId, tournament.id)),
      loadRegistrationCounts(tournament.id),
      canEditTournamentSetup(tournament, user),
      Promise.resolve(tournamentPreparationLockedReason(tournament)),
    ]);

  const courtsByDivision = new Map<string, string[]>();
  const divisionsByCourt = new Map<string, string[]>();
  for (const link of courtLinks) {
    const courtIds = courtsByDivision.get(link.divisionId) ?? [];
    courtIds.push(link.courtId);
    courtsByDivision.set(link.divisionId, courtIds);

    const divisionIds = divisionsByCourt.get(link.courtId) ?? [];
    divisionIds.push(link.divisionId);
    divisionsByCourt.set(link.courtId, divisionIds);
  }

  return {
    playFormat: tournament.playFormat ?? "pool_to_bracket",
    registrationCapacity: tournament.registrationCapacity,
    registrationDeadline: tournament.registrationDeadline?.toISOString() ?? null,
    registeredCount: registrationCounts.registrationCount,
    canEdit,
    preparationLockedReason,
    divisions: divisionRows.map((division) => ({
      id: division.id,
      name: division.name,
      format: division.format,
      poolsReleasedAt: division.poolsReleasedAt?.toISOString() ?? null,
      courtIds: courtsByDivision.get(division.id) ?? [],
    })),
    courts: courtRows.map((court) => ({
      id: court.id,
      name: court.name,
      divisionIds: divisionsByCourt.get(court.id) ?? [],
    })),
  };
}

export async function loadTournamentHostOverview(
  slug: string,
  user: AppUser
): Promise<TournamentHostOverviewResultContract> {
  const tournament = await requireHostTournament(slug, user);
  return {
    success: true,
    overview: await buildOverview(tournament, user),
  };
}

export async function loadTournamentHostSetup(
  slug: string,
  user: AppUser
): Promise<TournamentHostSetupResultContract> {
  const tournament = await requireHostTournament(slug, user);
  return {
    success: true,
    setup: await loadSetupContract(tournament, user),
  };
}

export async function updateTournamentHostStatus(
  slug: string,
  user: AppUser,
  status: string
): Promise<TournamentHostOverviewResultContract> {
  const tournament = await requireHostTournament(slug, user);

  if (!ALLOWED_STATUSES.includes(status as TournamentStatus)) {
    throw badRequest("Invalid tournament status.");
  }

  if (isTournamentArchived(tournament.date)) {
    throw badRequest(
      "This tournament is archived (past its date). Update the date first to change status."
    );
  }

  const [updated] = await db
    .update(tournaments)
    .set({ status: status as TournamentStatus, updatedAt: new Date() })
    .where(eq(tournaments.id, tournament.id))
    .returning();

  if (!updated) throw badRequest("Could not update tournament status.");

  await invalidateTournamentHostCaches(tournament.id);
  return {
    success: true,
    overview: await buildOverview(updated, user),
  };
}

export async function updateTournamentHostDate(
  slug: string,
  user: AppUser,
  date: string
): Promise<TournamentHostOverviewResultContract> {
  const tournament = await requireHostTournament(slug, user);
  const trimmed = (date ?? "").trim();
  if (!ISO_DATE_RE.test(trimmed)) {
    throw badRequest("Pick a valid date.");
  }

  const [updated] = await db
    .update(tournaments)
    .set({ date: trimmed, updatedAt: new Date() })
    .where(eq(tournaments.id, tournament.id))
    .returning();

  if (!updated) throw badRequest("Could not update tournament date.");

  await invalidateTournamentHostCaches(tournament.id);
  return {
    success: true,
    overview: await buildOverview(updated, user),
  };
}

export async function updateTournamentHostRegistrationAvailability(
  slug: string,
  user: AppUser,
  values: { capacity: number | null; deadline: string | null }
): Promise<TournamentHostSetupResultContract> {
  const parsed = registrationAvailabilitySchema.safeParse(values);
  if (!parsed.success) {
    throw badRequest(
      parsed.error.issues[0]?.message ??
        "Enter valid registration availability settings."
    );
  }

  const tournament = await requireHostTournament(slug, user);
  const result = await db.transaction(async (tx) => {
    const executor = tx as unknown as typeof db;
    const locked = await loadLockedTournamentForOrganizer(
      tournament.id,
      user.id,
      executor
    );
    if (!locked) {
      throw forbidden("Only the organizer can edit registration availability.");
    }
    const lockedStateError = registrationAvailabilityLockedStateError(
      locked.date
    );
    if (lockedStateError) throw badRequest(lockedStateError);

    const [row] = await executor
      .select({ value: count() })
      .from(registrations)
      .where(eq(registrations.tournamentId, tournament.id));
    const activeCount = row?.value ?? 0;
    if (parsed.data.capacity != null && parsed.data.capacity < activeCount) {
      throw badRequest(
        `Capacity cannot be below ${activeCount} active registrations.`
      );
    }

    await executor
      .update(tournaments)
      .set({
        registrationCapacity: parsed.data.capacity,
        registrationDeadline: parsed.data.deadline
          ? new Date(parsed.data.deadline)
          : null,
        updatedAt: new Date(),
      })
      .where(eq(tournaments.id, tournament.id));
  });

  void result;
  await invalidateTournamentHostCaches(tournament.id);
  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    setup: await loadSetupContract(refreshed, user),
  };
}

export async function addTournamentHostDivision(
  slug: string,
  user: AppUser,
  name: string
): Promise<TournamentHostEntityResultContract> {
  const tournament = await requireHostTournament(slug, user);
  if (!(await canEditTournamentSetup(tournament, user))) {
    throw badRequest(
      "Pools cannot be edited in the current tournament stage. Complete setup before the event starts."
    );
  }

  const parsed = createDivisionSchema.safeParse({ name });
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0].message);
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "division.name", text: parsed.data.name },
  ]);
  if (contentError) throw badRequest(contentError);

  const normalizedDivisionName = parsed.data.name.trim().toLowerCase();
  const existingDivisions = await db
    .select({ name: divisions.name })
    .from(divisions)
    .where(eq(divisions.tournamentId, tournament.id));
  if (
    existingDivisions.some(
      (division) =>
        division.name.trim().toLowerCase() === normalizedDivisionName
    )
  ) {
    throw badRequest("A pool with this name already exists.");
  }

  const playFormat = tournament.playFormat ?? "pool_to_bracket";
  const [inserted] = await db
    .insert(divisions)
    .values({
      tournamentId: tournament.id,
      name: parsed.data.name.trim(),
      format: playFormat,
    })
    .returning({ id: divisions.id });

  if (!inserted) throw badRequest("Could not create pool.");

  await ensureDivisionAutoPool(inserted.id);
  await ensureDivisionBracketSkeleton(inserted.id, playFormat);

  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    id: inserted.id,
    setup: await loadSetupContract(refreshed, user),
  };
}

export async function removeTournamentHostDivision(
  slug: string,
  user: AppUser,
  divisionId: string
): Promise<TournamentHostSetupResultContract> {
  const tournament = await requireHostTournament(slug, user);
  if (!(await canEditTournamentSetup(tournament, user))) {
    throw badRequest("Pools cannot be removed in the current tournament stage.");
  }

  const [division] = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(
      and(
        eq(divisions.id, divisionId),
        eq(divisions.tournamentId, tournament.id)
      )
    )
    .limit(1);
  if (!division) throw notFound("Pool not found.");

  await db.delete(divisions).where(eq(divisions.id, divisionId));

  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    setup: await loadSetupContract(refreshed, user),
  };
}

export async function addTournamentHostCourt(
  slug: string,
  user: AppUser,
  name: string
): Promise<TournamentHostEntityResultContract> {
  const tournament = await requireHostTournament(slug, user);
  if (!(await canEditTournamentSetup(tournament, user))) {
    throw badRequest("Courts cannot be edited in the current tournament stage.");
  }

  const trimmed = name.trim();
  if (!trimmed) throw badRequest("Court name is required.");

  const contentError = await flagBlockedContent(user.id, [
    { area: "court.name", text: trimmed },
  ]);
  if (contentError) throw badRequest(contentError);

  const existingCourts = await db
    .select({ name: courts.name })
    .from(courts)
    .where(eq(courts.tournamentId, tournament.id));
  if (
    existingCourts.some(
      (court) => court.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
  ) {
    throw badRequest("A court with this name already exists.");
  }

  const [inserted] = await db
    .insert(courts)
    .values({ tournamentId: tournament.id, name: trimmed })
    .returning({ id: courts.id });

  if (!inserted) throw badRequest("Could not create court.");

  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    id: inserted.id,
    setup: await loadSetupContract(refreshed, user),
  };
}

export async function removeTournamentHostCourt(
  slug: string,
  user: AppUser,
  courtId: string
): Promise<TournamentHostSetupResultContract> {
  const tournament = await requireHostTournament(slug, user);
  if (!(await canEditTournamentSetup(tournament, user))) {
    throw badRequest("Courts cannot be removed in the current tournament stage.");
  }

  const [court] = await db
    .select({ id: courts.id })
    .from(courts)
    .where(and(eq(courts.id, courtId), eq(courts.tournamentId, tournament.id)))
    .limit(1);
  if (!court) throw notFound("Court not found.");

  await db.delete(courts).where(eq(courts.id, courtId));

  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    setup: await loadSetupContract(refreshed, user),
  };
}

export async function setTournamentHostDivisionCourts(
  slug: string,
  user: AppUser,
  divisionId: string,
  courtIds: string[]
): Promise<TournamentHostSetupResultContract> {
  const tournament = await requireHostTournament(slug, user);
  if (!(await canEditTournamentSetup(tournament, user))) {
    throw badRequest(
      "Court assignments cannot be changed in the current tournament stage."
    );
  }

  const [division] = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(
      and(
        eq(divisions.id, divisionId),
        eq(divisions.tournamentId, tournament.id)
      )
    )
    .limit(1);
  if (!division) throw notFound("Pool not found.");

  const uniqueIds = [...new Set(courtIds)];
  if (uniqueIds.length !== courtIds.length) {
    throw badRequest("Duplicate court selection.");
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(courtDivisions)
        .where(eq(courtDivisions.divisionId, divisionId));

      if (uniqueIds.length === 0) return;

      const rows = await tx
        .select({ id: courts.id })
        .from(courts)
        .where(
          and(
            eq(courts.tournamentId, tournament.id),
            inArray(courts.id, uniqueIds)
          )
        );

      if (rows.length !== uniqueIds.length) {
        throw new Error("invalid_courts");
      }

      await tx.insert(courtDivisions).values(
        uniqueIds.map((courtId) => ({ courtId, divisionId }))
      );
    });
  } catch {
    throw badRequest("Could not update court assignments.");
  }

  const refreshed = await requireHostTournament(slug, user);
  return {
    success: true,
    setup: await loadSetupContract(refreshed, user),
  };
}
