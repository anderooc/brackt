"use server";

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

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { db } from "@/lib/db";
import {
  contentFlags,
  teamMembers,
  tournamentChatChannels,
  tournamentChatMessages,
  tournamentChatReadCursors,
  tournaments,
} from "@/lib/db/schema";
import {
  canPostInChatChannel,
  canPostInTournamentChat,
  ensureTournamentChatChannels,
  getUserEligibleSpeakingTeams,
  userCanViewTournamentChat,
} from "@/lib/tournaments/chat-access";
import { resolveIsTournamentOrganizer } from "@/lib/tournaments/permissions";
import { TOURNAMENT_CHAT_BODY_MAX } from "@/lib/tournaments/chat-constants";
import { notifyRegisteredCaptainsOfChatAnnouncement } from "@/lib/notifications/tournament-events";
import type { EligibleSpeakingTeam } from "@/lib/tournaments/chat-access";
import type { TournamentChatChannelKind } from "@/types";

const CHAT_RATE_LIMIT_PER_HOUR = 30;

const REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "other",
] as const;

const reportMessageSchema = z.object({
  messageId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
});

type ChatChannelRow = {
  id: string;
  kind: TournamentChatChannelKind;
};

type ChatPageContext =
  | { error: string }
  | {
      user: Awaited<ReturnType<typeof requireUser>>;
      tournament: typeof tournaments.$inferSelect;
      isOrganizer: boolean;
      eligibleTeams: EligibleSpeakingTeam[];
      canPost: boolean;
      channels: ChatChannelRow[];
    };

const sendMessageSchema = z.object({
  channelId: z.string().uuid(),
  body: z.string().trim().min(1).max(TOURNAMENT_CHAT_BODY_MAX),
  teamId: z.string().uuid().optional(),
});

type LoadChatContextResult =
  | { ok: false; error: string }
  | {
      ok: true;
      user: Awaited<ReturnType<typeof requireUser>>;
      tournament: typeof tournaments.$inferSelect;
      isOrganizer: boolean;
      eligibleTeams: EligibleSpeakingTeam[];
      canPost: boolean;
    };

async function loadChatContext(
  tournamentId: string
): Promise<LoadChatContextResult> {
  const user = await requireUser();
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) {
    return { ok: false, error: "Tournament not found." };
  }

  const memberRows = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));
  const userTeamIds = memberRows.map((row) => row.teamId);

  const canView = await userCanViewTournamentChat(
    tournament,
    user,
    userTeamIds
  );
  if (!canView) {
    return {
      ok: false,
      error: "You do not have access to this tournament chat.",
    };
  }

  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const eligibleTeams = isOrganizer
    ? []
    : await getUserEligibleSpeakingTeams(tournamentId, user.id);

  return {
    ok: true,
    user,
    tournament,
    isOrganizer,
    eligibleTeams,
    canPost: canPostInTournamentChat(tournament),
  };
}

export async function sendTournamentChatMessage(
  tournamentId: string,
  input: z.infer<typeof sendMessageSchema>
) {
  const loaded = await loadChatContext(tournamentId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const { user, tournament, isOrganizer, eligibleTeams, canPost } = loaded;
  if (!canPost) {
    return {
      error: "Chat is read-only because this tournament is archived.",
    } as const;
  }

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid message.",
    } as const;
  }

  const [channel] = await db
    .select()
    .from(tournamentChatChannels)
    .where(
      and(
        eq(tournamentChatChannels.id, parsed.data.channelId),
        eq(tournamentChatChannels.tournamentId, tournamentId)
      )
    )
    .limit(1);

  if (!channel) {
    return { error: "Chat channel not found." as const };
  }

  const hasEligibleTeam = eligibleTeams.length > 0;
  if (
    !canPostInChatChannel(channel.kind, isOrganizer, hasEligibleTeam)
  ) {
    return { error: "You cannot post in this channel." as const };
  }

  let teamId: string | null = null;
  if (!isOrganizer) {
    if (eligibleTeams.length === 0) {
      return { error: "You cannot post in this channel." as const };
    }
    if (parsed.data.teamId) {
      const match = eligibleTeams.find((team) => team.teamId === parsed.data.teamId);
      if (!match) {
        return { error: "Choose a valid team to post as." as const };
      }
      teamId = match.teamId;
    } else if (eligibleTeams.length === 1) {
      teamId = eligibleTeams[0]!.teamId;
    } else {
      return { error: "Choose which team you are posting as." as const };
    }
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "tournament.chat", text: parsed.data.body },
  ]);
  if (contentError) return { error: contentError };

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
    return {
      error: "Message rate limit reached. Try again in a little while.",
    } as const;
  }

  const [message] = await db
    .insert(tournamentChatMessages)
    .values({
      channelId: channel.id,
      tournamentId,
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
        tournamentId,
        tournamentSlug: tournament.slug,
        tournamentName: tournament.name,
        body: parsed.data.body,
        excludeUserId: user.id,
      });
    } catch {
      // Chat message already saved; in-app copy is best-effort.
    }
  }

  revalidatePath("/tournaments/[slug]", "page");
  revalidatePath("/notifications");
  return { success: true as const, messageId: message!.id };
}

