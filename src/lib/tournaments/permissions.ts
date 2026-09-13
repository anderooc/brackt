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

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { TEAM_GENDER_LABELS } from "@/lib/constants/team";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { tournamentStaff } from "@/lib/db/schema";
import { getHostingSchoolForUser } from "@/lib/schools/hosting";
import { isTournamentArchived } from "@/lib/tournament-status";
import type { PlayFormat } from "@/lib/labels/play-format";
import {
  evaluateListingDetailsChecklist,
  listingDetailsHint,
} from "@/lib/tournaments/listing-details-checklist";
import {
  bracketSettingsChecklistComplete,
  bracketSettingsChecklistHint,
  poolSettingsChecklistComplete,
  poolSettingsChecklistHint,
} from "@/lib/tournaments/tournament-settings-checklist";
import type { TeamGender, UserRole } from "@/types";

/** Fields required for permission checks across server and client. */
export type TournamentForPermissions = {
  id: string;
  organizerId: string;
  /** Metadata from hosting school at create. */
  hostSchoolId: string | null;
  status: string;
  date: string;
};

export type UserForPermissions = {
  id: string;
  role: string;
};

/**
 * Tournament ownership is resource-scoped. Preserve global roles that already
 * carry equal or greater authority, and promote participant roles only.
 */
export const tournamentCreatorPromotableRoles: readonly UserRole[] = [
  "player",
  "captain",
];

export function tournamentCreatorRoleUpdate(role: UserRole): UserRole | null {
  return tournamentCreatorPromotableRoles.includes(role) ? "organizer" : null;
}

/** True when the user is president/officer of the given host school. */
export const resolveHostSchoolOfficer = cache(
  async (
    hostSchoolId: string | null | undefined,
    userId: string
  ): Promise<boolean> => {
    if (!hostSchoolId) return false;
    const school = await getHostingSchoolForUser(hostSchoolId, userId, false);
    return school != null;
  }
);

/**
 * Sync host check. Pass `isHostSchoolOfficer` / `isTournamentStaff` when already
 * resolved (prefer `resolveIsTournamentOrganizer` on the server).
 */
export function isTournamentOrganizer(
  tournament: Pick<TournamentForPermissions, "organizerId">,
  user: UserForPermissions,
  isHostSchoolOfficer = false,
  isTournamentStaff = false
): boolean {
  return (
    tournament.organizerId === user.id ||
    isAdmin(user) ||
    isHostSchoolOfficer ||
    isTournamentStaff
  );
}

/** True when the user is listed as co-host or staff on the tournament. */
export const resolveIsTournamentStaff = cache(
  async (tournamentId: string, userId: string): Promise<boolean> => {
    const [row] = await db
      .select({ id: tournamentStaff.id })
      .from(tournamentStaff)
      .where(
        and(
          eq(tournamentStaff.tournamentId, tournamentId),
          eq(tournamentStaff.userId, userId)
        )
      )
      .limit(1);
    return row != null;
  }
);

/** Creator, admin, host-school officer, or tournament co-host/staff. */
export async function resolveIsTournamentOrganizer(
  tournament: Pick<TournamentForPermissions, "id" | "organizerId" | "hostSchoolId">,
  user: UserForPermissions
): Promise<boolean> {
  if (tournament.organizerId === user.id || isAdmin(user)) return true;
  if (await resolveIsTournamentStaff(tournament.id, user.id)) return true;
  return resolveHostSchoolOfficer(tournament.hostSchoolId, user.id);
}

/** Owner (`organizerId`) or platform admin may manage the staff roster. */
export function canManageTournamentStaff(
  tournament: Pick<TournamentForPermissions, "organizerId">,
  user: UserForPermissions
): boolean {
  return tournament.organizerId === user.id || isAdmin(user);
}

/** Pool standings, matches, and brackets are host-only until released. */
export async function canViewDivisionPoolPlay(
  tournament: Pick<
    TournamentForPermissions,
    "id" | "organizerId" | "hostSchoolId"
  >,
  user: UserForPermissions,
  poolsReleasedAt: Date | string | null
): Promise<boolean> {
  if (await resolveIsTournamentOrganizer(tournament, user)) return true;
  return poolsReleasedAt != null;
}

/** Draft tournaments are hidden from everyone except the organizer, admins,
 *  host-school members, and tournament staff. Non-draft tournaments are visible
 *  to all authenticated users on the dashboard. */
