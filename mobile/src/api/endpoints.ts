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

import type { AuthSuccessContract } from "@/lib/api/contracts/auth";
import type { CreateEntityResultContract } from "@/lib/api/contracts/create";
import type { CreateOptionsContract } from "@/lib/api/contracts/create-options";
import type {
  SchoolDetailContract,
  SchoolJoinResultContract,
  SchoolListContract,
  SchoolMutationResultContract,
  SchoolUpdateResultContract,
  SchoolVerificationSubmitResultContract,
} from "@/lib/api/contracts/school";
import type {
  MatchConsoleContract,
  MatchConsoleMutationResultContract,
} from "@/lib/api/contracts/match-console";
import type { DashboardContract } from "@/lib/api/contracts/dashboard";
import type { GlobalScheduleContract } from "@/lib/api/contracts/global-schedule";
import type { PersonalScheduleContract } from "@/lib/api/contracts/personal-schedule";
import type {
  NotificationsContract,
  NotificationsReadResultContract,
} from "@/lib/api/contracts/notifications";
import type {
  PushTokenRegisterResultContract,
  PushTokenUnregisterResultContract,
} from "@/lib/api/contracts/push-token";
import type {
  TeamDetailContract,
  TeamListContract,
  TeamMutationResultContract,
} from "@/lib/api/contracts/team";
import type {
  TournamentDetailContract,
  TournamentListContract,
  TournamentMatchDetailContract,
  TournamentMatchListContract,
  TournamentPlayContract,
  TournamentTeamListContract,
} from "@/lib/api/contracts/tournament";
import type {
  TournamentHostEntityResultContract,
  TournamentHostBracketResultContract,
  TournamentHostBulkMatchesRequestContract,
  TournamentHostBulkMatchesResultContract,
  TournamentHostBulkMutationResultContract,
  TournamentHostListingResultContract,
  TournamentHostOverviewResultContract,
  TournamentHostStaffContract,
  TournamentHostPoolSeedingResultContract,
  TournamentHostPoolsResultContract,
  TournamentHostRegistrationsResultContract,
  TournamentHostReleaseResultContract,
  TournamentHostScheduleFillPreviewContract,
  TournamentHostScheduleFillResultContract,
  TournamentHostScheduleResultContract,
  TournamentHostScheduleScopeContract,
  TournamentHostSettingsMutationResultContract,
  TournamentHostSetupResultContract,
  TournamentHostWaitlistPromoteResultContract,
  TournamentHostWaiverUploadResultContract,
  TournamentPacketHostContract,
} from "@/lib/api/contracts/tournament-host";
import type {
  TournamentBracketSettingsContract,
  TournamentChatContract,
  TournamentEmailContract,
  TournamentEmailPreviewContract,
  TournamentEmailSendResultContract,
  TournamentPacketContract,
  TournamentParticipationContract,
  TournamentPaymentContract,
  TournamentPaymentSettingsContract,
  TournamentPoolSettingsContract,
  TournamentRegisterOptionsContract,
  TournamentRegisterResultContract,
  TournamentWaiverContract,
  TournamentWaiverSettingsContract,
} from "@/lib/api/contracts/tournament-ops";
import type { ViewerContract } from "@/lib/api/contracts/viewer";
import { apiDownload, apiRequest } from "./client";

/*
 * Response types come from the web project's contract modules, so a change to
 * the wire format shows up as a compile error here rather than as a runtime
 * surprise on a device.
 */

export function fetchCreateOptions(
  signal?: AbortSignal
): Promise<CreateOptionsContract> {
  return apiRequest<CreateOptionsContract>("/api/v1/me/create-options", {
    signal,
  });
}

export function createSchool(body: {
  name: string;
  university: string;
  gender: string;
  region: string;
  description?: string | null;
  websiteUrl?: string | null;
  domainHint?: string | null;
}): Promise<CreateEntityResultContract> {
  return apiRequest<CreateEntityResultContract>("/api/v1/schools", {
    method: "POST",
    body,
  });
}

export function createTeam(body: {
  name: string;
  gender: string;
  region: string;
  schoolId?: string | null;
  university?: string;
}): Promise<CreateEntityResultContract> {
  return apiRequest<CreateEntityResultContract>("/api/v1/teams", {
    method: "POST",
    body,
  });
}

