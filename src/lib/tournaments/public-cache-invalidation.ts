/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { asc, eq, inArray, or } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import {
  divisions,
  matches,
  pools,
  poolTeams,
  registrations,
  tournamentWaitlistEntries,
  tournaments,
} from "@/lib/db/schema";
import {
  PUBLIC_TOURNAMENTS_CACHE_TAG,
  publicTournamentCacheTag,
} from "./public-cache";

interface PublicCacheInvalidationOptions {
  listing?: boolean;
}

/**
 * Expire a public cache tag immediately.
 *
 * Prefer this over `updateTag`: the mobile/API Route Handlers call the same
 * invalidation helpers as Server Actions, and `updateTag` throws outside
 * actions. `{ expire: 0 }` matches updateTag's immediate expiry, and in
 * Server Actions it also triggers the client cache refresh.
 */
function expirePublicCacheTag(tag: string): void {
  revalidateTag(tag, { expire: 0 });
}

export function invalidatePublicTournamentCaches(
  slugs: Iterable<string>,
  { listing = false }: PublicCacheInvalidationOptions = {}
): void {
  const uniqueSlugs = [...new Set(slugs)].filter(Boolean);
  if (listing) expirePublicCacheTag(PUBLIC_TOURNAMENTS_CACHE_TAG);
  for (const slug of uniqueSlugs) {
    expirePublicCacheTag(publicTournamentCacheTag(slug));
  }
}

export async function invalidatePublicTournamentCachesByIds(
  tournamentIds: Iterable<string>,
  options?: PublicCacheInvalidationOptions
): Promise<void> {
  const uniqueIds = [...new Set(tournamentIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    if (options?.listing) invalidatePublicTournamentCaches([], options);
    return;
  }
  const rows = await db
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(inArray(tournaments.id, uniqueIds));
  invalidatePublicTournamentCaches(
    rows.map((row) => row.slug),
    options
  );
}

export async function publicTournamentIdsForSchool(
  schoolId: string,
  client: typeof db = db
): Promise<string[]> {
  const rows = await client
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.hostSchoolId, schoolId));
  return rows.map((row) => row.id);
}

export async function lockPublicTournamentParentsForSchool(
  schoolId: string,
  knownTournamentIds: Iterable<string>,
  client: typeof db
): Promise<PublicTournamentParent[]> {
  const discovered = await publicTournamentIdsForSchool(schoolId, client);
  const tournamentIds = [...new Set([
    ...knownTournamentIds,
    ...discovered,
  ])].sort();
  if (tournamentIds.length === 0) return [];
  return client.select({ id: tournaments.id, slug: tournaments.slug })
    .from(tournaments)
    .where(inArray(tournaments.id, tournamentIds))
    .orderBy(asc(tournaments.id))
    .for("update");
}

export async function publicTournamentIdsForTeam(
  teamId: string,
  client: typeof db = db
): Promise<string[]> {
  const registrationRows = await client
    .select({ id: registrations.tournamentId })
    .from(registrations)
    .where(eq(registrations.teamId, teamId));
  const waitlistRows = await client
    .select({ id: tournamentWaitlistEntries.tournamentId })
    .from(tournamentWaitlistEntries)
    .where(eq(tournamentWaitlistEntries.teamId, teamId));
  const poolRows = await client
      .select({ id: tournaments.id })
      .from(poolTeams)
      .innerJoin(pools, eq(poolTeams.poolId, pools.id))
      .innerJoin(divisions, eq(pools.divisionId, divisions.id))
      .innerJoin(tournaments, eq(divisions.tournamentId, tournaments.id))
      .where(eq(poolTeams.teamId, teamId));
  const matchRows = await client
      .select({ id: tournaments.id })
      .from(matches)
      .innerJoin(tournaments, eq(matches.tournamentId, tournaments.id))
      .where(
        or(
          eq(matches.teamAId, teamId),
          eq(matches.teamBId, teamId),
          eq(matches.refTeamId, teamId),
          eq(matches.winnerId, teamId)
        )
      );
  return [...new Set([
    ...registrationRows,
    ...waitlistRows,
    ...poolRows,
    ...matchRows,
  ].map((row) => row.id))];
}

export type PublicTournamentParent = { id: string; slug: string };

export async function lockPublicTournamentParentsForTeam(
  teamId: string,
  knownTournamentIds: Iterable<string>,
  client: typeof db
): Promise<PublicTournamentParent[]> {
  const discovered = await publicTournamentIdsForTeam(teamId, client);
  const tournamentIds = [...new Set([
    ...knownTournamentIds,
    ...discovered,
  ])].sort();
  if (tournamentIds.length === 0) return [];
  return client
    .select({ id: tournaments.id, slug: tournaments.slug })
    .from(tournaments)
    .where(inArray(tournaments.id, tournamentIds))
    .orderBy(asc(tournaments.id))
    .for("update");
}
