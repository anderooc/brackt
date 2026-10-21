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

import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  registrations,
  schools,
  teamMembers,
  teams,
  tournamentEmailSends,
  tournaments,
} from "@/lib/db/schema";
import { formatTeamGender } from "@/lib/labels/team";
import { loadBlockedUserIds } from "@/lib/tournaments/chat-moderation";
import {
  canPostInChatChannel,
  canPostInTournamentChat,
  ensureTournamentChatChannels,
  getUserEligibleSpeakingTeams,
  TOURNAMENT_CHAT_CHANNEL_DESCRIPTIONS,
  TOURNAMENT_CHAT_CHANNEL_LABELS,
  userCanViewTournamentChat,
  type EligibleSpeakingTeam,
} from "@/lib/tournaments/chat-access";
import {
  getTournamentChatUnreadCounts,
  loadRecentChatMessages,
} from "@/lib/tournaments/chat-unread";
import { userCanDownloadTournamentPacket } from "@/lib/tournaments/packet-access";
import { getPaymentsByRegistrationIds } from "@/lib/tournaments/payment-compliance";
import {
  paymentInstructionsText,
  paymentSettingsFromTournament,
} from "@/lib/tournaments/payment-settings";
import { userCanAccessTournamentPayment } from "@/lib/tournaments/payment-access";
import {
  canEditTournamentPreparation,
  canRegisterTeams,
  resolveIsTournamentOrganizer,
  tournamentPreparationLockedReason,
} from "@/lib/tournaments/permissions";
import { loadApplicantWaitlistState } from "@/lib/tournaments/applicant-waitlist";
import { registrationAvailabilityOpen } from "@/lib/tournaments/public-refresh-policy";
import { teamEligibleForTournamentRegistrationFilter } from "@/lib/tournaments/registration-eligibility";
import { waitingTeamIdsForTournament } from "@/lib/tournaments/registrations";
import {
  getLatestTournamentWaiver,
  getTeamWaiverCompliance,
} from "@/lib/tournaments/waiver-compliance";
import {
  userCanAccessTournamentWaiver,
  waiverSettingsFromTournament,
} from "@/lib/tournaments/waiver-access";
import type {
  TournamentChatContract,
  TournamentEmailContract,
  TournamentMyTeamContract,
  TournamentPacketContract,
  TournamentParticipationContract,
  TournamentPaymentContract,
  TournamentRegisterOptionsContract,
  TournamentSpeakingTeamContract,
  TournamentWaiverContract,
} from "../contracts/tournament-ops";
import { forbidden, notFound } from "../errors";

const ACTIVE_REGISTRATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
] as const;

export type PostedTournamentRow = typeof tournaments.$inferSelect;

export async function loadPostedTournamentBySlug(
  slug: string
): Promise<PostedTournamentRow | null> {
  const [row] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1);
  return row ?? null;
}