export async function reportTournamentChatMessage(
  tournamentId: string,
  input: z.infer<typeof reportMessageSchema>
) {
  const loaded = await loadChatContext(tournamentId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const parsed = reportMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid report.",
    } as const;
  }

  const [message] = await db
    .select({
      id: tournamentChatMessages.id,
      authorUserId: tournamentChatMessages.authorUserId,
      body: tournamentChatMessages.body,
      tournamentId: tournamentChatMessages.tournamentId,
    })
    .from(tournamentChatMessages)
    .where(
      and(
        eq(tournamentChatMessages.id, parsed.data.messageId),
        eq(tournamentChatMessages.tournamentId, tournamentId)
      )
    )
    .limit(1);

  if (!message) {
    return { error: "Message not found." as const };
  }

  if (message.authorUserId === loaded.user.id) {
    return { error: "You cannot report your own message." as const };
  }

  await db.insert(contentFlags).values({
    userId: loaded.user.id,
    area: `chat.message:${message.id}`,
    blockedWord: "user-report",
    text: `Reason: ${parsed.data.reason}\n\n${message.body}`,
  });

  return { success: true as const };
}

export async function markTournamentChatChannelRead(
  tournamentId: string,
  channelId: string
) {
  const loaded = await loadChatContext(tournamentId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const [channel] = await db
    .select({ id: tournamentChatChannels.id })
    .from(tournamentChatChannels)
    .where(
      and(
        eq(tournamentChatChannels.id, channelId),
        eq(tournamentChatChannels.tournamentId, tournamentId)
      )
    )
    .limit(1);

  if (!channel) {
    return { error: "Chat channel not found." as const };
  }

  const now = new Date();
  await db
    .insert(tournamentChatReadCursors)
    .values({
      userId: loaded.user.id,
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

  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function getTournamentQuestionsChannelId(tournamentId: string) {
  const loaded = await loadChatContext(tournamentId);
  if (!loaded.ok) {
    return { error: loaded.error } as const;
  }

  const channels = await ensureTournamentChatChannels(tournamentId);
  const questionsChannel = channels.find((channel) => channel.kind === "questions");
  return {
    success: true as const,
    channelId: questionsChannel?.id ?? null,
    currentUserId: loaded.user.id,
  };
}

export async function ensureTournamentChatForPage(
  tournamentId: string
): Promise<ChatPageContext> {
  const loaded = await loadChatContext(tournamentId);
  if (!loaded.ok) {
    return { error: loaded.error };
  }

  const channels = await ensureTournamentChatChannels(tournamentId);
  return {
    user: loaded.user,
    tournament: loaded.tournament,
    isOrganizer: loaded.isOrganizer,
    eligibleTeams: loaded.eligibleTeams,
    canPost: loaded.canPost,
    channels: channels.map((channel) => ({
      id: channel.id,
      kind: channel.kind as TournamentChatChannelKind,
    })),
  };
}
