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

import type { NotificationItemContract } from "@/lib/api/contracts/notifications";
import { Redirect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fetchNotifications, markNotificationsRead } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { formatRelativeTime } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import { useNotificationsRealtimeRevision } from "~/notifications/NotificationsRealtimeProvider";
import {
  AppText,
  Banner,
  EmptyState,
  haptics,
  HeaderButton,
  Icon,
  ListGroup,
  radius,
  ScreenScroll,
  space,
  Tappable,
} from "~/ui";

function NotificationRow({
  item,
  onPress,
}: {
  item: NotificationItemContract;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const isUnread = !item.readAt;
  const when = item.createdAt ? formatRelativeTime(item.createdAt) : "";
  const meta = [item.kindLabel, when].filter(Boolean).join(" · ");

  return (
    <Tappable
      onPress={onPress}
      accessibilityLabel={[isUnread ? "Unread" : null, item.title, item.body, meta]
        .filter(Boolean)
        .join(". ")}
      accessibilityHint={item.mobileHref ? "Opens the related page" : undefined}
      style={styles.row}
    >
      <View style={styles.dotColumn}>
        {isUnread ? (
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        ) : null}
      </View>
      <View style={styles.rowText}>
        <AppText variant="caption" tone="muted" numberOfLines={1}>
          {meta}
        </AppText>
        <AppText variant="callout" weight={isUnread ? "700" : "400"}>
          {item.title}
        </AppText>
        {item.body ? (
          <AppText variant="footnote" tone="muted" numberOfLines={3}>
            {item.body}
          </AppText>
        ) : null}
      </View>
      {item.mobileHref ? (
        <Icon name="chevron-forward" size={18} tone="muted" />
      ) : null}
    </Tappable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { session, isLoading: sessionLoading } = useSession();
  const [items, setItems] = useState<NotificationItemContract[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchNotifications({ limit: 80, signal }),
    []
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load notifications."
  );
  const notificationsRevision = useNotificationsRealtimeRevision();

  useEffect(() => {
    if (!session) return;
    void reload(undefined, "silent");
  }, [notificationsRevision, reload, session]);

  useEffect(() => {
    if (!data) return;
    setItems(data.notifications);
    setUnreadCount(data.unreadCount);
  }, [data]);

  const notifications = items ?? data?.notifications ?? null;
  const unread = items
    ? items.filter((row) => !row.readAt).length
    : (data?.unreadCount ?? unreadCount);

  const markOne = useCallback(
    async (item: NotificationItemContract) => {
      if (item.readAt) return;
      const readAt = new Date().toISOString();
      setItems((prev) =>
        (prev ?? []).map((row) =>
          row.id === item.id ? { ...row, readAt } : row
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        const result = await markNotificationsRead([item.id]);
        setUnreadCount(result.unreadCount);
      } catch {
        // Best-effort; inbox will refresh on next load.
      }
    },
    []
  );

  const markAll = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    const readAt = new Date().toISOString();
    setItems((prev) =>
      (prev ?? []).map((row) => ({ ...row, readAt: row.readAt ?? readAt }))
    );
    setUnreadCount(0);
    try {
      const result = await markNotificationsRead();
      setUnreadCount(result.unreadCount);
      haptics.success();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not mark notifications read."));
      void refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const openItem = useCallback(
    (item: NotificationItemContract) => {
      void markOne(item);
      if (item.mobileHref) {
        router.push(item.mobileHref as never);
      }
    },
    [markOne, router]
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight:
        unread > 0
          ? () => (
              <HeaderButton
                label="Mark all read"
                disabled={busy}
                onPress={() => void markAll()}
              />
            )
          : undefined,
    });
  }, [navigation, unread, busy, markAll]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (error && !notifications) {
    return (
      <ErrorScreen
        title="Notifications unavailable"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  if (!notifications) return <LoadingScreen rows={6} />;

  return (
    <ScreenScroll
      refreshing={isRefreshing}
      onRefresh={() => void refresh()}
      gap={space.lg}
    >
      {error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: () => void refresh() }}
        />
      ) : null}
      {actionError ? (
        <Banner
          tone="error"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}

      {notifications.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No notifications yet"
          message="Tournament updates, host messages, registration changes, and school join requests will show up here."
        />
      ) : (
        <>
          <AppText variant="footnote" tone="muted">
            {unread > 0
              ? `${unread} unread notification${unread === 1 ? "" : "s"}`
              : "You're all caught up."}
          </AppText>
          <ListGroup>
            {notifications.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onPress={() => openItem(item)}
              />
            ))}
          </ListGroup>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.md,
    paddingRight: space.lg,
    paddingLeft: space.sm,
    minHeight: 56,
  },
  dotColumn: {
    width: space.md,
    alignItems: "center",
    alignSelf: "flex-start",
    paddingTop: space.xl + space.xxs,
  },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.full },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
});
