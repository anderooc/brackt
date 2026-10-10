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

import { and, asc, eq, inArray, ne, or, sql } from "drizzle-orm";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  brackets,
  courts,
  divisions,
  matches,
  pools,
  tournaments,
  tournamentStaff,
  users,
} from "@/lib/db/schema";
import {
  OperationConflictError,
  OperationValidationError,
} from "@/lib/tournaments/competition-operation-rules";
import { duplicateTournamentAsDraft } from "@/lib/tournaments/duplicate-tournament";
import {
  canManageTournamentStaff,
  resolveIsTournamentOrganizer,
} from "@/lib/tournaments/permissions";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { addTournamentStaffSchema, createTournamentSchema } from "@/lib/validators";
import type { TournamentStaffRole } from "@/types";

/**
 * Organizer-only tournament administration shared by the web server actions
 * and the v1 API. Callers own cache revalidation.
 */

type Failure = { error: string; success?: undefined };
type Ok<T extends object = object> = { success: true; error?: undefined } & T;

async function loadTournament(tournamentId: string) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  return tournament ?? null;
}

export async function renameTournamentForUser(
  user: AppUser,
  tournamentId: string,
  name: string
): Promise<Failure | Ok<{ slug: string }>> {
  const parsed = createTournamentSchema
    .pick({ name: true })
    .safeParse({ name: name.trim() });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const trimmed = parsed.data.name.trim();
  if (!trimmed) return { error: "Tournament name is required" };

  const contentError = await flagBlockedContent(user.id, [
    { area: "tournament.name", text: trimmed },
  ]);
  if (contentError) return { error: contentError };

  const tournament = await loadTournament(tournamentId);
  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the organizer can rename this tournament" };
  }

  if (trimmed === tournament.name.trim()) {
    return { success: true, slug: tournament.slug };
  }

  const otherSlugs = await db
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(ne(tournaments.id, tournamentId));
  const newSlug = uniqueSlug(
    slugify(trimmed, "tournament"),
    otherSlugs.map((row) => row.slug)
  );

  await db
    .update(tournaments)
    .set({ name: trimmed, slug: newSlug, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  return { success: true, slug: newSlug };
}

export async function updateTournamentListingForUser(
  user: AppUser,
  tournamentId: string,
  input: { description: string; location: string; address: string }
): Promise<
  | Failure
  | Ok<{
      slug: string;
      description: string | null;
      location: string;
      address: string | null;
    }>
> {
  const parsed = createTournamentSchema
    .pick({ description: true, location: true, address: true })
    .safeParse({
      description: input.description.trim() || undefined,
      location: input.location.trim(),
      address: input.address.trim() || undefined,
    });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid listing details" };
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "tournament.description", text: parsed.data.description },
    { area: "tournament.location", text: parsed.data.location },
    { area: "tournament.address", text: parsed.data.address },
  ]);
  if (contentError) return { error: contentError };

  const tournament = await loadTournament(tournamentId);
  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the organizer can edit listing details" };
  }

  const description = parsed.data.description?.trim() || null;
  const location = parsed.data.location.trim();
  const address = parsed.data.address?.trim() || null;

  await db
    .update(tournaments)
    .set({ description, location, address, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  return { success: true, slug: tournament.slug, description, location, address };
}

export async function deleteTournamentForUser(
  user: AppUser,
  tournamentId: string,
  confirmationName: string
): Promise<Failure | Ok> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the organizer can delete this tournament" };
  }

  if (tournament.name.trim() !== confirmationName.trim()) {
    return {
      error:
        "Tournament name does not match — type it exactly as shown (including spaces).",
    };
  }

  try {
    await db.transaction(async (tx) => {
      const poolRows = await tx
        .select({ id: pools.id })
        .from(pools)
        .innerJoin(divisions, eq(pools.divisionId, divisions.id))
        .where(eq(divisions.tournamentId, tournamentId));
      const bracketRows = await tx
        .select({ id: brackets.id })
        .from(brackets)
        .innerJoin(divisions, eq(brackets.divisionId, divisions.id))
        .where(eq(divisions.tournamentId, tournamentId));
      const courtRows = await tx
        .select({ id: courts.id })
        .from(courts)
        .where(eq(courts.tournamentId, tournamentId));

      const poolIds = poolRows.map((row) => row.id);
      const bracketIds = bracketRows.map((row) => row.id);
      const courtIds = courtRows.map((row) => row.id);

      const matchPredicates = [];
      if (poolIds.length > 0) matchPredicates.push(inArray(matches.poolId, poolIds));
      if (bracketIds.length > 0) {
        matchPredicates.push(inArray(matches.bracketId, bracketIds));
      }
      if (courtIds.length > 0) matchPredicates.push(inArray(matches.courtId, courtIds));

      if (matchPredicates.length === 1) {
        await tx.delete(matches).where(matchPredicates[0]);
      } else if (matchPredicates.length > 1) {
        await tx.delete(matches).where(or(...matchPredicates));
      }

      await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));
    });
  } catch {
    return { error: "Could not delete tournament. Try again." };
  }

  return { success: true };
}

