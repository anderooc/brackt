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

import { revalidatePath } from "next/cache";
import type { AppUser } from "@/lib/auth";
import { canManageTournamentStaff } from "@/lib/tournaments/permissions";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import {
  addTournamentStaffForUser,
  deleteTournamentForUser,
  duplicateTournamentForUser,
  listTournamentStaffRows,
  removeTournamentStaffForUser,
  renameTournamentForUser,
  updateTournamentListingForUser,
} from "@/lib/tournaments/tournament-admin";
import type {
  TournamentHostListingResultContract,
  TournamentHostStaffContract,
} from "../contracts/tournament-host";
import { badRequest } from "../errors";
import { requireHostTournament } from "./tournament-host";

function unwrap<T extends { error?: string }>(result: T): Exclude<T, { error: string }> {
  if (result.error) throw badRequest(result.error);
  return result as Exclude<T, { error: string }>;
}

function revalidateTournamentLists() {
  revalidatePath("/tournaments");
  revalidatePath("/explore");
  revalidatePath("/dashboard");
  revalidatePath("/schedule");
  revalidatePath("/tournaments/[slug]", "page");
}

export async function updateTournamentHostListing(
  slug: string,
  user: AppUser,
  input: { name?: string; description: string; location: string; address: string }
): Promise<TournamentHostListingResultContract> {
  const tournament = await requireHostTournament(slug, user);

  const listing = unwrap(
    await updateTournamentListingForUser(user, tournament.id, input)
  );
  let nextSlug = tournament.slug;
  if (input.name !== undefined) {
    nextSlug = unwrap(await renameTournamentForUser(user, tournament.id, input.name)).slug;
  }

  await invalidatePublicTournamentCachesByIds([tournament.id], { listing: true });
  revalidateTournamentLists();
  return {
    slug: nextSlug,
    description: listing.description,
    location: listing.location,
    address: listing.address,
  };
}

export async function duplicateTournamentForHost(
  slug: string,
  user: AppUser
): Promise<{ slug: string }> {
  const tournament = await requireHostTournament(slug, user);
  const created = unwrap(await duplicateTournamentForUser(user, tournament.id));
  revalidateTournamentLists();
  return { slug: created.slug };
}

export async function deleteTournamentForHost(
  slug: string,
  user: AppUser,
  confirmationName: string
): Promise<{ deleted: true }> {
  const tournament = await requireHostTournament(slug, user);
  unwrap(await deleteTournamentForUser(user, tournament.id, confirmationName));
  await invalidatePublicTournamentCachesByIds([tournament.id], { listing: true });
  revalidateTournamentLists();
  return { deleted: true };
}

export async function loadTournamentHostStaff(
  slug: string,
  user: AppUser
): Promise<TournamentHostStaffContract> {
  const tournament = await requireHostTournament(slug, user);
  const rows = await listTournamentStaffRows(tournament.id);
  return {
    canManage: canManageTournamentStaff(tournament, user),
    staff: rows.map((row) => ({
      userId: row.userId,
      fullName: row.fullName,
      email: row.email,
      role: row.role,
    })),
  };
}

export async function addTournamentHostStaff(
  slug: string,
  user: AppUser,
  input: { email: unknown; role: unknown }
): Promise<TournamentHostStaffContract> {
  const tournament = await requireHostTournament(slug, user);
  unwrap(await addTournamentStaffForUser(user, tournament.id, input));
  revalidatePath("/tournaments/[slug]", "page");
  return loadTournamentHostStaff(slug, user);
}

export async function removeTournamentHostStaff(
  slug: string,
  user: AppUser,
  staffUserId: string
): Promise<TournamentHostStaffContract> {
  const tournament = await requireHostTournament(slug, user);
  unwrap(await removeTournamentStaffForUser(user, tournament.id, staffUserId));
  revalidatePath("/tournaments/[slug]", "page");
  return loadTournamentHostStaff(slug, user);
}
