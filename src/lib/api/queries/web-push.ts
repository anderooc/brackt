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

import type { AppUser } from "@/lib/auth";
import type {
  WebPushSubscribeResultContract,
  WebPushUnsubscribeResultContract,
  WebPushVapidPublicKeyContract,
} from "@/lib/api/contracts/web-push";
import { badRequest } from "@/lib/api/errors";
import { getVapidPublicKey } from "@/lib/notifications/vapid";
import {
  removeWebPushSubscription,
  upsertWebPushSubscription,
} from "@/lib/notifications/web-push-subscriptions";

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`Provide ${label}.`);
  }
  return value.trim();
}

export function getWebPushVapidPublicKeyForViewer(): WebPushVapidPublicKeyContract {
  return { publicKey: getVapidPublicKey() };
}

export async function subscribeWebPushForViewer(
  user: AppUser,
  input: {
    endpoint: unknown;
    p256dh: unknown;
    auth: unknown;
    userAgent?: unknown;
  }
): Promise<WebPushSubscribeResultContract> {
  const endpoint = requireNonEmptyString(input.endpoint, "endpoint");
  const p256dh = requireNonEmptyString(input.p256dh, "p256dh");
  const auth = requireNonEmptyString(input.auth, "auth");

  const userAgent =
    input.userAgent === null || typeof input.userAgent === "string"
      ? input.userAgent
      : undefined;

  await upsertWebPushSubscription({
    userId: user.id,
    endpoint,
    p256dh,
    auth,
    userAgent: userAgent ?? null,
  });

  return { success: true, subscribed: true };
}

export async function unsubscribeWebPushForViewer(
  user: AppUser,
  endpoint: unknown
): Promise<WebPushUnsubscribeResultContract> {
  const trimmed = requireNonEmptyString(endpoint, "endpoint");
  await removeWebPushSubscription(user.id, trimmed);
  return { success: true };
}