export function createTournament(body: {
  hostSchoolId: string;
  name: string;
  description?: string;
  date: string;
  location: string;
  address?: string;
  playFormat: string;
}): Promise<CreateEntityResultContract> {
  return apiRequest<CreateEntityResultContract>("/api/v1/tournaments", {
    method: "POST",
    body,
  });
}

export function fetchViewer(signal?: AbortSignal): Promise<ViewerContract> {
  return apiRequest<ViewerContract>("/api/v1/me", { signal });
}

export type UpdateProfileBody = {
  fullName: string;
  playerGender?: string | null;
  volleyballPosition?: string | null;
  jerseyNumber?: string | null;
};

export function updateProfile(body: UpdateProfileBody): Promise<ViewerContract> {
  return apiRequest<ViewerContract>("/api/v1/me", {
    method: "PATCH",
    body,
  });
}

export function uploadProfileAvatar(body: {
  base64: string;
  contentType: string;
}): Promise<ViewerContract> {
  return apiRequest<ViewerContract>("/api/v1/me/avatar", {
    method: "POST",
    body,
  });
}

export function removeProfileAvatar(): Promise<ViewerContract> {
  return apiRequest<ViewerContract>("/api/v1/me/avatar", {
    method: "DELETE",
  });
}

export function deleteAccount(body: {
  password: string;
  confirmation: string;
}): Promise<{ success: true }> {
  return apiRequest("/api/v1/me/delete", {
    method: "POST",
    body,
  });
}

export function deleteTeam(
  slug: string,
  confirmationName: string
): Promise<TeamMutationResultContract> {
  return apiRequest<TeamMutationResultContract>(`/api/v1/teams/${slug}`, {
    method: "DELETE",
    body: { confirmationName },
  });
}

export function signUpAccount(body: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthSuccessContract> {
  return apiRequest<AuthSuccessContract>("/api/v1/auth/signup", {
    method: "POST",
    body,
    authenticated: false,
  });
}

export function requestPasswordReset(body: {
  email: string;
  redirectTo: string;
}): Promise<AuthSuccessContract> {
  return apiRequest<AuthSuccessContract>("/api/v1/auth/password-reset", {
    method: "POST",
    body,
    authenticated: false,
  });
}

export function confirmPasswordReset(body: {
  password: string;
  confirmPassword: string;
}): Promise<AuthSuccessContract> {
  return apiRequest<AuthSuccessContract>("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    body,
  });
}

export function changePassword(body: {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}): Promise<{ success: true }> {
  return apiRequest("/api/v1/me/password", {
    method: "POST",
    body,
  });
}

export function fetchDashboard(
  signal?: AbortSignal
): Promise<DashboardContract> {
  return apiRequest<DashboardContract>("/api/v1/dashboard", { signal });
}

export function fetchPersonalSchedule(
  signal?: AbortSignal,
  params?: { limit?: number }
): Promise<PersonalScheduleContract> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  return apiRequest<PersonalScheduleContract>(
    `/api/v1/me/schedule${query ? `?${query}` : ""}`,
    { signal }
  );
}

export function fetchGlobalSchedule(
  signal?: AbortSignal,
  params?: { limit?: number }
): Promise<GlobalScheduleContract> {
  const search = new URLSearchParams();
  if (params?.limit != null) {
    search.set("limit", String(params.limit));
  }
  const query = search.toString();
  return apiRequest<GlobalScheduleContract>(
    `/api/v1/schedule${query ? `?${query}` : ""}`,
    { signal }
  );
}

export type SchoolListParams = {
  q?: string;
  gender?: string;
  region?: string;
  verification?: string;
  limit?: number;
  offset?: number;
};

export function fetchSchools(
  params: SchoolListParams = {},
  signal?: AbortSignal
): Promise<SchoolListContract> {
  return apiRequest<SchoolListContract>("/api/v1/schools", {
    query: params,
    signal,
  });
}

export function fetchSchool(
  slug: string,
  signal?: AbortSignal
): Promise<SchoolDetailContract> {
  return apiRequest<SchoolDetailContract>(
    `/api/v1/schools/${encodeURIComponent(slug)}`,
    { signal }
  );
}

