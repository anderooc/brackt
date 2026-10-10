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

import { and, eq, gte, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppUser } from "@/lib/auth";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { db } from "@/lib/db";
import {
  registrationPayments,
  teamMembers,
  teams,
  tournamentChatMessages,
  tournamentChatReadCursors,
  waiverCompletions,
} from "@/lib/db/schema";
import {
  canPostInChatChannel,
  canPostInTournamentChat,
  ensureTournamentChatChannels,
  getUserEligibleSpeakingTeams,
  userCanViewTournamentChat,
} from "@/lib/tournaments/chat-access";
import { TOURNAMENT_CHAT_BODY_MAX } from "@/lib/tournaments/chat-constants";
import { notifyRegisteredCaptainsOfChatAnnouncement } from "@/lib/notifications/tournament-events";
import { getPaymentsByRegistrationIds } from "@/lib/tournaments/payment-compliance";
import {
  audienceLabel,
  resolveCaptainEmailRecipients,
  type TournamentEmailAudience,
} from "@/lib/tournaments/email-recipients";
import {
  canEditTournamentPreparation,
  resolveIsTournamentOrganizer,
  tournamentPreparationLockedReason,
} from "@/lib/tournaments/permissions";
import {
  buildWaiverReminderEmail,
  sendTournamentCaptainEmails,
  TOURNAMENT_EMAIL_BODY_MAX,
  TOURNAMENT_EMAIL_SUBJECT_MAX,
} from "@/lib/tournaments/send-tournament-email";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { getLatestTournamentWaiver } from "@/lib/tournaments/waiver-compliance";
import {
  userCanAccessTournamentWaiver,
  waiverSettingsFromTournament,
} from "@/lib/tournaments/waiver-access";
import {
  captainAttestWaiverPlayerForUser,
  clearWaiverCompletionForUser,
  hostWaivePlayerWaiverForUser,
} from "@/lib/tournaments/waiver-player-status";
import { userCanAccessTournamentPayment } from "@/lib/tournaments/payment-access";
import {
  MAX_TEAM_REGISTRATION_BATCH_SIZE,
  registrationPlacementCachePolicy,
  registerTeamsAtomically,
} from "@/lib/tournaments/registrations";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import { withdrawRegistrationAtomically } from "@/lib/tournaments/registration-roster-mutations";
import {
  OperationConflictError,
  OperationValidationError,
} from "@/lib/tournaments/competition-operation-rules";
import type {
  TournamentEmailPreviewContract,
  TournamentEmailSendResultContract,
  TournamentRegisterResultContract,
} from "../contracts/tournament-ops";
import { badRequest, forbidden, notFound } from "../errors";
import {
  loadViewerTeamMembership,
  requirePostedTournament,
  resolveRegisteredTeamIdBySlug,
  type PostedTournamentRow,
} from "./tournament-ops";

const CHAT_RATE_LIMIT_PER_HOUR = 30;

const audienceSchema = z.enum([
  "captains_confirmed",
  "captains_all",
  "captains_pending",
  "captains_waiver_incomplete",
]);

export async function acknowledgeWaiverForViewer(
  slug: string,
  user: AppUser,
  input: { teamSlug: string; signedName: string }
) {
  const tournament = await requirePostedTournament(slug);
  const trimmed = input.signedName.trim();
  if (!trimmed || trimmed.length > 200) {
    throw badRequest("Enter your full legal name to acknowledge the waiver.");
  }

  if (!tournament.waiverEnabled) {
    throw badRequest("This tournament does not require a waiver.");
  }
  const settings = waiverSettingsFromTournament(tournament);
  if (!settings.allowDigitalAck) {
    throw badRequest(
      "The host does not allow digital acknowledgment for this waiver."
    );
  }

  const { teamIds } = await loadViewerTeamMembership(user.id);
  const canAccess = await userCanAccessTournamentWaiver(
    tournament,
    user,
    new Set(teamIds)
  );
  if (!canAccess) throw forbidden("You cannot access this tournament waiver.");

  const team = await resolveRegisteredTeamIdBySlug(
    tournament.id,
    input.teamSlug
  );
  if (!team) throw notFound("Team registration not found.");

  const membership = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, team.teamId),
        eq(teamMembers.userId, user.id)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!membership) {
    throw forbidden("You are not on this team's roster.");
  }

  const waiver = await getLatestTournamentWaiver(tournament.id);
  if (!waiver) {
    throw badRequest("No waiver has been uploaded for this tournament yet.");
  }

  await db
    .insert(waiverCompletions)
    .values({
      waiverId: waiver.id,
      tournamentId: tournament.id,
      teamId: team.teamId,
      userId: user.id,
      method: "digital",
      signedName: trimmed,
    })
    .onConflictDoUpdate({
      target: [waiverCompletions.waiverId, waiverCompletions.userId],
      set: {
        teamId: team.teamId,
        method: "digital",
        signedName: trimmed,
        completedAt: new Date(),
        attestedByUserId: null,
        waivedByUserId: null,
      },
    });

  return { success: true as const };
}

