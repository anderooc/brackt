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

import { and, eq } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  registrations,
  teamMembers,
  tournaments,
  waiverCompletions,
} from "@/lib/db/schema";
import { resolveIsTournamentOrganizer } from "@/lib/tournaments/permissions";
import {
  captainCanAttestOfflineWaiver,
  waiverSettingsFromTournament,
} from "@/lib/tournaments/waiver-access";
import { getLatestTournamentWaiver } from "@/lib/tournaments/waiver-compliance";

type Result = { error: string; success?: undefined } | { success: true; error?: undefined };

export async function loadRegisteredTeamMembership(
  tournamentId: string,
  teamId: string,
  userId: string
) {
  const [registration] = await db
    .select({ id: registrations.id })
    .from(registrations)
    .where(
      and(
        eq(registrations.tournamentId, tournamentId),
        eq(registrations.teamId, teamId)
      )
    )
    .limit(1);

  if (!registration) {
    return { error: "Team is not registered for this tournament." as const };
  }

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    return { error: "You are not on this team roster." as const };
  }

  return { membership };
}

async function loadTournament(tournamentId: string) {
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  return tournament ?? null;
}

async function isTeamCaptain(teamId: string, userId: string) {
  const [membership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return membership?.role === "captain";
}

function completionMatch(waiverId: string, teamId: string, playerUserId: string) {
  return and(
    eq(waiverCompletions.waiverId, waiverId),
    eq(waiverCompletions.teamId, teamId),
    eq(waiverCompletions.userId, playerUserId)
  );
}

export async function captainAttestWaiverPlayerForUser(
  user: AppUser,
  tournamentId: string,
  teamId: string,
  playerUserId: string
): Promise<Result> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament?.waiverEnabled) {
    return { error: "This tournament does not require a waiver." };
  }

  const settings = waiverSettingsFromTournament(tournament);
  if (!captainCanAttestOfflineWaiver(settings)) {
    return {
      error: "The host only allows digital acknowledgment for this waiver.",
    };
  }

  if (!(await isTeamCaptain(teamId, user.id))) {
    return { error: "Only team captains can attest offline waiver completion." };
  }

  const roster = await loadRegisteredTeamMembership(
    tournamentId,
    teamId,
    playerUserId
  );
  if (roster.error) return { error: roster.error };

  const waiver = await getLatestTournamentWaiver(tournamentId);
  if (!waiver) {
    return { error: "No waiver has been uploaded for this tournament yet." };
  }

  await db
    .insert(waiverCompletions)
    .values({
      waiverId: waiver.id,
      tournamentId,
      teamId,
      userId: playerUserId,
      method: "captain_attested",
      attestedByUserId: user.id,
    })
    .onConflictDoUpdate({
      target: [waiverCompletions.waiverId, waiverCompletions.userId],
      set: {
        teamId,
        method: "captain_attested",
        signedName: null,
        completedAt: new Date(),
        attestedByUserId: user.id,
        waivedByUserId: null,
      },
    });

  return { success: true };
}

export async function hostWaivePlayerWaiverForUser(
  user: AppUser,
  tournamentId: string,
  teamId: string,
  playerUserId: string
): Promise<Result> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament || !(await resolveIsTournamentOrganizer(tournament, user))) {
    return { error: "Only the organizer can manage tournament waivers." };
  }

  if (!tournament.waiverEnabled) {
    return { error: "This tournament does not require a waiver." };
  }

  const roster = await loadRegisteredTeamMembership(
    tournamentId,
    teamId,
    playerUserId
  );
  if (roster.error) return { error: roster.error };

  const waiver = await getLatestTournamentWaiver(tournamentId);
  if (!waiver) {
    return { error: "No waiver has been uploaded for this tournament yet." };
  }

  await db
    .insert(waiverCompletions)
    .values({
      waiverId: waiver.id,
      tournamentId,
      teamId,
      userId: playerUserId,
      method: "host_override",
      waivedByUserId: user.id,
    })
    .onConflictDoUpdate({
      target: [waiverCompletions.waiverId, waiverCompletions.userId],
      set: {
        teamId,
        method: "host_override",
        signedName: null,
        completedAt: new Date(),
        attestedByUserId: null,
        waivedByUserId: user.id,
      },
    });

  return { success: true };
}

export async function clearWaiverCompletionForUser(
  user: AppUser,
  tournamentId: string,
  teamId: string,
  playerUserId: string
): Promise<Result> {
  const tournament = await loadTournament(tournamentId);
  if (!tournament) return { error: "Tournament not found." };

  const waiver = await getLatestTournamentWaiver(tournamentId);
  if (!waiver) return { success: true };

  if (await resolveIsTournamentOrganizer(tournament, user)) {
    await db
      .delete(waiverCompletions)
      .where(completionMatch(waiver.id, teamId, playerUserId));
    return { success: true };
  }

  if (!(await isTeamCaptain(teamId, user.id))) {
    return { error: "Only captains or the host can clear waiver attestation." };
  }

  const [completion] = await db
    .select({ method: waiverCompletions.method })
    .from(waiverCompletions)
    .where(completionMatch(waiver.id, teamId, playerUserId))
    .limit(1);

  if (completion?.method !== "captain_attested") {
    return { error: "Only captain attestations can be cleared this way." };
  }

  await db
    .delete(waiverCompletions)
    .where(completionMatch(waiver.id, teamId, playerUserId));

  return { success: true };
}
