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
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { tournaments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveIsTournamentOrganizer } from "@/lib/tournaments/permissions";
import { isTournamentArchived } from "@/lib/tournament-status";
import {
  bulkClearScheduleInternal,
  bulkReassignCourtsInternal,
  bulkReassignRefsInternal,
  bulkShiftMatchTimesInternal,
} from "@/lib/api/queries/tournament-host-bulk-match-ops";

async function assertOrganizer(tournamentId: string) {
  const user = await requireUser();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    return { success: false as const, error: "Tournament not found" };
  }
  if (!(await resolveIsTournamentOrganizer(tournament, user))) {
    return {
      success: false as const,
      error: "Only tournament organizers can manage matches",
    };
  }
  if (isTournamentArchived(tournament.date)) {
    return { success: false as const, error: "This tournament is archived" };
  }
  return { success: true as const, tournament, user };
}

function revalidateTournamentViews(slug: string) {
  revalidatePath(`/tournaments/${slug}`);
  revalidatePath(`/tournaments/${slug}/scoring`);
  revalidatePath(`/tournaments/${slug}/brackets`);
}

export async function bulkReassignCourtsAction(
  tournamentId: string,
  slug: string,
  matchIds: string[],
  courtId: string | null
) {
  const gate = await assertOrganizer(tournamentId);
  if (!gate.success) return { success: false as const, error: gate.error };

  try {
    const result = await bulkReassignCourtsInternal(tournamentId, matchIds, courtId);
    revalidateTournamentViews(slug);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reassign courts";
    return { success: false as const, error: message };
  }
}

export async function bulkShiftMatchTimesAction(
  tournamentId: string,
  slug: string,
  options: {
    minutes: number;
    matchIds?: string[];
    courtId?: string;
    afterIso?: string | null;
  }
) {
  const gate = await assertOrganizer(tournamentId);
  if (!gate.success) return { success: false as const, error: gate.error };

  try {
    const result = await bulkShiftMatchTimesInternal(tournamentId, options);
    revalidateTournamentViews(slug);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to shift match times";
    return { success: false as const, error: message };
  }
}

export async function bulkReassignRefsAction(
  tournamentId: string,
  slug: string,
  matchIds: string[],
  refTeamId: string | null
) {
  const gate = await assertOrganizer(tournamentId);
  if (!gate.success) return { success: false as const, error: gate.error };

  try {
    const result = await bulkReassignRefsInternal(tournamentId, matchIds, refTeamId);
    revalidateTournamentViews(slug);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reassign ref team";
    return { success: false as const, error: message };
  }
}

export async function bulkClearScheduleAction(
  tournamentId: string,
  slug: string,
  matchIds: string[],
  options: { clearTime?: boolean; clearCourt?: boolean }
) {
  const gate = await assertOrganizer(tournamentId);
  if (!gate.success) return { success: false as const, error: gate.error };

  try {
    const result = await bulkClearScheduleInternal(tournamentId, matchIds, options);
    revalidateTournamentViews(slug);
    return { success: true as const, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to clear match schedule";
    return { success: false as const, error: message };
  }
}
