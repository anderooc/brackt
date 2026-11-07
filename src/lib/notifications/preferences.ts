/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userNotificationPreferences } from "@/lib/db/schema";
import type { UserNotificationKind } from "@/types";
import {
  appBaseUrl,
  getResendClient,
  tournamentEmailFromAddress,
} from "@/lib/email/resend";
import {
  emailButtonHtml,
  emailFinePrintHtml,
  emailLinkHtml,
  emailParagraphsHtml,
  renderBrandedEmail,
} from "@/lib/email/layout";
import {
  DEFAULT_NOTIFICATION_PREFERENCE,
  NOTIFICATION_KINDS,
  type NotificationPreference,
} from "@/lib/notifications/preferences-shared";

export type { NotificationPreference } from "@/lib/notifications/preferences-shared";
export { NOTIFICATION_KINDS } from "@/lib/notifications/preferences-shared";

export async function loadNotificationPreferencesForUser(
  userId: string
): Promise<Record<UserNotificationKind, NotificationPreference>> {
  const rows = await db
    .select()
    .from(userNotificationPreferences)
    .where(eq(userNotificationPreferences.userId, userId));

  const result = Object.fromEntries(
    NOTIFICATION_KINDS.map((kind) => [kind, { ...DEFAULT_NOTIFICATION_PREFERENCE }])
  ) as Record<UserNotificationKind, NotificationPreference>;

  for (const row of rows) {
    result[row.kind] = {
      pushEnabled: row.pushEnabled,
      emailEnabled: row.emailEnabled,
    };
  }

  return result;
}

export async function loadNotificationPreferencesForUsers(
  userIds: string[]
): Promise<Map<string, Record<UserNotificationKind, NotificationPreference>>> {
  if (userIds.length === 0) return new Map();

  const rows = await db
    .select()
    .from(userNotificationPreferences)
    .where(inArray(userNotificationPreferences.userId, userIds));

  const map = new Map<
    string,
    Record<UserNotificationKind, NotificationPreference>
  >();

  for (const userId of userIds) {
    map.set(
      userId,
      Object.fromEntries(
        NOTIFICATION_KINDS.map((kind) => [kind, { ...DEFAULT_NOTIFICATION_PREFERENCE }])
      ) as Record<UserNotificationKind, NotificationPreference>
    );
  }

  for (const row of rows) {
    const prefs = map.get(row.userId);
    if (!prefs) continue;
    prefs[row.kind] = {
      pushEnabled: row.pushEnabled,
      emailEnabled: row.emailEnabled,
    };
  }

  return map;
}

export async function saveNotificationPreferences(
  userId: string,
  prefs: Partial<Record<UserNotificationKind, NotificationPreference>>
): Promise<void> {
  const entries = NOTIFICATION_KINDS.flatMap((kind) => {
    const value = prefs[kind];
    if (!value) return [];
    return [
      {
        userId,
        kind,
        pushEnabled: value.pushEnabled,
        emailEnabled: value.emailEnabled,
      },
    ];
  });

  if (entries.length === 0) return;

  await db
    .insert(userNotificationPreferences)
    .values(entries)
    .onConflictDoUpdate({
      target: [
        userNotificationPreferences.userId,
        userNotificationPreferences.kind,
      ],
      set: {
        pushEnabled: sql`excluded.push_enabled`,
        emailEnabled: sql`excluded.email_enabled`,
      },
    });
}

export async function deliverNotificationEmails(
  rows: Array<{
    userId: string;
    kind: UserNotificationKind;
    title: string;
    body: string | null;
    href: string | null;
  }>,
  prefsByUser: Map<string, Record<UserNotificationKind, NotificationPreference>>
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { users } = await import("@/lib/db/schema");
  const userIds = [...new Set(rows.map((row) => row.userId))];
  const userRows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  const emailByUser = new Map(userRows.map((row) => [row.id, row.email]));

  for (const row of rows) {
    const prefs = prefsByUser.get(row.userId)?.[row.kind] ?? DEFAULT_NOTIFICATION_PREFERENCE;
    if (!prefs.emailEnabled) continue;

    const email = emailByUser.get(row.userId);
    if (!email) continue;

    const link = row.href ? `${appBaseUrl()}${row.href}` : appBaseUrl();
    const text = [
      row.title,
      row.body,
      `Open: ${link}`,
      `Notification settings: ${appBaseUrl()}/profile`,
    ]
      .filter(Boolean)
      .join("\n\n");

    try {
      await getResendClient().emails.send({
        from: tournamentEmailFromAddress(),
        to: email,
        subject: row.title,
        text,
        html: renderBrandedEmail({
          preheader: row.body ?? row.title,
          title: row.title,
          contentHtml: [
            row.body ? emailParagraphsHtml(row.body) : "",
            emailButtonHtml(link, "Open in brackt"),
            emailFinePrintHtml(
              `Choose which updates you get by email in your ${emailLinkHtml(`${appBaseUrl()}/profile`, "notification settings")}.`
            ),
          ].join(""),
          footer:
            "You received this because email notifications are on for this kind of update in your brackt account.",
        }),
      });
    } catch {
      // Email delivery is best-effort.
    }
  }
}
