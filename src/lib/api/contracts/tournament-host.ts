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

import type { TournamentStatus } from "@/types";
import type { TournamentBracketSettingsContract } from "./tournament-ops";

export interface TournamentHostChecklistStepContract {
  id: string;
  label: string;
  done: boolean;
  hint?: string;
}

export interface TournamentHostOverviewContract {
  slug: string;
  name: string;
  status: TournamentStatus;
  date: string;
  isArchived: boolean;
  playFormat: string;
  canEditSetup: boolean;
  canEditRegistrations: boolean;
  canCheckIn: boolean;
  canAssignPools: boolean;
  canSchedule: boolean;
  preparationLockedReason: string | null;
  checklist: TournamentHostChecklistStepContract[];
  counts: {
    divisionCount: number;
    courtCount: number;
    registrationCount: number;
    pendingCount: number;
    confirmedCount: number;
    checkedInCount: number;
    waitlistCount: number;
  };
  sections: {
    setup: boolean;
    registrations: boolean;
    pending: boolean;
    pools: boolean;
    bracket: boolean;
    schedule: boolean;
    poolSettings: boolean;
    bracketSettings: boolean;
  };
}

export interface TournamentHostDivisionContract {
  id: string;
  name: string;
  format: string;
  poolsReleasedAt: string | null;
  courtIds: string[];
}

export interface TournamentHostCourtContract {
  id: string;
  name: string;
  divisionIds: string[];
}

export interface TournamentHostSetupContract {
  playFormat: string;
  registrationCapacity: number | null;
  registrationDeadline: string | null;
  registeredCount: number;
  canEdit: boolean;
  preparationLockedReason: string | null;
  divisions: TournamentHostDivisionContract[];
  courts: TournamentHostCourtContract[];
}

export interface TournamentHostOverviewResultContract {
  success: true;
  overview: TournamentHostOverviewContract;
}

export interface TournamentHostSetupResultContract {
  success: true;
  setup: TournamentHostSetupContract;
}

export interface TournamentHostEntityResultContract {
  success: true;
  id: string;
  setup: TournamentHostSetupContract;
}

export interface TournamentHostSettingsMutationResultContract {
  success: true;
}

export interface TournamentHostWaiverUploadResultContract {
  success: true;
  waiver: {
    id: string;
    fileName: string;
    version: number;
    uploadedAt: string;
  };
}

export interface TournamentPacketHostContract {
  notes: string | null;
  accentColor: string | null;
  canEdit: boolean;
  lockedReason: string | null;
}

export type TournamentHostRegistrationStatus =
  | "pending"
  | "confirmed"
  | "checked_in";

export interface TournamentHostDivisionOptionContract {
  id: string;
  name: string;
}

export interface TournamentHostWaiverSummaryContract {
  complete: boolean;
  completedCount: number;
  totalCount: number;
  blocksCheckIn: boolean;
}

export interface TournamentHostPaymentSummaryContract {
  status: string;
  amountCents: number;
  blocksConfirm: boolean;
}

export interface TournamentHostRegistrationContract {
  id: string;
  status: TournamentHostRegistrationStatus;
  registeredAt: string;
  teamId: string;
  teamSlug: string;
  teamName: string;
  schoolName: string | null;
  divisionId: string | null;
  divisionName: string | null;
  waiver: TournamentHostWaiverSummaryContract | null;
  payment: TournamentHostPaymentSummaryContract | null;
}

export interface TournamentHostWaitlistEntryContract {
  id: string;
  queueRank: number;
  teamName: string;
  schoolName: string;
  requestedAt: string;
  eligible: boolean;
}

export interface TournamentHostRegistrationsContract {
  canManage: boolean;
  canCheckIn: boolean;
  waiverEnabled: boolean;
  waiverRequiredBeforeCheckIn: boolean;
  paymentEnabled: boolean;
  divisions: TournamentHostDivisionOptionContract[];
  registrations: TournamentHostRegistrationContract[];
  waitlist: TournamentHostWaitlistEntryContract[];
}