export function updateSchool(
  slug: string,
  body: {
    name?: string;
    university?: string;
    gender?: string;
    region?: string;
    description?: string | null;
    websiteUrl?: string | null;
    domainHint?: string | null;
  }
): Promise<SchoolUpdateResultContract> {
  return apiRequest<SchoolUpdateResultContract>(
    `/api/v1/schools/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      body,
    }
  );
}

export function submitSchoolVerification(
  slug: string
): Promise<SchoolVerificationSubmitResultContract> {
  return apiRequest<SchoolVerificationSubmitResultContract>(
    `/api/v1/schools/${encodeURIComponent(slug)}/verification`,
    {
      method: "POST",
      body: {},
    }
  );
}

export function requestSchoolJoin(
  slug: string
): Promise<SchoolJoinResultContract> {
  return apiRequest(`/api/v1/schools/${encodeURIComponent(slug)}/join`, {
    method: "POST",
    body: {},
  });
}

export function cancelSchoolJoin(slug: string): Promise<{ success: true }> {
  return apiRequest(`/api/v1/schools/${encodeURIComponent(slug)}/join`, {
    method: "DELETE",
  });
}

export function addSchoolMember(
  slug: string,
  body: { email: string; role: "officer" | "member"; title?: string | null }
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members`,
    { method: "POST", body }
  );
}

export function updateSchoolMemberRole(
  slug: string,
  membershipId: string,
  role: "officer" | "member"
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "PATCH", body: { role } }
  );
}

export function updateSchoolMemberPosition(
  slug: string,
  membershipId: string,
  volleyballPosition: string | null
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "PATCH", body: { volleyballPosition } }
  );
}

export function updateSchoolMemberJersey(
  slug: string,
  membershipId: string,
  jerseyNumber: number | null
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "PATCH", body: { jerseyNumber } }
  );
}

export function transferSchoolPresidency(
  slug: string,
  membershipId: string
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}/transfer-presidency`,
    { method: "POST", body: {} }
  );
}

export function removeSchoolMember(
  slug: string,
  membershipId: string
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" }
  );
}

export function leaveSchool(slug: string): Promise<SchoolMutationResultContract> {
  return apiRequest(`/api/v1/schools/${encodeURIComponent(slug)}/leave`, {
    method: "POST",
    body: {},
  });
}

export function resolveSchoolJoinRequest(
  slug: string,
  requestId: string,
  action: "approve" | "reject"
): Promise<SchoolMutationResultContract> {
  return apiRequest(
    `/api/v1/schools/${encodeURIComponent(slug)}/join-requests/${encodeURIComponent(requestId)}`,
    { method: "POST", body: { action } }
  );
}

export function fetchTeams(signal?: AbortSignal): Promise<TeamListContract> {
  return apiRequest<TeamListContract>("/api/v1/teams", { signal });
}

export function fetchTeam(
  slug: string,
  signal?: AbortSignal
): Promise<TeamDetailContract> {
  return apiRequest<TeamDetailContract>(
    `/api/v1/teams/${encodeURIComponent(slug)}`,
    { signal }
  );
}

export function addTeamMember(
  slug: string,
  body: { email?: string; userId?: string; jerseyNumber?: string | null }
): Promise<TeamMutationResultContract> {
  return apiRequest(`/api/v1/teams/${encodeURIComponent(slug)}/members`, {
    method: "POST",
    body,
  });
}

export function removeTeamMember(
  slug: string,
  membershipId: string
): Promise<TeamMutationResultContract> {
  return apiRequest(
    `/api/v1/teams/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "DELETE" }
  );
}

