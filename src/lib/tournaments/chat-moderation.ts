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

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  contentFlags,
  tournamentChatMessages,
  userBlocks,
  users,
} from "@/lib/db/schema";

export const CHAT_REPORT_REASONS = [
  "spam",
  "harassment",
  "inappropriate",
  "other",
] as const;

export type ChatReportReason = (typeof CHAT_REPORT_REASONS)[number];

type Result = { error: string; success?: undefined } | { success: true; error?: undefined };

/** Files a report into the admin flags queue (`blockedWord = "user-report"`). */
export async function recordChatMessageReport(
  reporterUserId: string,
  tournamentId: string,
  messageId: string,
  reason: ChatReportReason
): Promise<Result> {
  const [message] = await db
    .select({
      id: tournamentChatMessages.id,
      authorUserId: tournamentChatMessages.authorUserId,
      body: tournamentChatMessages.body,
    })
    .from(tournamentChatMessages)
    .where(
      and(
        eq(tournamentChatMessages.id, messageId),
        eq(tournamentChatMessages.tournamentId, tournamentId)
      )
    )
    .limit(1);

  if (!message) return { error: "Message not found." };
  if (message.authorUserId === reporterUserId) {
    return { error: "You cannot report your own message." };
  }

  await db.insert(contentFlags).values({
    userId: reporterUserId,
    area: `chat.message:${message.id}`,
    blockedWord: "user-report",
    text: `Reason: ${reason}\n\n${message.body}`,
  });

  return { success: true };
}

export async function loadBlockedUserIds(blockerUserId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blockedUserId: userBlocks.blockedUserId })
    .from(userBlocks)
    .where(eq(userBlocks.blockerUserId, blockerUserId));
  return new Set(rows.map((row) => row.blockedUserId));
}

export async function listBlockedUsers(blockerUserId: string) {
  return db
    .select({
      userId: userBlocks.blockedUserId,
      fullName: users.fullName,
      blockedAt: userBlocks.createdAt,
    })
    .from(userBlocks)
    .innerJoin(users, eq(users.id, userBlocks.blockedUserId))
    .where(eq(userBlocks.blockerUserId, blockerUserId))
    .orderBy(desc(userBlocks.createdAt));
}

/** Also flags the block for admins so abusive accounts get reviewed. */
export async function blockUser(
  blockerUserId: string,
  blockedUserId: string
): Promise<Result> {
  if (blockerUserId === blockedUserId) return { error: "You cannot block yourself." };

  const [target] = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, blockedUserId))
    .limit(1);
  if (!target) return { error: "User not found." };

  const inserted = await db
    .insert(userBlocks)
    .values({ blockerUserId, blockedUserId })
    .onConflictDoNothing()
    .returning({ blockedUserId: userBlocks.blockedUserId });

  if (inserted.length > 0) {
    await db.insert(contentFlags).values({
      userId: blockerUserId,
      area: `user:${blockedUserId}`,
      blockedWord: "user-block",
      text: `Blocked ${target.fullName}`,
    });
  }

  return { success: true };
}

export async function unblockUser(blockerUserId: string, blockedUserId: string) {
  await db
    .delete(userBlocks)
    .where(
      and(
        eq(userBlocks.blockerUserId, blockerUserId),
        eq(userBlocks.blockedUserId, blockedUserId)
      )
    );
}
