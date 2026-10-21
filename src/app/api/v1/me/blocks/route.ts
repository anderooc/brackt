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

import type { BlockedUserContract } from "@/lib/api/contracts/tournament-ops";
import { requireViewer } from "@/lib/api/auth";
import { badRequest } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import { jsonSuccess } from "@/lib/api/response";
import {
  blockUser,
  listBlockedUsers,
  unblockUser,
} from "@/lib/tournaments/chat-moderation";

async function blockedUsers(userId: string): Promise<{ users: BlockedUserContract[] }> {
  const rows = await listBlockedUsers(userId);
  return {
    users: rows.map((row) => ({
      userId: row.userId,
      fullName: row.fullName,
      blockedAt: row.blockedAt.toISOString(),
    })),
  };
}

async function readUserId(request: Request): Promise<string> {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body.userId !== "string" || !body.userId) {
    throw badRequest("Provide userId.");
  }
  return body.userId;
}

export const GET = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  return jsonSuccess(await blockedUsers(user.id));
});

export const POST = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const result = await blockUser(user.id, await readUserId(request));
  if (result.error) throw badRequest(result.error);
  return jsonSuccess(await blockedUsers(user.id));
});

export const DELETE = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  await unblockUser(user.id, await readUserId(request));
  return jsonSuccess(await blockedUsers(user.id));
});