export function updateTeamMemberJersey(
  slug: string,
  membershipId: string,
  jerseyNumber: number | null
): Promise<TeamMutationResultContract> {
  return apiRequest(
    `/api/v1/teams/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "PATCH", body: { jerseyNumber } }
  );
}

export function updateTeamMemberPosition(
  slug: string,
  membershipId: string,
  volleyballPosition: string | null
): Promise<TeamMutationResultContract> {
  return apiRequest(
    `/api/v1/teams/${encodeURIComponent(slug)}/members/${encodeURIComponent(membershipId)}`,
    { method: "PATCH", body: { volleyballPosition } }
  );
}

/**
 * A type alias rather than an interface: only aliases get an implicit index
 * signature, which is what lets this be passed straight through as query params.
 */
export type TournamentListParams = {
  status?: string;
  gender?: string;
  region?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export function fetchTournaments(
  params: TournamentListParams = {},
  signal?: AbortSignal
): Promise<TournamentListContract> {
  return apiRequest<TournamentListContract>("/api/v1/tournaments", {
    query: params,
    // Browsing works before sign-in, matching the public web /explore page.
    authenticated: false,
    signal,
  });
}

function tournamentPath(slug: string, suffix = ""): string {
  return `/api/v1/tournaments/${encodeURIComponent(slug)}${suffix}`;
}

export function fetchTournament(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentDetailContract> {
  return apiRequest<TournamentDetailContract>(tournamentPath(slug), {
    authenticated: false,
    signal,
  });
}

export function fetchTournamentTeams(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentTeamListContract> {
  return apiRequest<TournamentTeamListContract>(tournamentPath(slug, "/teams"), {
    authenticated: false,
    signal,
  });
}

export function fetchTournamentMatches(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentMatchListContract> {
  return apiRequest<TournamentMatchListContract>(
    tournamentPath(slug, "/matches"),
    {
      authenticated: false,
      signal,
    }
  );
}

export function fetchTournamentPlay(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPlayContract> {
  return apiRequest<TournamentPlayContract>(tournamentPath(slug, "/play"), {
    authenticated: false,
    signal,
  });
}

export function fetchTournamentMatch(
  tournamentSlug: string,
  matchSlug: string,
  signal?: AbortSignal
): Promise<TournamentMatchDetailContract> {
  return apiRequest<TournamentMatchDetailContract>(
    tournamentPath(
      tournamentSlug,
      `/matches/${encodeURIComponent(matchSlug)}`
    ),
    {
      authenticated: false,
      signal,
    }
  );
}

export function fetchMatchConsole(
  tournamentSlug: string,
  matchSlug: string,
  signal?: AbortSignal
): Promise<MatchConsoleContract> {
  return apiRequest<MatchConsoleContract>(
    tournamentPath(
      tournamentSlug,
      `/matches/${encodeURIComponent(matchSlug)}/console`
    ),
    { signal }
  );
}

type MatchConsoleAction = "warmup" | "start" | "pause" | "finalize" | "reopen";

export function runMatchConsoleAction(
  tournamentSlug: string,
  matchSlug: string,
  action: MatchConsoleAction,
  body?: { winnerSlug?: string | null }
): Promise<MatchConsoleMutationResultContract> {
  return apiRequest<MatchConsoleMutationResultContract>(
    tournamentPath(
      tournamentSlug,
      `/matches/${encodeURIComponent(matchSlug)}/console`
    ),
    { method: "POST", body: { action, ...body } }
  );
}

export function saveMatchSetScore(
  tournamentSlug: string,
  matchSlug: string,
  setNumber: number,
  teamAScore: number,
  teamBScore: number
): Promise<MatchConsoleMutationResultContract> {
  return apiRequest<MatchConsoleMutationResultContract>(
    tournamentPath(
      tournamentSlug,
      `/matches/${encodeURIComponent(matchSlug)}/sets/${setNumber}`
    ),
    { method: "PUT", body: { teamAScore, teamBScore } }
  );
}

type MatchCrewAction =
  | "claim"
  | "release"
  | "claim_point_keeper"
  | "release_point_keeper";

export function runMatchCrewAction(
  tournamentSlug: string,
  matchSlug: string,
  action: MatchCrewAction,
  body?: { role?: string }
): Promise<MatchConsoleMutationResultContract> {
  return apiRequest<MatchConsoleMutationResultContract>(
    tournamentPath(
      tournamentSlug,
      `/matches/${encodeURIComponent(matchSlug)}/crew`
    ),
    { method: "POST", body: { action, ...body } }
  );
}

export function fetchTournamentParticipation(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentParticipationContract> {
  return apiRequest<TournamentParticipationContract>(
    tournamentPath(slug, "/participation"),
    { signal }
  );
}

export function fetchTournamentRegisterOptions(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentRegisterOptionsContract> {
  return apiRequest<TournamentRegisterOptionsContract>(
    tournamentPath(slug, "/register"),
    { signal }
  );
}

export function submitTournamentRegistration(
  slug: string,
  body: { teamSlugs: string[]; operationId: string }
): Promise<TournamentRegisterResultContract> {
  return apiRequest<TournamentRegisterResultContract>(
    tournamentPath(slug, "/register"),
    { method: "POST", body }
  );
}

export function withdrawTournamentRegistration(
  slug: string,
  teamSlug: string
): Promise<{ withdrawn: true }> {
  return apiRequest<{ withdrawn: true }>(tournamentPath(slug, "/register"), {
    method: "DELETE",
    body: { teamSlug },
  });
}

export function fetchTournamentPacket(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPacketContract> {
  return apiRequest<TournamentPacketContract>(tournamentPath(slug, "/packet"), {
    signal,
  });
}

export function downloadTournamentPacketPdf(
  slug: string,
  signal?: AbortSignal
) {
  return apiDownload(tournamentPath(slug, "/packet/pdf"), { signal });
}

export function fetchTournamentWaiver(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentWaiverContract> {
  return apiRequest<TournamentWaiverContract>(tournamentPath(slug, "/waiver"), {
    signal,
  });
}

export function downloadTournamentWaiverPdf(
  slug: string,
  signal?: AbortSignal
) {
  return apiDownload(tournamentPath(slug, "/waiver/pdf"), { signal });
}

export function downloadRegistrationsCsv(slug: string, signal?: AbortSignal) {
  return apiDownload(tournamentPath(slug, "/host/registrations/export"), {
    signal,
  });
}

export function downloadMyScheduleIcs(signal?: AbortSignal) {
  return apiDownload("/api/v1/me/schedule.ics", { signal });
}

export function acknowledgeTournamentWaiver(
  slug: string,
  body: { teamSlug: string; signedName: string }
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/waiver/acknowledge"), {
    method: "POST",
    body,
  });
}

export function updateTournamentWaiverPlayer(
  slug: string,
  body: { teamSlug: string; userId: string; action: "attest" | "waive" | "clear" }
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/waiver/players"), {
    method: "POST",
    body,
  });
}

export function fetchTournamentPayment(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPaymentContract> {
  return apiRequest<TournamentPaymentContract>(
    tournamentPath(slug, "/payment"),
    { signal }
  );
}

export function submitTournamentPayment(
  slug: string,
  body: { teamSlug: string; method: string; note?: string }
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/payment/submit"), {
    method: "POST",
    body,
  });
}

export function confirmTournamentPayment(
  slug: string,
  teamSlug: string
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/payment/confirm"), {
    method: "POST",
    body: { teamSlug },
  });
}

export function waiveTournamentPayment(
  slug: string,
  teamSlug: string
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/payment/waive"), {
    method: "POST",
    body: { teamSlug },
  });
}

export function fetchTournamentChat(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentChatContract> {
  return apiRequest<TournamentChatContract>(tournamentPath(slug, "/chat"), {
    signal,
  });
}

export function postTournamentChatMessage(
  slug: string,
  body: { channelKind: string; body: string; teamSlug?: string }
): Promise<{ success: true; messageId: string }> {
  return apiRequest(tournamentPath(slug, "/chat/messages"), {
    method: "POST",
    body,
  });
}

export function markTournamentChatRead(
  slug: string,
  channelKind: string
): Promise<{ success: true }> {
  return apiRequest(tournamentPath(slug, "/chat/read"), {
    method: "POST",
    body: { channelKind },
  });
}

export function fetchTournamentEmail(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentEmailContract> {
  return apiRequest<TournamentEmailContract>(tournamentPath(slug, "/email"), {
    signal,
  });
}

export function previewTournamentEmail(
  slug: string,
  audience: string
): Promise<TournamentEmailPreviewContract> {
  return apiRequest(tournamentPath(slug, "/email/preview"), {
    method: "POST",
    body: { audience },
  });
}

export function sendTournamentEmail(
  slug: string,
  body: { audience: string; subject: string; body: string }
): Promise<TournamentEmailSendResultContract> {
  return apiRequest(tournamentPath(slug, "/email"), {
    method: "POST",
    body,
  });
}

export function sendTournamentWaiverReminder(
  slug: string
): Promise<TournamentEmailSendResultContract> {
  return apiRequest(tournamentPath(slug, "/email/waiver-reminder"), {
    method: "POST",
    body: {},
  });
}

export function fetchTournamentPoolSettings(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPoolSettingsContract> {
  return apiRequest<TournamentPoolSettingsContract>(
    tournamentPath(slug, "/settings/pool"),
    { signal }
  );
}

export function updateTournamentPoolSettings(
  slug: string,
  body: TournamentPoolSettingsContract
): Promise<TournamentPoolSettingsContract> {
  return apiRequest(tournamentPath(slug, "/settings/pool"), {
    method: "POST",
    body: {
      matchFormat: body.matchFormat,
      setStartingScore: body.setStartingScore,
      setTargetScore: body.setTargetScore,
      tiebreakTargetScore: body.tiebreakTargetScore,
      warmupFormat: body.warmupFormat,
      poolTiebreakCriteria: body.poolTiebreakCriteria,
    },
  });
}

export function fetchTournamentBracketSettings(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentBracketSettingsContract> {
  return apiRequest<TournamentBracketSettingsContract>(
    tournamentPath(slug, "/settings/bracket"),
    { signal }
  );
}

export function updateTournamentBracketSettings(
  slug: string,
  body: {
    bracketCount: number;
    goldTeamCount: number | null;
    silverTeamCount: number | null;
  }
): Promise<TournamentBracketSettingsContract> {
  return apiRequest(tournamentPath(slug, "/settings/bracket"), {
    method: "POST",
    body,
  });
}

export function fetchTournamentHostPaymentSettings(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPaymentSettingsContract> {
  return apiRequest<TournamentPaymentSettingsContract>(
    tournamentPath(slug, "/host/payment/settings"),
    { signal }
  );
}

export function updateTournamentHostPaymentSettings(
  slug: string,
  body: {
    enabled: boolean;
    requiredBeforeConfirm: boolean;
    firstTeamFeeCents: number | null;
    additionalTeamFeeCents: number | null;
    venmoHandle: string;
    zelleHandle: string;
    cashappHandle: string;
    otherInstructions: string;
  }
): Promise<TournamentHostSettingsMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/payment/settings"), {
    method: "PATCH",
    body,
  });
}

export function updateTournamentHostWaiverSettings(
  slug: string,
  body: TournamentWaiverSettingsContract
): Promise<TournamentHostSettingsMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/waiver/settings"), {
    method: "PATCH",
    body: {
      enabled: body.enabled,
      allowDownloadPrint: body.allowDownloadPrint,
      allowThirdParty: body.allowThirdParty,
      allowDigitalAck: body.allowDigitalAck,
      // The server validates any non-empty URL, even when third-party signing is off.
      thirdPartyUrl: body.allowThirdParty ? (body.thirdPartyUrl ?? "") : "",
      requiredBeforeCheckIn: body.requiredBeforeCheckIn,
    },
  });
}

export function uploadTournamentHostWaiverPdf(
  slug: string,
  body: { base64: string; fileName?: string }
): Promise<TournamentHostWaiverUploadResultContract> {
  return apiRequest(tournamentPath(slug, "/host/waiver/pdf"), {
    method: "POST",
    body,
  });
}

export function fetchTournamentHostPacket(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentPacketHostContract> {
  return apiRequest<TournamentPacketHostContract>(
    tournamentPath(slug, "/host/packet"),
    { signal }
  );
}

export function updateTournamentHostPacket(
  slug: string,
  body: { notes?: string; accentColor?: string | null }
): Promise<TournamentPacketHostContract> {
  return apiRequest(tournamentPath(slug, "/host/packet"), {
    method: "PATCH",
    body,
  });
}

export function fetchTournamentHostOverview(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostOverviewResultContract> {
  return apiRequest<TournamentHostOverviewResultContract>(
    tournamentPath(slug, "/host"),
    { signal }
  );
}

export function updateTournamentHostStatus(
  slug: string,
  status: string
): Promise<TournamentHostOverviewResultContract> {
  return apiRequest(tournamentPath(slug, "/host"), {
    method: "PATCH",
    body: { status },
  });
}

export function updateTournamentHostDate(
  slug: string,
  date: string
): Promise<TournamentHostOverviewResultContract> {
  return apiRequest(tournamentPath(slug, "/host"), {
    method: "PATCH",
    body: { date },
  });
}

export function fetchTournamentHostSetup(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostSetupResultContract> {
  return apiRequest<TournamentHostSetupResultContract>(
    tournamentPath(slug, "/host/setup"),
    { signal }
  );
}

export function updateTournamentHostRegistrationAvailability(
  slug: string,
  body: { capacity: number | null; deadline: string | null }
): Promise<TournamentHostSetupResultContract> {
  return apiRequest(tournamentPath(slug, "/host/setup/registration"), {
    method: "PATCH",
    body,
  });
}

export function addTournamentHostDivision(
  slug: string,
  name: string
): Promise<TournamentHostEntityResultContract> {
  return apiRequest(tournamentPath(slug, "/host/divisions"), {
    method: "POST",
    body: { name },
  });
}

export function removeTournamentHostDivision(
  slug: string,
  divisionId: string
): Promise<TournamentHostSetupResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/divisions/${divisionId}`),
    { method: "DELETE" }
  );
}