export interface TournamentHostRegistrationsResultContract {
  success: true;
  registrations: TournamentHostRegistrationsContract;
}

export interface TournamentHostBulkMutationResultContract {
  success: true;
  count: number;
  registrations: TournamentHostRegistrationsContract;
}

export interface TournamentHostWaitlistPromoteResultContract {
  success: true;
  teamId: string;
  registrations: TournamentHostRegistrationsContract;
}

export interface TournamentHostPoolTeamContract {
  id: string;
  name: string;
  university: string;
  seed: number | null;
}

export interface TournamentHostPoolContract {
  id: string;
  name: string;
  teams: TournamentHostPoolTeamContract[];
  matchCount: number;
  completedMatchCount: number;
  matchesStarted: boolean;
}

export interface TournamentHostDivisionPoolsContract {
  id: string;
  name: string;
  format: string;
  poolsReleasedAt: string | null;
  pools: TournamentHostPoolContract[];
  matchCount: number;
  completedMatchCount: number;
}

export interface TournamentHostPoolsContract {
  canAssignPools: boolean;
  poolAssignmentBlocked: string | null;
  divisions: TournamentHostDivisionPoolsContract[];
}

export interface TournamentHostPoolsResultContract {
  success: true;
  pools: TournamentHostPoolsContract;
}

export interface TournamentHostPoolSeedingResultContract {
  success: true;
  matchCount: number;
  pools: TournamentHostPoolsContract;
}

export interface TournamentHostReleaseResultContract {
  success: true;
  alreadyReleased: boolean;
  pools: TournamentHostPoolsContract;
}

export interface TournamentHostBracketResultContract {
  success: true;
  settings: TournamentBracketSettingsContract;
}

export type TournamentHostScheduleScopeContract =
  | { type: "division-pools"; divisionId: string }
  | { type: "bracket"; bracketId: string };

export interface TournamentHostScheduleMatchContract {
  id: string;
  slug: string;
  groupName: string;
  status: string;
  scheduledTime: string | null;
  courtId: string | null;
  courtName: string | null;
  teamAName: string | null;
  teamBName: string | null;
  label: string;
  isBye: boolean;
  refTeamId: string | null;
  refTeamName: string | null;
  canAssignCourt: boolean;
  refOptions: { id: string; name: string }[];
}

export interface TournamentHostScheduleGroupContract {
  id: string;
  label: string;
  scope: TournamentHostScheduleScopeContract;
  scheduledCount: number;
  totalCount: number;
  matches: TournamentHostScheduleMatchContract[];
}

export interface TournamentHostScheduleContract {
  date: string;
  canSchedule: boolean;
  courts: { id: string; name: string }[];
  groups: TournamentHostScheduleGroupContract[];
}

export interface TournamentHostScheduleResultContract {
  success: true;
  schedule: TournamentHostScheduleContract;
}

export interface TournamentHostScheduleFillPreviewRowContract {
  matchId: string;
  label: string;
  groupName: string;
  proposedTime: string;
  kind: "apply" | "keep" | "locked";
  note: string | null;
}

export interface TournamentHostScheduleFillPreviewContract {
  success: true;
  applyCount: number;
  rows: TournamentHostScheduleFillPreviewRowContract[];
}

export interface TournamentHostScheduleFillResultContract {
  success: true;
  updated: number;
  schedule: TournamentHostScheduleContract;
}

export type TournamentHostBulkMatchAction =
  | "reassign_court"
  | "shift_time"
  | "reassign_ref"
  | "clear_schedule";

export interface TournamentHostBulkMatchesRequestContract {
  action: TournamentHostBulkMatchAction;
  matchIds?: string[];
  courtId?: string | null;
  minutes?: number;
  afterIso?: string | null;
  refTeamId?: string | null;
  clearTime?: boolean;
  clearCourt?: boolean;
}

export interface TournamentHostBulkMatchesResultContract {
  success: true;
  action: TournamentHostBulkMatchAction;
  updatedCount: number;
  skippedCount: number;
  message: string;
  schedule: TournamentHostScheduleContract;
}