export async function loadViewerTeamMembership(userId: string): Promise<{
  teamIds: string[];
  captainTeamIds: Set<string>;
  teamById: Map<string, { id: string; slug: string; name: string }>;
}> {
  const rows = await db
    .select({
      teamId: teamMembers.teamId,
      role: teamMembers.role,
      slug: teams.slug,
      name: teams.name,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(eq(teamMembers.userId, userId));

  const teamIds = rows.map((row) => row.teamId);
  const captainTeamIds = new Set(
    rows.filter((row) => row.role === "captain").map((row) => row.teamId)
  );
  const teamById = new Map(
    rows.map((row) => [
      row.teamId,
      { id: row.teamId, slug: row.slug, name: row.name },
    ])
  );

  return { teamIds, captainTeamIds, teamById };
}

export async function requirePostedTournament(
  slug: string
): Promise<PostedTournamentRow> {
  const tournament = await loadPostedTournamentBySlug(slug);
  if (!tournament) throw notFound("Tournament not found.");
  return tournament;
}

async function speakingTeamsContract(
  eligibleTeams: EligibleSpeakingTeam[],
  teamById: Map<string, { slug: string; name: string }>
): Promise<TournamentSpeakingTeamContract[]> {
  const missingIds = eligibleTeams
    .map((team) => team.teamId)
    .filter((id) => !teamById.has(id));
  const extras =
    missingIds.length === 0
      ? []
      : await db
          .select({ id: teams.id, slug: teams.slug, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, missingIds));
  const lookup = new Map(teamById);
  for (const row of extras) {
    lookup.set(row.id, { slug: row.slug, name: row.name });
  }

  return eligibleTeams
    .map((team) => {
      const meta = lookup.get(team.teamId);
      return {
        slug: meta?.slug ?? team.teamId,
        name: meta?.name ?? team.teamName,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadViewerTournamentTeams(
  tournamentId: string,
  userId: string,
  membershipTeamIds: string[]
): Promise<TournamentMyTeamContract[]> {
  if (membershipTeamIds.length === 0) return [];

  const [registrationRows, waitlistState] = await Promise.all([
    db
      .select({
        teamId: registrations.teamId,
        status: registrations.status,
        slug: teams.slug,
        name: teams.name,
      })
      .from(registrations)
      .innerJoin(teams, eq(teams.id, registrations.teamId))
      .where(
        and(
          eq(registrations.tournamentId, tournamentId),
          inArray(registrations.teamId, membershipTeamIds),
          inArray(registrations.status, [...ACTIVE_REGISTRATION_STATUSES])
        )
      ),
    loadApplicantWaitlistState({ tournamentId, userId }),
  ]);

  const registeredIds = new Set(registrationRows.map((row) => row.teamId));
  const myTeams: TournamentMyTeamContract[] = registrationRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    status: row.status as TournamentMyTeamContract["status"],
  }));

  const waitlistedIds = waitlistState.applicantWaitlistRows
    .map((row) => row.teamId)
    .filter((teamId) => !registeredIds.has(teamId));

  if (waitlistedIds.length > 0) {
    const waitlistedTeams = await db
      .select({ id: teams.id, slug: teams.slug, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, waitlistedIds));
    for (const team of waitlistedTeams) {
      myTeams.push({
        slug: team.slug,
        name: team.name,
        status: "waitlisted",
      });
    }
  }

  return myTeams.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadEligibleCaptainTeamsForRegistration(
  tournament: PostedTournamentRow,
  userId: string,
  unavailableTeamIds: Set<string>
) {
  const candidates = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      university: teams.university,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(schools, eq(teams.schoolId, schools.id))
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "captain"),
        eq(teams.gender, tournament.gender),
        teamEligibleForTournamentRegistrationFilter
      )
    )
    .orderBy(asc(teams.name));

  return candidates.filter((team) => !unavailableTeamIds.has(team.id));
}

export async function loadTournamentParticipation(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentParticipationContract> {
  const { teamIds, teamById } = await loadViewerTeamMembership(user.id);
  const teamIdSet = new Set(teamIds);
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);

  const [canPacket, canWaiver, canPayment, canChat, eligible, myTeams, waitingIds] =
    await Promise.all([
      userCanDownloadTournamentPacket(tournament, user, teamIdSet),
      userCanAccessTournamentWaiver(tournament, user, teamIdSet),
      userCanAccessTournamentPayment(tournament, user, teamIdSet),
      userCanViewTournamentChat(tournament, user, teamIds),
      isOrganizer
        ? Promise.resolve([] as EligibleSpeakingTeam[])
        : getUserEligibleSpeakingTeams(tournament.id, user.id),
      loadViewerTournamentTeams(tournament.id, user.id, teamIds),
      waitingTeamIdsForTournament(tournament.id),
    ]);

  const unavailable = new Set<string>([
    ...waitingIds,
    ...(
      await db
        .select({ teamId: registrations.teamId })
        .from(registrations)
        .where(eq(registrations.tournamentId, tournament.id))
    ).map((row) => row.teamId),
  ]);

  const registrationOpen =
    canRegisterTeams(tournament) &&
    registrationAvailabilityOpen(
      tournament.status,
      {
        deadline: tournament.registrationDeadline?.toISOString() ?? null,
      },
      new Date().toISOString()
    );

  const eligibleTeams = registrationOpen
    ? await loadEligibleCaptainTeamsForRegistration(
        tournament,
        user.id,
        unavailable
      )
    : [];

  return {
    isOrganizer,
    access: {
      packet: isOrganizer || canPacket,
      waiver: isOrganizer || (tournament.waiverEnabled && canWaiver),
      payment: isOrganizer || (tournament.paymentEnabled && canPayment),
      email: isOrganizer,
      chat: canChat,
    },
    speakingTeams: await speakingTeamsContract(eligible, teamById),
    myTeams,
    canRegister: registrationOpen && eligibleTeams.length > 0,
  };
}

export async function loadTournamentRegisterOptions(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentRegisterOptionsContract> {
  const { teamIds } = await loadViewerTeamMembership(user.id);
  const [myTeams, waitingIds, registeredRows] = await Promise.all([
    loadViewerTournamentTeams(tournament.id, user.id, teamIds),
    waitingTeamIdsForTournament(tournament.id),
    db
      .select({ teamId: registrations.teamId })
      .from(registrations)
      .where(eq(registrations.tournamentId, tournament.id)),
  ]);

  const waitlistState = await loadApplicantWaitlistState({
    tournamentId: tournament.id,
    userId: user.id,
  });
  const availability = waitlistState.registrationAvailability;
  const genderLabel = formatTeamGender(tournament.gender);

  const registrationOpen =
    availability != null &&
    canRegisterTeams({ ...tournament, status: availability.status }) &&
    registrationAvailabilityOpen(
      availability.status,
      availability,
      new Date().toISOString()
    );

  if (!registrationOpen) {
    return {
      registrationOpen: false,
      closedReason:
        "Registration is not open for this tournament right now.",
      genderLabel,
      emptyMessage: null,
      eligibleTeams: [],
      myTeams,
      availability: {
        capacity: availability?.capacity ?? tournament.registrationCapacity,
        deadline:
          availability?.deadline ??
          tournament.registrationDeadline?.toISOString() ??
          null,
        registeredCount:
          availability?.registeredCount ?? registeredRows.length,
        waitlistCount: availability?.waitlistCount ?? 0,
      },
    };
  }

  const unavailable = new Set([
    ...registeredRows.map((row) => row.teamId),
    ...waitingIds,
  ]);
  const eligible = await loadEligibleCaptainTeamsForRegistration(
    tournament,
    user.id,
    unavailable
  );

  return {
    registrationOpen: true,
    closedReason: null,
    genderLabel,
    emptyMessage:
      eligible.length === 0
        ? `You don't have any ${genderLabel} teams eligible to register. Teams must be admin-approved (standalone) or under a verified school.`
        : null,
    eligibleTeams: eligible.map((team) => ({
      slug: team.slug,
      name: team.name,
      university: team.university,
    })),
    myTeams,
    availability: {
      capacity: availability?.capacity ?? null,
      deadline: availability?.deadline ?? null,
      registeredCount: availability?.registeredCount ?? registeredRows.length,
      waitlistCount: availability?.waitlistCount ?? 0,
    },
  };
}

export async function loadTournamentPacket(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentPacketContract> {
  const { teamIds } = await loadViewerTeamMembership(user.id);
  const canDownload = await userCanDownloadTournamentPacket(
    tournament,
    user,
    new Set(teamIds)
  );
  if (!canDownload) throw forbidden("You cannot access this tournament packet.");

  return {
    notes: tournament.packetNotes,
    canDownload: true,
  };
}

export async function loadTournamentWaiver(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentWaiverContract> {
  const { teamIds, captainTeamIds } =
    await loadViewerTeamMembership(user.id);
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const canAccess = await userCanAccessTournamentWaiver(
    tournament,
    user,
    new Set(teamIds)
  );
  if (!isOrganizer && !(tournament.waiverEnabled && canAccess)) {
    throw forbidden("You cannot access this tournament waiver.");
  }

  const settings = waiverSettingsFromTournament(tournament);
  const latest = await getLatestTournamentWaiver(tournament.id);

  const registrationRows = await db
    .select({
      teamId: registrations.teamId,
      teamSlug: teams.slug,
      teamName: teams.name,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .where(
      and(
        eq(registrations.tournamentId, tournament.id),
        inArray(registrations.status, [...ACTIVE_REGISTRATION_STATUSES])
      )
    )
    .orderBy(asc(teams.name));

  const visibleRows = isOrganizer
    ? registrationRows
    : registrationRows.filter((row) => teamIds.includes(row.teamId));

  const teamsPayload = await Promise.all(
    visibleRows.map(async (row) => {
      const compliance = await getTeamWaiverCompliance(tournament, row.teamId);
      return {
        teamSlug: row.teamSlug,
        teamName: row.teamName,
        isCaptain: captainTeamIds.has(row.teamId),
        completedCount: compliance.completedCount,
        totalCount: compliance.totalCount,
        complete: compliance.complete,
        roster: compliance.roster.map((member) => ({
          userId: member.userId,
          fullName: member.fullName,
          role: member.role,
          completed: member.completed,
          method: member.method,
          completedAt: member.completedAt?.toISOString() ?? null,
          isViewer: member.userId === user.id,
        })),
      };
    })
  );

  return {
    isOrganizer,
    settings: {
      enabled: settings.enabled,
      allowDownloadPrint: settings.allowDownloadPrint,
      allowThirdParty: settings.allowThirdParty,
      allowDigitalAck: settings.allowDigitalAck,
      thirdPartyUrl: settings.thirdPartyUrl,
      requiredBeforeCheckIn: settings.requiredBeforeCheckIn,
    },
    hasPdf: latest != null,
    version: latest?.version ?? null,
    fileName: latest?.fileName ?? null,
    teams: teamsPayload,
  };
}

export async function loadTournamentPayment(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentPaymentContract> {
  const { teamIds, captainTeamIds } = await loadViewerTeamMembership(user.id);
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const canAccess = await userCanAccessTournamentPayment(
    tournament,
    user,
    new Set(teamIds)
  );
  if (!isOrganizer && !(tournament.paymentEnabled && canAccess)) {
    throw forbidden("You cannot access this tournament payment page.");
  }

  const settings = paymentSettingsFromTournament(tournament);
  const registrationRows = await db
    .select({
      registrationId: registrations.id,
      teamId: registrations.teamId,
      teamSlug: teams.slug,
      teamName: teams.name,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .where(
      and(
        eq(registrations.tournamentId, tournament.id),
        inArray(registrations.status, [...ACTIVE_REGISTRATION_STATUSES])
      )
    )
    .orderBy(asc(teams.name));

  const visibleRows = isOrganizer
    ? registrationRows
    : registrationRows.filter((row) => teamIds.includes(row.teamId));

  const payments = await getPaymentsByRegistrationIds(
    visibleRows.map((row) => row.registrationId)
  );

  return {
    isOrganizer,
    settings: {
      enabled: settings.enabled,
      requiredBeforeConfirm: settings.requiredBeforeConfirm,
      firstTeamFeeCents: settings.firstTeamFeeCents,
      additionalTeamFeeCents: settings.additionalTeamFeeCents,
      venmoHandle: settings.venmoHandle,
      zelleHandle: settings.zelleHandle,
      cashappHandle: settings.cashappHandle,
      otherInstructions: settings.otherInstructions,
      instructionsText: paymentInstructionsText(settings),
    },
    teams: visibleRows.flatMap((row) => {
      const payment = payments.get(row.registrationId);
      if (!payment) return [];
      return [
        {
          teamSlug: row.teamSlug,
          teamName: row.teamName,
          isCaptain: captainTeamIds.has(row.teamId),
          amountCents: payment.amountCents,
          status: payment.status,
          submittedMethod: payment.submittedMethod,
          submittedNote: payment.submittedNote,
          submittedAt: payment.submittedAt?.toISOString() ?? null,
        },
      ];
    }),
  };
}

export async function loadTournamentChat(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentChatContract> {
  const { teamIds, teamById } = await loadViewerTeamMembership(user.id);
  const canView = await userCanViewTournamentChat(tournament, user, teamIds);
  if (!canView) throw forbidden("You cannot access this tournament chat.");

  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const eligible = isOrganizer
    ? []
    : await getUserEligibleSpeakingTeams(tournament.id, user.id);
  const canPost = canPostInTournamentChat(tournament);
  const channels = await ensureTournamentChatChannels(tournament.id);
  const unread = await getTournamentChatUnreadCounts(
    tournament.id,
    user.id,
    channels
  );
  const messages = await loadRecentChatMessages(
    tournament.id,
    channels.map((channel) => channel.id)
  );
  const blocked = await loadBlockedUserIds(user.id);

  const messagesByChannel = new Map<string, typeof messages>();
  for (const message of messages) {
    if (blocked.has(message.authorUserId)) continue;
    const list = messagesByChannel.get(message.channelId) ?? [];
    list.push(message);
    messagesByChannel.set(message.channelId, list);
  }

  return {
    tournamentId: tournament.id,
    canPost,
    speakingTeams: await speakingTeamsContract(eligible, teamById),
    channels: channels.map((channel) => {
      const hasEligibleTeam = eligible.length > 0;
      const channelMessages = (messagesByChannel.get(channel.id) ?? [])
        .slice()
        .reverse()
        .map((message) => ({
          id: message.id,
          authorUserId: message.authorUserId,
          authorName: message.authorName,
          teamName: message.teamName,
          body: message.body,
          createdAt: message.createdAt.toISOString(),
          isOrganizerMessage: message.isOrganizerMessage,
          isOwn: message.authorUserId === user.id,
        }));

      return {
        kind: channel.kind,
        label: TOURNAMENT_CHAT_CHANNEL_LABELS[channel.kind],
        description: TOURNAMENT_CHAT_CHANNEL_DESCRIPTIONS[channel.kind],
        canPost:
          canPost &&
          canPostInChatChannel(channel.kind, isOrganizer, hasEligibleTeam),
        unreadCount: unread.byChannel[channel.kind] ?? 0,
        messages: channelMessages,
      };
    }),
  };
}

export async function loadTournamentEmail(
  tournament: PostedTournamentRow,
  user: AppUser
): Promise<TournamentEmailContract> {
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  if (!isOrganizer) {
    throw forbidden("Only the organizer can send tournament emails.");
  }

  const canSend = await canEditTournamentPreparation(tournament, user);
  const history = await db
    .select({
      id: tournamentEmailSends.id,
      kind: tournamentEmailSends.kind,
      audience: tournamentEmailSends.audience,
      subject: tournamentEmailSends.subject,
      recipientCount: tournamentEmailSends.recipientCount,
      skippedNoCaptainCount: tournamentEmailSends.skippedNoCaptainCount,
      sentAt: tournamentEmailSends.sentAt,
    })
    .from(tournamentEmailSends)
    .where(eq(tournamentEmailSends.tournamentId, tournament.id))
    .orderBy(desc(tournamentEmailSends.sentAt))
    .limit(20);

  return {
    canSend,
    lockedReason: canSend
      ? null
      : tournamentPreparationLockedReason(tournament),
    waiverEnabled: tournament.waiverEnabled,
    history: history.map((row) => ({
      id: row.id,
      kind: row.kind,
      audience: row.audience,
      subject: row.subject,
      recipientCount: row.recipientCount,
      skippedNoCaptainCount: row.skippedNoCaptainCount,
      sentAt: row.sentAt.toISOString(),
    })),
  };
}

export async function resolveRegisteredTeamIdBySlug(
  tournamentId: string,
  teamSlug: string
): Promise<{ teamId: string; registrationId: string } | null> {
  const [row] = await db
    .select({
      teamId: teams.id,
      registrationId: registrations.id,
    })
    .from(registrations)
    .innerJoin(teams, eq(teams.id, registrations.teamId))
    .where(
      and(
        eq(registrations.tournamentId, tournamentId),
        eq(teams.slug, teamSlug),
        inArray(registrations.status, [...ACTIVE_REGISTRATION_STATUSES])
      )
    )
    .limit(1);

  return row ?? null;
}