export function addTournamentHostCourt(
  slug: string,
  name: string
): Promise<TournamentHostEntityResultContract> {
  return apiRequest(tournamentPath(slug, "/host/courts"), {
    method: "POST",
    body: { name },
  });
}

export function removeTournamentHostCourt(
  slug: string,
  courtId: string
): Promise<TournamentHostSetupResultContract> {
  return apiRequest(tournamentPath(slug, `/host/courts/${courtId}`), {
    method: "DELETE",
  });
}

export function setTournamentHostDivisionCourts(
  slug: string,
  divisionId: string,
  courtIds: string[]
): Promise<TournamentHostSetupResultContract> {
  return apiRequest(tournamentPath(slug, `/host/divisions/${divisionId}`), {
    method: "PATCH",
    body: { courtIds },
  });
}

export function fetchTournamentHostRegistrations(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostRegistrationsResultContract> {
  return apiRequest<TournamentHostRegistrationsResultContract>(
    tournamentPath(slug, "/host/registrations"),
    { signal }
  );
}

export function updateTournamentHostRegistration(
  slug: string,
  registrationId: string,
  body: { status?: string; divisionId?: string | null }
): Promise<TournamentHostRegistrationsResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/registrations/${registrationId}`),
    { method: "PATCH", body }
  );
}

export function confirmTournamentHostRegistrations(
  slug: string,
  registrationIds: string[]
): Promise<TournamentHostBulkMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/registrations/confirm"), {
    method: "POST",
    body: { registrationIds },
  });
}

export function checkInTournamentHostRegistrations(
  slug: string,
  registrationIds: string[]
): Promise<TournamentHostBulkMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/registrations/check-in"), {
    method: "POST",
    body: { registrationIds },
  });
}

export function removeTournamentHostRegistrations(
  slug: string,
  registrationIds: string[]
): Promise<TournamentHostBulkMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/registrations/bulk"), {
    method: "DELETE",
    body: { registrationIds },
  });
}

export function bulkAssignTournamentHostRegistrations(
  slug: string,
  registrationIds: string[],
  divisionId: string | null
): Promise<TournamentHostBulkMutationResultContract> {
  return apiRequest(tournamentPath(slug, "/host/registrations/bulk-division"), {
    method: "POST",
    body: { registrationIds, divisionId },
  });
}

export function promoteTournamentHostWaitlist(
  slug: string,
  operationId: string
): Promise<TournamentHostWaitlistPromoteResultContract> {
  return apiRequest(tournamentPath(slug, "/host/waitlist/promote"), {
    method: "POST",
    body: { operationId },
  });
}

export function removeTournamentHostWaitlistEntry(
  slug: string,
  entryId: string
): Promise<TournamentHostRegistrationsResultContract> {
  return apiRequest(tournamentPath(slug, `/host/waitlist/${entryId}`), {
    method: "DELETE",
  });
}

export function fetchTournamentHostPools(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostPoolsResultContract> {
  return apiRequest<TournamentHostPoolsResultContract>(
    tournamentPath(slug, "/host/pools"),
    { signal }
  );
}

export function updateTournamentHostPoolSeeding(
  slug: string,
  poolId: string,
  teamIds: string[]
): Promise<TournamentHostPoolSeedingResultContract> {
  return apiRequest(tournamentPath(slug, `/host/pools/${poolId}/seeding`), {
    method: "POST",
    body: { teamIds },
  });
}

export function releaseTournamentHostDivisionPools(
  slug: string,
  divisionId: string
): Promise<TournamentHostReleaseResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/divisions/${divisionId}/release`),
    { method: "POST", body: {} }
  );
}