export async function duplicateTournamentForUser(
  user: AppUser,
  tournamentId: string
): Promise<Failure | Ok<{ slug: string }>> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the organizer can duplicate this tournament" };
  }

  try {
    const created = await duplicateTournamentAsDraft({
      sourceTournamentId: tournamentId,
      actorId: user.id,
    });
    return { success: true, slug: created.slug };
  } catch (error) {
    if (
      error instanceof OperationConflictError ||
      error instanceof OperationValidationError
    ) {
      return { error: error.message };
    }
    console.error("Tournament duplication failed", error);
    return { error: "Could not update tournament data. Try again." };
  }
}

export interface TournamentStaffMember {
  id: string;
  fullName: string;
  email: string;
  role: TournamentStaffRole;
}

export async function addTournamentStaffForUser(
  user: AppUser,
  tournamentId: string,
  input: { email: unknown; role: unknown }
): Promise<Failure | Ok<{ member: TournamentStaffMember }>> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament || !canManageTournamentStaff(tournament, user)) {
    return { error: "Only the tournament owner or an admin can manage staff." };
  }

  const parsed = addTournamentStaffSchema.safeParse({
    email: input.email,
    role: input.role || "co_host",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [target] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  if (!target) {
    return {
      error: "No account found for that email. They need to sign up on brackt first.",
    };
  }
  if (target.id === tournament.organizerId) {
    return { error: "The tournament owner is already the organizer." };
  }

  const [existing] = await db
    .select({ id: tournamentStaff.id })
    .from(tournamentStaff)
    .where(
      and(
        eq(tournamentStaff.tournamentId, tournamentId),
        eq(tournamentStaff.userId, target.id)
      )
    )
    .limit(1);
  if (existing) {
    return { error: "That user is already on this tournament's staff." };
  }

  const role = parsed.data.role as TournamentStaffRole;
  await db.insert(tournamentStaff).values({
    tournamentId,
    userId: target.id,
    role,
    createdByUserId: user.id,
  });

  return {
    success: true,
    member: { id: target.id, fullName: target.fullName, email: target.email, role },
  };
}

export async function removeTournamentStaffForUser(
  user: AppUser,
  tournamentId: string,
  staffUserId: string
): Promise<Failure | Ok> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament || !canManageTournamentStaff(tournament, user)) {
    return { error: "Only the tournament owner or an admin can manage staff." };
  }

  await db
    .delete(tournamentStaff)
    .where(
      and(
        eq(tournamentStaff.tournamentId, tournamentId),
        eq(tournamentStaff.userId, staffUserId)
      )
    );
  return { success: true };
}

export function listTournamentStaffRows(tournamentId: string) {
  return db
    .select({
      id: tournamentStaff.id,
      userId: tournamentStaff.userId,
      role: tournamentStaff.role,
      fullName: users.fullName,
      email: users.email,
      createdAt: tournamentStaff.createdAt,
    })
    .from(tournamentStaff)
    .innerJoin(users, eq(users.id, tournamentStaff.userId))
    .where(eq(tournamentStaff.tournamentId, tournamentId))
    .orderBy(asc(users.fullName), asc(users.email));
}