export type WaiverPlayerAction = "attest" | "waive" | "clear";

export async function updateWaiverPlayerForViewer(
  slug: string,
  user: AppUser,
  input: { teamSlug: string; userId: string; action: WaiverPlayerAction }
) {
  const tournament = await requirePostedTournament(slug);
  const team = await resolveRegisteredTeamIdBySlug(
    tournament.id,
    input.teamSlug
  );
  if (!team) throw notFound("Team registration not found.");

  const run =
    input.action === "attest"
      ? captainAttestWaiverPlayerForUser
      : input.action === "waive"
        ? hostWaivePlayerWaiverForUser
        : clearWaiverCompletionForUser;
  const result = await run(user, tournament.id, team.teamId, input.userId);
  if (result.error) throw badRequest(result.error);

  return { success: true as const };
}

export async function submitPaymentForViewer(
  slug: string,
  user: AppUser,
  input: { teamSlug: string; method: string; note?: string }
) {
  const tournament = await requirePostedTournament(slug);
  if (!tournament.paymentEnabled) {
    throw badRequest("Payment tracking is not enabled for this tournament.");
  }

  const parsed = z
    .object({
      teamSlug: z.string().min(1),
      method: z.enum([
        "venmo",
        "zelle",
        "cashapp",
        "check",
        "cash",
        "other",
      ]),
      note: z.string().trim().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid payment.");
  }

  const team = await resolveRegisteredTeamIdBySlug(
    tournament.id,
    parsed.data.teamSlug
  );
  if (!team) throw notFound("Team registration not found.");

  const captain = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, team.teamId),
        eq(teamMembers.userId, user.id),
        eq(teamMembers.role, "captain")
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!captain) {
    throw forbidden("Only the team captain can submit payment.");
  }

  const { teamIds } = await loadViewerTeamMembership(user.id);
  const canAccess = await userCanAccessTournamentPayment(
    tournament,
    user,
    new Set(teamIds)
  );
  if (!canAccess) throw forbidden("You cannot access this payment page.");

  const payments = await getPaymentsByRegistrationIds([team.registrationId]);
  const payment = payments.get(team.registrationId);
  if (!payment) throw notFound("No payment record for this registration.");
  if (payment.status !== "unpaid") {
    throw badRequest("Payment has already been submitted or settled.");
  }

  const now = new Date();
  await db
    .update(registrationPayments)
    .set({
      status: "submitted",
      submittedMethod: parsed.data.method,
      submittedNote: parsed.data.note || null,
      submittedByUserId: user.id,
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(registrationPayments.registrationId, team.registrationId));

  return { success: true as const };
}

async function requireOrganizer(
  tournament: PostedTournamentRow,
  user: AppUser
) {
  if (!(await resolveIsTournamentOrganizer(tournament, user))) {
    throw forbidden("Only the organizer can manage this tournament.");
  }
}