export function fetchTournamentHostBrackets(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostBracketResultContract> {
  return apiRequest<TournamentHostBracketResultContract>(
    tournamentPath(slug, "/host/brackets"),
    { signal }
  );
}

export function regenerateTournamentHostBrackets(
  slug: string
): Promise<TournamentHostBracketResultContract> {
  return apiRequest(tournamentPath(slug, "/host/brackets/regenerate"), {
    method: "POST",
    body: {},
  });
}

export function fetchTournamentHostSchedule(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostScheduleResultContract> {
  return apiRequest<TournamentHostScheduleResultContract>(
    tournamentPath(slug, "/host/schedule"),
    { signal }
  );
}

export function updateTournamentHostMatchSchedule(
  slug: string,
  matchId: string,
  scheduledTime: string | null
): Promise<TournamentHostScheduleResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/matches/${matchId}/schedule`),
    { method: "PATCH", body: { scheduledTime } }
  );
}

export function updateTournamentHostMatchRef(
  slug: string,
  matchId: string,
  refTeamId: string | null
): Promise<TournamentHostScheduleResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/matches/${matchId}/ref`),
    { method: "PATCH", body: { refTeamId } }
  );
}

export function updateTournamentHostMatchCourt(
  slug: string,
  matchId: string,
  courtId: string | null
): Promise<TournamentHostScheduleResultContract> {
  return apiRequest(
    tournamentPath(slug, `/host/matches/${matchId}/court`),
    { method: "PATCH", body: { courtId } }
  );
}

