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

import type {
  RegistrationPaymentMethod,
  RegistrationPaymentStatus,
  TournamentChatChannelKind,
} from "@/types";

/** Which authenticated tournament surfaces the viewer may open. */
export interface TournamentAccessContract {
  packet: boolean;
  waiver: boolean;
  payment: boolean;
  email: boolean;
  chat: boolean;
}

export interface TournamentSpeakingTeamContract {
  slug: string;
  name: string;
}

/** Viewer's teams already entered (or waitlisted) for this tournament. */
export interface TournamentMyTeamContract {
  slug: string;
  name: string;
  status: "pending" | "confirmed" | "checked_in" | "waitlisted";
}

export interface TournamentParticipationContract {
  isOrganizer: boolean;
  access: TournamentAccessContract;
  speakingTeams: TournamentSpeakingTeamContract[];
  /** Teams the viewer belongs to that are registered or waitlisted here. */
  myTeams: TournamentMyTeamContract[];
  /**
   * True when registration is open and the viewer still has at least one
   * eligible captain team that is not already entered or waitlisted.
   */
  canRegister: boolean;
}

export interface TournamentRegisterTeamOptionContract {
  slug: string;
  name: string;
  university: string;
}

export interface TournamentRegisterOptionsContract {
  registrationOpen: boolean;
  closedReason: string | null;
  genderLabel: string;
  emptyMessage: string | null;
  eligibleTeams: TournamentRegisterTeamOptionContract[];
  myTeams: TournamentMyTeamContract[];
  availability: {
    capacity: number | null;
    deadline: string | null;
    registeredCount: number;
    waitlistCount: number;
  };
}

export interface TournamentRegisterResultContract {
  acceptedCount: number;
  waitlistedCount: number;
}

export interface TournamentPoolSettingsContract {
  matchFormat: "play_all_3" | "best_of_2" | "two_with_tiebreak";
  setStartingScore: number;
  setTargetScore: number;
  tiebreakTargetScore: number;
  warmupFormat: "none" | "three_three_one";
  poolTiebreakCriteria: Array<
    "match_record" | "set_record" | "point_diff" | "head_to_head"
  >;
  poolSettingsSavedAt: string | null;
}

export interface TournamentBracketSettingsContract {
  bracketCount: number;
  goldTeamCount: number | null;
  silverTeamCount: number | null;
  totalBracketTeams: number;
  locked: boolean;
  canRegenerate: boolean;
  regenerateBlockedReason: string | null;
  hasPoolToBracket: boolean;
  bracketSettingsSavedAt: string | null;
}

export interface TournamentPacketContract {
  notes: string | null;
  canDownload: boolean;
}

export interface TournamentWaiverSettingsContract {
  enabled: boolean;
  allowDownloadPrint: boolean;
  allowThirdParty: boolean;
  allowDigitalAck: boolean;
  thirdPartyUrl: string | null;
  requiredBeforeCheckIn: boolean;
}

export interface TournamentWaiverRosterMemberContract {
  userId: string;
  fullName: string;
  role: string;
  completed: boolean;
  method: "digital" | "captain_attested" | "host_override" | null;
  completedAt: string | null;
  isViewer: boolean;
}

export interface TournamentWaiverTeamContract {
  teamSlug: string;
  teamName: string;
  isCaptain: boolean;
  completedCount: number;
  totalCount: number;
  complete: boolean;
  roster: TournamentWaiverRosterMemberContract[];
}

export interface TournamentWaiverContract {
  isOrganizer: boolean;
  settings: TournamentWaiverSettingsContract;
  hasPdf: boolean;
  version: number | null;
  fileName: string | null;
  teams: TournamentWaiverTeamContract[];
}

export interface TournamentPaymentSettingsContract {
  enabled: boolean;
  requiredBeforeConfirm: boolean;
  firstTeamFeeCents: number | null;
  additionalTeamFeeCents: number | null;
  venmoHandle: string | null;
  zelleHandle: string | null;
  cashappHandle: string | null;
  otherInstructions: string | null;
  instructionsText: string | null;
}

export interface TournamentPaymentTeamContract {
  teamSlug: string;
  teamName: string;
  isCaptain: boolean;
  amountCents: number;
  status: RegistrationPaymentStatus;
  submittedMethod: RegistrationPaymentMethod | null;
  submittedNote: string | null;
  submittedAt: string | null;
}

export interface TournamentPaymentContract {
  isOrganizer: boolean;
  settings: TournamentPaymentSettingsContract;
  teams: TournamentPaymentTeamContract[];
}

export interface TournamentChatMessageContract {
  id: string;
  authorUserId: string;
  authorName: string;
  teamName: string | null;
  body: string;
  createdAt: string;
  isOrganizerMessage: boolean;
  isOwn: boolean;
}

export interface TournamentChatChannelContract {
  kind: TournamentChatChannelKind;
  label: string;
  description: string;
  canPost: boolean;
  unreadCount: number;
  messages: TournamentChatMessageContract[];
}

export type ChatReportReasonContract =
  | "spam"
  | "harassment"
  | "inappropriate"
  | "other";

export interface BlockedUserContract {
  userId: string;
  fullName: string;
  blockedAt: string;
}

export interface TournamentChatContract {
  tournamentId: string;
  canPost: boolean;
  speakingTeams: TournamentSpeakingTeamContract[];
  channels: TournamentChatChannelContract[];
}

export type TournamentEmailAudienceContract =
  | "captains_confirmed"
  | "captains_all"
  | "captains_pending"
  | "captains_waiver_incomplete";

export interface TournamentEmailHistoryContract {
  id: string;
  kind: string;
  audience: string;
  subject: string;
  recipientCount: number;
  skippedNoCaptainCount: number;
  sentAt: string;
}

export interface TournamentEmailContract {
  canSend: boolean;
  lockedReason: string | null;
  waiverEnabled: boolean;
  history: TournamentEmailHistoryContract[];
}

export interface TournamentEmailPreviewContract {
  recipientCount: number;
  skippedNoCaptainCount: number;
  skippedNoCaptainTeamNames: string[];
  audienceLabel: string;
}

export interface TournamentEmailSendResultContract {
  recipientCount: number;
  skippedNoCaptainCount: number;
}
