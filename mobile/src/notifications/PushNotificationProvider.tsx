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

import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useRef, type ReactNode } from "react";
import { registerBeforeSignOut, useSession } from "~/auth/session";
import {
  acquireExpoPushToken,
  clearPushTokenOnServer,
  configurePushNotifications,
  extractMobileHrefFromNotification,
  syncPushTokenWithServer,
} from "~/notifications/push";

export function PushNotificationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { session, isLoading } = useSession();
  const tokenRef = useRef<string | null>(null);
  const handledResponseRef = useRef<string | null>(null);

  useEffect(() => {
    configurePushNotifications();
  }, []);

  useEffect(
    () =>
      registerBeforeSignOut(async () => {
        const token = tokenRef.current;
        tokenRef.current = null;
        if (token) await clearPushTokenOnServer(token);
      }),
    []
  );

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      tokenRef.current = null;
      return;
    }

    let active = true;
    void (async () => {
      try {
        const token = await acquireExpoPushToken();
        if (!active || !token) return;
        tokenRef.current = token;
        await syncPushTokenWithServer(token);
      } catch {
        // Registration retries on next sign-in / app launch.
      }
    })();

    return () => {
      active = false;
    };
  }, [isLoading, session]);

  useEffect(() => {
    const openFromResponse = (
      response: Notifications.NotificationResponse | null
    ) => {
      if (!response) return;
      // A cold-start tap is reported by both the listener and
      // getLastNotificationResponseAsync.
      const id = response.notification.request.identifier;
      if (handledResponseRef.current === id) return;
      handledResponseRef.current = id;

      const mobileHref = extractMobileHrefFromNotification(
        response.notification.request.content.data as Record<string, unknown>
      );
      router.push((mobileHref ?? "/notifications") as never);
    };

    void Notifications.getLastNotificationResponseAsync().then(openFromResponse);

    const subscription =
      Notifications.addNotificationResponseReceivedListener(openFromResponse);
    return () => subscription.remove();
  }, [router]);

  return children;
}