export function updateTournamentHostListing(
  slug: string,
  body: { name: string; description: string; location: string; address: string }
): Promise<TournamentHostListingResultContract> {
  return apiRequest(tournamentPath(slug, "/host/listing"), {
    method: "PATCH",
    body,
  });
}

export function duplicateTournament(slug: string): Promise<{ slug: string }> {
  return apiRequest(tournamentPath(slug, "/host/duplicate"), { method: "POST" });
}

export function deleteTournament(
  slug: string,
  confirmationName: string
): Promise<{ deleted: true }> {
  return apiRequest(tournamentPath(slug, "/host"), {
    method: "DELETE",
    body: { confirmationName },
  });
}

export function fetchTournamentHostStaff(
  slug: string,
  signal?: AbortSignal
): Promise<TournamentHostStaffContract> {
  return apiRequest(tournamentPath(slug, "/host/staff"), { signal });
}

export function addTournamentHostStaff(
  slug: string,
  body: { email: string; role: "co_host" | "staff" }
): Promise<TournamentHostStaffContract> {
  return apiRequest(tournamentPath(slug, "/host/staff"), { method: "POST", body });
}

export function removeTournamentHostStaff(
  slug: string,
  userId: string
): Promise<TournamentHostStaffContract> {
  return apiRequest(tournamentPath(slug, "/host/staff"), {
    method: "DELETE",
    body: { userId },
  });
}

