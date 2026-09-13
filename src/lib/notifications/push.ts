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

import webpush from "web-push";
import { safeInternalHref } from "@/lib/notifications/display";
import { mapNotificationHrefForMobile } from "@/lib/notifications/mobile-href";
import {
  listPushTokensForUsers,
  removePushTokens,
} from "@/lib/notifications/push-tokens";
import { getVapidConfig } from "@/lib/notifications/vapid";
import {
  listWebPushSubscriptionsForUsers,
  removeWebPushSubscriptionsByEndpoints,
  type WebPushSubscriptionRow,
} from "@/lib/notifications/web-push-subscriptions";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_BATCH = 100;

export type PushDeliveryRow = {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  href: string | null;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body?: string;
  sound?: "default";
  data?: Record<string, string>;
};

type ExpoPushTicket =
  | { status: "ok"; id?: string }
  | {
      status: "error";
      message?: string;
      details?: { error?: string };
    };

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function buildMessages(
  rows: PushDeliveryRow[],
  tokensByUser: Map<string, string[]>
): ExpoPushMessage[] {
  const messages: ExpoPushMessage[] = [];

  for (const row of rows) {
    const tokens = tokensByUser.get(row.userId);
    if (!tokens || tokens.length === 0) continue;

    const href = safeInternalHref(row.href);
    const mobileHref = mapNotificationHrefForMobile(href);
    const data: Record<string, string> = { notificationId: row.id };
    if (mobileHref) data.mobileHref = mobileHref;
    if (href) data.href = href;

    for (const token of tokens) {
      messages.push({
        to: token,
        title: row.title,
        body: row.body ?? undefined,
        sound: "default",
        data,
      });
    }
  }

  return messages;
}

async function sendExpoBatch(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    return;
  }

  const payload = (await response.json().catch(() => null)) as {
    data?: ExpoPushTicket[];
  } | null;
  if (!payload?.data) return;

  const staleTokens: string[] = [];
  payload.data.forEach((ticket, index) => {
    if (ticket.status !== "error") return;
    const errorCode = ticket.details?.error;
    if (errorCode !== "DeviceNotRegistered" && errorCode !== "InvalidCredentials") {
      return;
    }
    const token = messages[index]?.to;
    if (token) staleTokens.push(token);
  });

  if (staleTokens.length > 0) {
    await removePushTokens(staleTokens);
  }
}

async function deliverExpoPush(rows: PushDeliveryRow[]): Promise<void> {
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const tokenRows = await listPushTokensForUsers(userIds);
  if (tokenRows.length === 0) return;

  const tokensByUser = new Map<string, string[]>();
  for (const row of tokenRows) {
    const existing = tokensByUser.get(row.userId) ?? [];
    existing.push(row.token);
    tokensByUser.set(row.userId, existing);
  }

  const messages = buildMessages(rows, tokensByUser);
  for (const batch of chunk(messages, MAX_BATCH)) {
    await sendExpoBatch(batch);
  }
}

function webPushStatusCode(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  if (!("statusCode" in error)) return null;
  const code = (error as { statusCode?: unknown }).statusCode;
  return typeof code === "number" ? code : null;
}

async function sendWebPushToSubscription(
  subscription: WebPushSubscriptionRow,
  row: PushDeliveryRow
): Promise<"ok" | "gone" | "error"> {
  const href = safeInternalHref(row.href);
  const payload = JSON.stringify({
    title: row.title,
    body: row.body ?? "",
    data: {
      notificationId: row.id,
      ...(href ? { href } : {}),
    },
  });

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      payload
    );
    return "ok";
  } catch (error) {
    const status = webPushStatusCode(error);
    if (status === 404 || status === 410) return "gone";
    return "error";
  }
}

async function deliverWebPush(rows: PushDeliveryRow[]): Promise<void> {
  const vapid = getVapidConfig();
  if (!vapid) return;

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const userIds = [...new Set(rows.map((row) => row.userId))];
  const subscriptions = await listWebPushSubscriptionsForUsers(userIds);
  if (subscriptions.length === 0) return;

  const byUser = new Map<string, WebPushSubscriptionRow[]>();
  for (const sub of subscriptions) {
    const existing = byUser.get(sub.userId) ?? [];
    existing.push(sub);
    byUser.set(sub.userId, existing);
  }

  const staleEndpoints: string[] = [];

  for (const row of rows) {
    const userSubs = byUser.get(row.userId);
    if (!userSubs || userSubs.length === 0) continue;

    for (const sub of userSubs) {
      const result = await sendWebPushToSubscription(sub, row);
      if (result === "gone") staleEndpoints.push(sub.endpoint);
    }
  }

  if (staleEndpoints.length > 0) {
    await removeWebPushSubscriptionsByEndpoints([...new Set(staleEndpoints)]);
  }
}

export async function deliverPushNotifications(
  rows: PushDeliveryRow[]
): Promise<void> {
  if (rows.length === 0) return;

  await Promise.all([deliverExpoPush(rows), deliverWebPush(rows)]);
}