export function canViewTournament(
  tournament: Pick<
    TournamentForPermissions,
    "status" | "organizerId" | "hostSchoolId"
  >,
  user: UserForPermissions,
  isHostSchoolMember: boolean,
  isTournamentStaff = false
): boolean {
  if (tournament.status !== "draft") return true;
  if (isTournamentOrganizer(tournament, user, false, isTournamentStaff)) {
    return true;
  }
  if (isAdmin(user)) return true;
  return isHostSchoolMember;
}

export async function canManageTournament(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  return resolveIsTournamentOrganizer(tournament, user);
}

/** Non-draft tournaments are visible on public explore. */
export function isTournamentPublishedForPublic(
  tournament: Pick<TournamentForPermissions, "status">
): boolean {
  return tournament.status !== "draft";
}

export function canRegisterTeams(
  tournament: TournamentForPermissions
): boolean {
  if (isTournamentArchived(tournament.date)) return false;
  return tournament.status === "registration_open";
}

export function teamMatchesTournamentGender(
  teamGender: TeamGender,
  tournamentGender: TeamGender
): boolean {
  return teamGender === tournamentGender;
}

export function registrationGenderMismatchMessage(
  tournamentGender: TeamGender
): string {
  return `Only ${TEAM_GENDER_LABELS[tournamentGender]} teams can register for this tournament.`;
}

export async function canEditTournamentSetup(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) return false;
  return !isTournamentArchived(tournament.date);
}

/** User-facing reason when preparation tabs (packet, waiver, email) are read-only. */
export function tournamentPreparationLockedReason(
  tournament: Pick<TournamentForPermissions, "date" | "status">
): string | null {
  if (isTournamentArchived(tournament.date)) {
    return "This tournament is archived. Preparation changes are locked.";
  }
  return null;
}

export async function canEditTournamentPreparation(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  return canEditTournamentSetup(tournament, user);
}

export async function canEditRegistrations(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) return false;
  if (isTournamentArchived(tournament.date)) return false;
  return (
    tournament.status === "registration_open" ||
    tournament.status === "registration_closed"
  );
}

export async function canGeneratePoolsAndBrackets(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) return false;
  if (isTournamentArchived(tournament.date)) return false;
  return tournament.status === "registration_closed";
}

/** Manual pool placement and pool generation require confirmed registrations. */
export async function canAssignTeamsToPools(
  tournament: TournamentForPermissions,
  user: UserForPermissions,
  pendingRegistrationCount: number
): Promise<boolean> {
  if (!(await canGeneratePoolsAndBrackets(tournament, user))) return false;
  return pendingRegistrationCount === 0;
}

export function poolAssignmentBlockedMessage(
  pendingRegistrationCount: number
): string | null {
  if (pendingRegistrationCount > 0) {
    return "Confirm all registered teams before generating matches or brackets.";
  }
  return null;
}

export async function canScheduleMatches(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  return canGeneratePoolsAndBrackets(tournament, user);
}

export async function canScoreMatches(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) return false;
  if (isTournamentArchived(tournament.date)) return false;
  return (
    tournament.status === "in_progress" || tournament.status === "completed"
  );
}

/**
 * Who may run a single match's warmup/start/scorekeeping. The host always can
 * (full control / fallback). Otherwise any member of the assigned ref team can,
 * but only while the tournament is in progress.
 */
export async function canRefereeMatch(
  tournament: Pick<
    TournamentForPermissions,
    "id" | "organizerId" | "hostSchoolId" | "status" | "date"
  >,
  user: UserForPermissions,
  match: { refTeamId: string | null },
  userTeamIds: Iterable<string>
): Promise<boolean> {
  if (isTournamentArchived(tournament.date)) return false;
  if (await resolveIsTournamentOrganizer(tournament, user)) return true;
  if (tournament.status !== "in_progress") return false;
  if (!match.refTeamId) return false;
  const ids =
    userTeamIds instanceof Set ? userTeamIds : new Set(userTeamIds);
  return ids.has(match.refTeamId);
}

export async function canCheckInRegistrations(
  tournament: TournamentForPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) return false;
  if (isTournamentArchived(tournament.date)) return false;
  return tournament.status === "in_progress";
}

export function canWithdrawRegistration(
  tournament: TournamentForPermissions
): boolean {
  if (isTournamentArchived(tournament.date)) return false;
  return tournament.status === "registration_open";
}

export type HostChecklistStep = {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
};