export async function confirmPaymentForOrganizer(
  slug: string,
  user: AppUser,
  teamSlug: string
) {
  const tournament = await requirePostedTournament(slug);
  await requireOrganizer(tournament, user);

  const team = await resolveRegisteredTeamIdBySlug(tournament.id, teamSlug);
  if (!team) throw notFound("Team registration not found.");

  const payments = await getPaymentsByRegistrationIds([team.registrationId]);
  const payment = payments.get(team.registrationId);
  if (!payment) throw notFound("No payment record for this registration.");
  if (payment.status !== "submitted" && payment.status !== "unpaid") {
    throw badRequest("Payment is already settled.");
  }

  const now = new Date();
  await db
    .update(registrationPayments)
    .set({
      status: "confirmed",
      confirmedByUserId: user.id,
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(registrationPayments.registrationId, team.registrationId));

  return { success: true as const };
}

export async function waivePaymentForOrganizer(
  slug: string,
  user: AppUser,
  teamSlug: string
) {
  const tournament = await requirePostedTournament(slug);
  await requireOrganizer(tournament, user);

  const team = await resolveRegisteredTeamIdBySlug(tournament.id, teamSlug);
  if (!team) throw notFound("Team registration not found.");

  const payments = await getPaymentsByRegistrationIds([team.registrationId]);
  const payment = payments.get(team.registrationId);
  if (!payment) throw notFound("No payment record for this registration.");
  if (payment.status === "confirmed" || payment.status === "waived") {
    throw badRequest("Payment is already settled.");
  }

  const now = new Date();
  await db
    .update(registrationPayments)
    .set({
      status: "waived",
      confirmedByUserId: user.id,
      confirmedAt: now,
      updatedAt: now,
    })
    .where(eq(registrationPayments.registrationId, team.registrationId));

  return { success: true as const };
}

export async function postChatMessageForViewer(
  slug: string,
  user: AppUser,
  input: { channelKind: string; body: string; teamSlug?: string }
) {
  const tournament = await requirePostedTournament(slug);
  const { teamIds, teamById } = await loadViewerTeamMembership(user.id);
  const canView = await userCanViewTournamentChat(tournament, user, teamIds);
  if (!canView) throw forbidden("You do not have access to this tournament chat.");

  if (!canPostInTournamentChat(tournament)) {
    throw badRequest("Chat is read-only because this tournament is archived.");
  }

  const parsed = z
    .object({
      channelKind: z.enum(["announcements", "questions", "general"]),
      body: z.string().trim().min(1).max(TOURNAMENT_CHAT_BODY_MAX),
      teamSlug: z.string().min(1).optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid message.");
  }

  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const eligible = isOrganizer
    ? []
    : await getUserEligibleSpeakingTeams(tournament.id, user.id);
  const channels = await ensureTournamentChatChannels(tournament.id);
  const channel = channels.find((row) => row.kind === parsed.data.channelKind);
  if (!channel) throw notFound("Chat channel not found.");

  if (
    !canPostInChatChannel(
      channel.kind,
      isOrganizer,
      eligible.length > 0
    )
  ) {
    throw forbidden("You cannot post in this channel.");
  }

  let teamId: string | null = null;
  if (!isOrganizer) {
    if (eligible.length === 0) {
      throw forbidden("You cannot post in this channel.");
    }
    if (parsed.data.teamSlug) {
      const match = [...teamById.values()].find(
        (team) => team.slug === parsed.data.teamSlug
      );
      const eligibleMatch = match
        ? eligible.find((team) => team.teamId === match.id)
        : null;
      if (!eligibleMatch) {
        throw badRequest("Choose a valid team to post as.");
      }
      teamId = eligibleMatch.teamId;
    } else if (eligible.length === 1) {
      teamId = eligible[0]!.teamId;
    } else {
      throw badRequest("Choose which team you are posting as.");
    }
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "tournament.chat", text: parsed.data.body },
  ]);
  if (contentError) throw badRequest(contentError);

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db
    .select({ id: tournamentChatMessages.id })
    .from(tournamentChatMessages)
    .where(
      and(
        eq(tournamentChatMessages.channelId, channel.id),
        eq(tournamentChatMessages.authorUserId, user.id),
        gte(tournamentChatMessages.createdAt, oneHourAgo)
      )
    );
  if (recentCount.length >= CHAT_RATE_LIMIT_PER_HOUR) {
    throw badRequest("Message rate limit reached. Try again in a little while.");
  }

  const [message] = await db
    .insert(tournamentChatMessages)
    .values({
      channelId: channel.id,
      tournamentId: tournament.id,
      authorUserId: user.id,
      teamId,
      body: parsed.data.body,
    })
    .returning({
      id: tournamentChatMessages.id,
      createdAt: tournamentChatMessages.createdAt,
    });

  await db
    .insert(tournamentChatReadCursors)
    .values({
      userId: user.id,
      channelId: channel.id,
      lastReadAt: message!.createdAt,
    })
    .onConflictDoUpdate({
      target: [
        tournamentChatReadCursors.userId,
        tournamentChatReadCursors.channelId,
      ],
      set: { lastReadAt: message!.createdAt },
    });

  if (channel.kind === "announcements") {
    try {
      await notifyRegisteredCaptainsOfChatAnnouncement({
        tournamentId: tournament.id,
        tournamentSlug: tournament.slug,
        tournamentName: tournament.name,
        body: parsed.data.body,
        excludeUserId: user.id,
      });
    } catch {
      // Best-effort notification.
    }
  }

  return { success: true as const, messageId: message!.id };
}