export function bulkUpdateTournamentHostMatches(
  slug: string,
  body: TournamentHostBulkMatchesRequestContract
): Promise<TournamentHostBulkMatchesResultContract> {
  return apiRequest(tournamentPath(slug, "/host/matches/bulk"), {
    method: "POST",
    body,
  });
}

export function previewTournamentHostScheduleFill(
  slug: string,
  body: {
    scope: TournamentHostScheduleScopeContract;
    firstStartIso: string;
    intervalMinutes: number;
    overwrite: boolean;
  }
): Promise<TournamentHostScheduleFillPreviewContract> {
  return apiRequest(tournamentPath(slug, "/host/schedule/fill"), {
    method: "POST",
    body: { ...body, preview: true },
  });
}

export function applyTournamentHostScheduleFill(
  slug: string,
  body: {
    scope: TournamentHostScheduleScopeContract;
    firstStartIso: string;
    intervalMinutes: number;
    overwrite: boolean;
  }
): Promise<TournamentHostScheduleFillResultContract> {
  return apiRequest(tournamentPath(slug, "/host/schedule/fill"), {
    method: "POST",
    body: { ...body, preview: false },
  });
}

export function fetchNotifications(
  options?: { limit?: number; signal?: AbortSignal }
): Promise<NotificationsContract> {
  return apiRequest<NotificationsContract>("/api/v1/notifications", {
    signal: options?.signal,
    query: options?.limit ? { limit: options.limit } : undefined,
  });
}

export function markNotificationsRead(
  ids?: string[]
): Promise<NotificationsReadResultContract> {
  return apiRequest("/api/v1/notifications/read", {
    method: "POST",
    body: ids ? { ids } : {},
  });
}

export function registerPushToken(body: {
  token: string;
  platform: string;
  deviceName?: string | null;
}): Promise<PushTokenRegisterResultContract> {
  return apiRequest("/api/v1/me/push-token", {
    method: "POST",
    body,
  });
}

export function unregisterPushToken(
  token: string
): Promise<PushTokenUnregisterResultContract> {
  return apiRequest("/api/v1/me/push-token", {
    method: "DELETE",
    body: { token },
  });
}