export function hostChecklistSteps(input: {
  status: string;
  description: string | null;
  address: string | null;
  playFormat: PlayFormat | string;
  divisionCount: number;
  courtCount: number;
  registrationCount: number;
  pendingCount: number;
  matchFormat: string;
  setStartingScore: number;
  setTargetScore: number;
  tiebreakTargetScore: number;
  warmupFormat: string;
  poolTiebreakCriteria: readonly string[];
  poolSettingsSavedAt: Date | null;
  bracketCount: number;
  goldTeamCount: number | null;
  silverTeamCount: number | null;
  bracketSettingsSavedAt: Date | null;
  hasPools: boolean;
  hasPoolsReleased: boolean;
  hasSeededBrackets: boolean;
  hasScheduledMatches: boolean;
}): HostChecklistStep[] {
  const {
    status,
    description,
    address,
    playFormat,
    divisionCount,
    courtCount,
    registrationCount,
    pendingCount,
    matchFormat,
    setStartingScore,
    setTargetScore,
    tiebreakTargetScore,
    warmupFormat,
    poolTiebreakCriteria,
    poolSettingsSavedAt,
    bracketCount,
    goldTeamCount,
    silverTeamCount,
    bracketSettingsSavedAt,
    hasPools,
    hasPoolsReleased,
    hasSeededBrackets,
    hasScheduledMatches,
  } = input;

  const isPoolToBracket = playFormat === "pool_to_bracket";

  const poolSettingsInput = {
    matchFormat,
    setStartingScore,
    setTargetScore,
    tiebreakTargetScore,
    warmupFormat,
    poolTiebreakCriteria,
    poolSettingsSavedAt,
    hasPoolMatches: hasPools,
  };

  const bracketSettingsInput = {
    playFormat,
    bracketCount,
    goldTeamCount,
    silverTeamCount,
    bracketSettingsSavedAt,
  };

  const poolSettingsDone = poolSettingsChecklistComplete(poolSettingsInput);
  const bracketSettingsDone =
    bracketSettingsChecklistComplete(bracketSettingsInput);

  const listingCheck = evaluateListingDetailsChecklist({
    description,
    address,
    hasScheduledMatches,
  });

  const steps: HostChecklistStep[] = [
    {
      id: "listing",
      label: "Finalize listing details, fees & start time",
      done: listingCheck.complete,
      hint: listingCheck.complete
        ? undefined
        : listingDetailsHint(listingCheck, hasScheduledMatches),
    },
    {
      id: "setup",
      label: "Add pools and courts",
      done: divisionCount > 0 && courtCount > 0,
      hint: "Setup tab: add pools and courts. Play format was chosen when you created the tournament.",
    },
    {
      id: "open",
      label: "Open registration",
      done: status !== "draft",
      hint: "Set status to Registration open when the listing is ready for teams.",
    },
    {
      id: "confirm",
      label: "Close registration & confirm teams",
      done:
        status !== "draft" &&
        status !== "registration_open" &&
        (registrationCount === 0 || pendingCount === 0),
      hint:
        pendingCount > 0
          ? `${pendingCount} pending approval on the Pending tab`
          : "Approve captains on Pending, then close registration.",
    },
    {
      id: "pool-settings",
      label: "Configure pool settings",
      done: poolSettingsDone,
      hint: poolSettingsDone
        ? undefined
        : poolSettingsChecklistHint(poolSettingsInput),
    },
    {
      id: "pools",
      label: isPoolToBracket
        ? "Assign teams, seed pools & generate matches"
        : "Assign teams & seed the bracket",
      done: hasPools,
      hint: isPoolToBracket
        ? "Teams tab: assign teams to pools. Pools tab: set seed order and save to create round-robin matches."
        : "Teams tab: assign teams. Pools tab: save seed order to build the elimination bracket.",
    },
  ];

  if (isPoolToBracket) {
    steps.push({
      id: "bracket-settings",
      label: "Configure bracket tiers",
      done: bracketSettingsDone,
      hint: bracketSettingsDone
        ? undefined
        : bracketSettingsChecklistHint(bracketSettingsInput),
    });
    steps.push({
      id: "release",
      label: "Release pools to teams",
      done: hasPoolsReleased,
      hint: "Pools tab: release when schedules are ready for captains and fans to view.",
    });
    steps.push({
      id: "bracket",
      label: "Seed brackets from pool play",
      done: hasSeededBrackets,
      hint: "Bracket tab: brackets seed automatically when every pool finishes.",
    });
  } else {
    steps.push({
      id: "bracket",
      label: "Confirm bracket is seeded",
      done: hasSeededBrackets,
      hint: "Bracket tab: teams appear once pool seeding is saved.",
    });
  }

  steps.push(
    {
      id: "schedule",
      label: "Schedule matches",
      done: hasScheduledMatches,
      hint: "Schedule page: assign courts and start times, or set times on the Matches tab.",
    },
    {
      id: "run",
      label: "Run event (live scoring)",
      done: status === "in_progress" || status === "completed",
      hint: "Set status to In progress on event day.",
    }
  );

  return steps;
}