export async function markChatChannelReadForViewer(
  slug: string,
  user: AppUser,
  channelKind: string
) {
  const tournament = await requirePostedTournament(slug);
  const { teamIds } = await loadViewerTeamMembership(user.id);
  const canView = await userCanViewTournamentChat(tournament, user, teamIds);
  if (!canView) throw forbidden("You do not have access to this tournament chat.");

  const kind = z
    .enum(["announcements", "questions", "general"])
    .safeParse(channelKind);
  if (!kind.success) throw badRequest("Unknown chat channel.");

  const channels = await ensureTournamentChatChannels(tournament.id);
  const channel = channels.find((row) => row.kind === kind.data);
  if (!channel) throw notFound("Chat channel not found.");

  const now = new Date();
  await db
    .insert(tournamentChatReadCursors)
    .values({
      userId: user.id,
      channelId: channel.id,
      lastReadAt: now,
    })
    .onConflictDoUpdate({
      target: [
        tournamentChatReadCursors.userId,
        tournamentChatReadCursors.channelId,
      ],
      set: { lastReadAt: now },
    });

  return { success: true as const };
}

export async function previewEmailForOrganizer(
  slug: string,
  user: AppUser,
  audience: string
): Promise<TournamentEmailPreviewContract> {
  const tournament = await requirePostedTournament(slug);
  await requireOrganizer(tournament, user);

  const parsed = audienceSchema.safeParse(audience);
  if (!parsed.success) throw badRequest("Unknown email audience.");

  if (!(await canEditTournamentPreparation(tournament, user))) {
    throw badRequest(
      tournamentPreparationLockedReason(tournament) ??
        "Emails cannot be sent in the current tournament stage."
    );
  }

  const result = await resolveCaptainEmailRecipients(
    tournament,
    parsed.data as TournamentEmailAudience
  );

  return {
    recipientCount: result.recipients.length,
    skippedNoCaptainCount: result.skippedNoCaptainCount,
    skippedNoCaptainTeamNames: result.skippedNoCaptainTeamNames,
    audienceLabel: audienceLabel(parsed.data),
  };
}

export async function sendCustomEmailForOrganizer(
  slug: string,
  user: AppUser,
  input: { audience: string; subject: string; body: string }
): Promise<TournamentEmailSendResultContract> {
  const tournament = await requirePostedTournament(slug);
  await requireOrganizer(tournament, user);

  if (!(await canEditTournamentPreparation(tournament, user))) {
    throw badRequest(
      tournamentPreparationLockedReason(tournament) ??
        "Emails cannot be sent in the current tournament stage."
    );
  }

  const parsed = z
    .object({
      audience: audienceSchema,
      subject: z.string().trim().min(1).max(TOURNAMENT_EMAIL_SUBJECT_MAX),
      body: z.string().trim().min(1).max(TOURNAMENT_EMAIL_BODY_MAX),
    })
    .safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid email.");
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "tournament.email.subject", text: parsed.data.subject },
    { area: "tournament.email.body", text: parsed.data.body },
  ]);
  if (contentError) throw badRequest(contentError);

  const recipientResult = await resolveCaptainEmailRecipients(
    tournament,
    parsed.data.audience
  );

  const result = await sendTournamentCaptainEmails({
    tournamentId: tournament.id,
    tournamentSlug: tournament.slug,
    tournamentName: tournament.name,
    tournamentDateDisplay: formatTournamentDateDisplay(tournament.date),
    tournamentLocation: tournament.location,
    sentByUserId: user.id,
    kind: "custom",
    audience: parsed.data.audience,
    subject: parsed.data.subject,
    body: parsed.data.body,
    recipientResult,
    ctaTab: "setup",
    ctaLabel: "Open tournament",
  });

  if ("error" in result) throw badRequest(result.error);

  return {
    recipientCount: result.recipientCount,
    skippedNoCaptainCount: result.skippedNoCaptainCount,
  };
}

