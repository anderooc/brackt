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

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { userWebPushSubscriptions } from "@/lib/db/schema";

export type WebPushSubscriptionRow = {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function upsertWebPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<void> {
  const now = new Date();
  await db
    .insert(userWebPushSubscriptions)
    .values({
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: userWebPushSubscriptions.endpoint,
      set: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
        lastSeenAt: now,
      },
    });
}

export async function removeWebPushSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await db
    .delete(userWebPushSubscriptions)
    .where(
      and(
        eq(userWebPushSubscriptions.userId, userId),
        eq(userWebPushSubscriptions.endpoint, endpoint)
      )
    );
}

export async function listWebPushSubscriptionsForUsers(
  userIds: string[]
): Promise<WebPushSubscriptionRow[]> {
  if (userIds.length === 0) return [];
  return db
    .select({
      userId: userWebPushSubscriptions.userId,
      endpoint: userWebPushSubscriptions.endpoint,
      p256dh: userWebPushSubscriptions.p256dh,
      auth: userWebPushSubscriptions.auth,
    })
    .from(userWebPushSubscriptions)
    .where(inArray(userWebPushSubscriptions.userId, userIds));
}

export async function removeWebPushSubscriptionsByEndpoints(
  endpoints: string[]
): Promise<void> {
  if (endpoints.length === 0) return;
  await db
    .delete(userWebPushSubscriptions)
    .where(inArray(userWebPushSubscriptions.endpoint, endpoints));
}