export async function sendWaiverReminderForOrganizer(
  slug: string,
  user: AppUser
): Promise<TournamentEmailSendResultContract> {
  const tournament = await requirePostedTournament(slug);
  await requireOrganizer(tournament, user);

  if (!(await canEditTournamentPreparation(tournament, user))) {
    throw badRequest(
      tournamentPreparationLockedReason(tournament) ??
        "Emails cannot be sent in the current tournament stage."
    );
  }
  if (!tournament.waiverEnabled) {
    throw badRequest("Waiver tracking is not enabled for this tournament.");
  }

  const audience = "captains_waiver_incomplete" as const;
  const recipientResult = await resolveCaptainEmailRecipients(
    tournament,
    audience
  );
  const email = buildWaiverReminderEmail();

  const result = await sendTournamentCaptainEmails({
    tournamentId: tournament.id,
    tournamentSlug: tournament.slug,
    tournamentName: tournament.name,
    tournamentDateDisplay: formatTournamentDateDisplay(tournament.date),
    tournamentLocation: tournament.location,
    sentByUserId: user.id,
    kind: "waiver_reminder",
    audience,
    subject: email.subject,
    body: email.body,
    recipientResult,
    ctaTab: "waiver",
    ctaLabel: "Complete waivers",
  });

  if ("error" in result) throw badRequest(result.error);

  return {
    recipientCount: result.recipientCount,
    skippedNoCaptainCount: result.skippedNoCaptainCount,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function registerTeamsForViewer(
  slug: string,
  user: AppUser,
  input: { teamSlugs: string[]; operationId: string }
): Promise<TournamentRegisterResultContract> {
  const tournament = await requirePostedTournament(slug);
  const uniqueSlugs = [
    ...new Set(input.teamSlugs.map((value) => value.trim()).filter(Boolean)),
  ];
  if (uniqueSlugs.length === 0) {
    throw badRequest("Select at least one team.");
  }
  if (uniqueSlugs.length > MAX_TEAM_REGISTRATION_BATCH_SIZE) {
    throw badRequest(
      `Select no more than ${MAX_TEAM_REGISTRATION_BATCH_SIZE} teams at once.`
    );
  }
  if (!UUID_RE.test(input.operationId)) {
    throw badRequest("Could not start registration. Try again.");
  }

  const teamRows = await db
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(inArray(teams.slug, uniqueSlugs));
  if (teamRows.length !== uniqueSlugs.length) {
    throw notFound("One or more teams were not found.");
  }

  let result: Awaited<ReturnType<typeof registerTeamsAtomically>>;
  try {
    result = await registerTeamsAtomically({
      tournamentId: tournament.id,
      teamIds: teamRows.map((row) => row.id),
      actor: user,
      operationId: input.operationId,
    });
  } catch (error) {
    if (
      error instanceof OperationConflictError ||
      error instanceof OperationValidationError
    ) {
      throw badRequest(error.message);
    }
    throw error;
  }

  const cachePolicy = registrationPlacementCachePolicy(result.replayed);
  await invalidatePublicTournamentCachesByIds([tournament.id], {
    listing: cachePolicy.listing,
  });

  return {
    acceptedCount: result.acceptedCount,
    waitlistedCount: result.waitlistedCount,
  };
}

/** Captain (or organizer) pulls a team out; same rules as the web action. */
export async function withdrawRegistrationForViewer(
  slug: string,
  user: AppUser,
  teamSlug: string
): Promise<{ withdrawn: true }> {
  const tournament = await requirePostedTournament(slug);
  const [team] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.slug, teamSlug.trim()))
    .limit(1);
  if (!team) throw notFound("Team not found.");

  try {
    await withdrawRegistrationAtomically({
      tournamentId: tournament.id,
      teamId: team.id,
      actorUserId: user.id,
    });
  } catch (error) {
    if (
      error instanceof OperationConflictError ||
      error instanceof OperationValidationError
    ) {
      throw badRequest(error.message);
    }
    throw error;
  }

  await invalidatePublicTournamentCachesByIds([tournament.id], {
    listing: true,
  });
  return { withdrawn: true };
}
