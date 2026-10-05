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

import type {
  TournamentChatChannelContract,
  TournamentChatMessageContract,
} from "@/lib/api/contracts/tournament-ops";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {
  fetchTournamentChat,
  markTournamentChatRead,
  postTournamentChatMessage,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { supabase } from "~/auth/supabase";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { subscribeToTournamentChat } from "~/tournament/chat-realtime";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  BottomBar,
  Chip,
  ChipRow,
  EmptyState,
  haptics,
  HIT_TARGET,
  Icon,
  radius,
  SegmentedControl,
  space,
  type,
} from "~/ui";

type ChatListItem =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; key: string; message: TournamentChatMessageContract };

const NEAR_BOTTOM_PX = 80;

function localDayKey(iso: string): string {
  const date = new Date(iso);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function chatDayLabel(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return "Today";
  const today = new Date();
  const yesterday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - 1
  );
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, "0");
  const d = String(yesterday.getDate()).padStart(2, "0");
  if (dayKey === `${y}-${m}-${d}`) return "Yesterday";

  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(
    undefined,
    {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: year === today.getFullYear() ? undefined : "numeric",
    }
  );
}

function buildChatListItems(
  messages: TournamentChatMessageContract[]
): ChatListItem[] {
  const todayKey = localDayKey(new Date().toISOString());
  const items: ChatListItem[] = [];
  let lastDay: string | null = null;

  for (const message of messages) {
    const day = localDayKey(message.createdAt);
    if (day !== lastDay) {
      items.push({
        kind: "date",
        key: `date-${day}`,
        label: chatDayLabel(day, todayKey),
      });
      lastDay = day;
    }
    items.push({ kind: "message", key: message.id, message });
  }

  return items;
}

function authorLabel(message: TournamentChatMessageContract): string {
  if (message.isOrganizerMessage) return "Host";
  return message.teamName
    ? `${message.authorName} · ${message.teamName}`
    : message.authorName;
}

function MessageBubble({ message }: { message: TournamentChatMessageContract }) {
  const colors = useThemeColors();
  const own = message.isOwn;
  const time = new Date(message.createdAt).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <View
      style={[styles.bubbleWrap, own ? styles.bubbleWrapOwn : styles.bubbleWrapOther]}
      accessible
      accessibilityLabel={`${own ? "You" : authorLabel(message)}, ${time}. ${message.body}`}
    >
      {!own ? (
        <AppText
          variant="caption"
          weight="600"
          tone={message.isOrganizerMessage ? "primary" : "muted"}
          style={styles.author}
        >
          {authorLabel(message)}
        </AppText>
      ) : null}
      <View
        style={[
          styles.bubble,
          own
            ? {
                backgroundColor: withAlpha(colors.primary, 0.12),
                borderBottomRightRadius: radius.sm / 2,
              }
            : {
                backgroundColor: colors.muted,
                borderBottomLeftRadius: radius.sm / 2,
              },
        ]}
      >
        <AppText>{message.body}</AppText>
      </View>
      <AppText variant="caption" tone="muted" style={styles.time}>
        {time}
      </AppText>
    </View>
  );
}

function SendButton({
  onPress,
  disabled,
  busy,
}: {
  onPress: () => void;
  disabled: boolean;
  busy: boolean;
}) {
  const colors = useThemeColors();
  const inactive = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Send message"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.send,
        {
          backgroundColor: inactive
            ? colors.muted
            : pressed
              ? withAlpha(colors.primary, 0.85)
              : colors.primary,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.mutedForeground} size="small" />
      ) : (
        <Icon
          name="send"
          size={18}
          color={inactive ? colors.mutedForeground : colors.primaryForeground}
        />
      )}
    </Pressable>
  );
}

export default function ChatScreen() {
  const colors = useThemeColors();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [channelKind, setChannelKind] = useState<string | null>(null);
  const [teamSlug, setTeamSlug] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatListItem>>(null);
  const nearBottom = useRef(true);
  const hasScrolled = useRef(false);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentChat(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, poll } = usePublicLoader(
    load,
    "Could not load chat."
  );

  useEffect(() => {
    if (!data?.tournamentId) return;
    return subscribeToTournamentChat(supabase, data.tournamentId, () => {
      void poll();
    });
  }, [data?.tournamentId, poll]);

  useEffect(() => {
    if (!data) return;
    if (!channelKind && data.channels[0]) {
      setChannelKind(data.channels[0].kind);
    }
    if (!teamSlug && data.speakingTeams[0]) {
      setTeamSlug(data.speakingTeams[0].slug);
    }
  }, [data, channelKind, teamSlug]);

  useEffect(() => {
    if (!slug || !channelKind || !data) return;
    const channel = data.channels.find((item) => item.kind === channelKind);
    if (!channel || channel.unreadCount === 0) return;
    void markTournamentChatRead(slug, channelKind).catch(() => undefined);
  }, [slug, channelKind, data]);

  useEffect(() => {
    nearBottom.current = true;
    hasScrolled.current = false;
  }, [channelKind]);

  const channel: TournamentChatChannelContract | null = useMemo(() => {
    if (!data || !channelKind) return null;
    return data.channels.find((item) => item.kind === channelKind) ?? null;
  }, [data, channelKind]);

  const listItems = useMemo(
    () => buildChatListItems(channel?.messages ?? []),
    [channel?.messages]
  );

  const scrollToNewest = useCallback(() => {
    if (!nearBottom.current) return;
    listRef.current?.scrollToEnd({ animated: hasScrolled.current });
    hasScrolled.current = true;
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      nearBottom.current =
        contentSize.height - (contentOffset.y + layoutMeasurement.height) <
        NEAR_BOTTOM_PX;
    },
    []
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (data === null && error === null) return <LoadingScreen />;
  if (!data || !slug) {
    return (
      <ErrorScreen
        title="Chat unavailable"
        message={error ?? "Could not load chat."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function onSend() {
    const body = draft.trim();
    if (!channel || !body || !data || busy) return;
    const speakingTeams = data.speakingTeams;
    setBusy(true);
    setActionError(null);
    try {
      await postTournamentChatMessage(slug, {
        channelKind: channel.kind,
        body,
        teamSlug: speakingTeams.length > 1 ? teamSlug ?? undefined : undefined,
      });
      setDraft("");
      nearBottom.current = true;
      await refresh();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not send message."));
    } finally {
      setBusy(false);
    }
  }

  const channelOptions = data.channels.map((item) => ({
    id: item.kind,
    label: item.label,
    count: item.unreadCount,
  }));
  const canSend = Boolean(draft.trim()) && !busy;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      {data.channels.length > 1 || channel?.description ? (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          {data.channels.length > 1 && data.channels.length <= 3 ? (
            <SegmentedControl
              accessibilityLabel="Chat channel"
              options={channelOptions}
              value={channelKind ?? data.channels[0]!.kind}
              onChange={setChannelKind}
            />
          ) : data.channels.length > 3 ? (
            <ChipRow>
              {channelOptions.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  count={option.count > 0 ? option.count : undefined}
                  selected={option.id === channelKind}
                  onPress={() => setChannelKind(option.id)}
                />
              ))}
            </ChipRow>
          ) : null}
          {channel?.description ? (
            <AppText variant="footnote" tone="muted">
              {channel.description}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        style={styles.fill}
        data={listItems}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[
          styles.messages,
          listItems.length === 0 && styles.messagesEmpty,
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={scrollToNewest}
        onLayout={scrollToNewest}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="No messages yet"
            message={
              channel?.canPost
                ? "Start the conversation. Messages here are visible to everyone in this channel."
                : "Messages from the host will show up here."
            }
          />
        }
        renderItem={({ item }) => {
          if (item.kind === "date") {
            return (
              <AppText
                variant="caption"
                tone="muted"
                weight="600"
                accessibilityRole="header"
                style={styles.dateLabel}
              >
                {item.label}
              </AppText>
            );
          }
          return <MessageBubble message={item.message} />;
        }}
      />

      <BottomBar>
        {actionError ? (
          <Banner
            tone="error"
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        ) : null}
        {channel?.canPost ? (
          <>
            {data.speakingTeams.length > 1 ? (
              <View style={styles.postingAs}>
                <AppText variant="footnote" tone="muted">
                  Posting as
                </AppText>
                <ChipRow>
                  {data.speakingTeams.map((team) => (
                    <Chip
                      key={team.slug}
                      label={team.name}
                      selected={team.slug === teamSlug}
                      onPress={() => setTeamSlug(team.slug)}
                    />
                  ))}
                </ChipRow>
              </View>
            ) : null}
            <View style={styles.composeRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a message"
                placeholderTextColor={colors.mutedForeground}
                accessibilityLabel="Message"
                multiline
                maxLength={2000}
                autoCapitalize="sentences"
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <SendButton
                busy={busy}
                disabled={!canSend}
                onPress={() => void onSend()}
              />
            </View>
          </>
        ) : (
          <View style={styles.readOnly}>
            <Icon name="lock-closed-outline" size={16} tone="muted" />
            <AppText variant="footnote" tone="muted" style={styles.fill}>
              {data.canPost
                ? "Only the host can post in this channel."
                : "Chat is read-only for this tournament."}
            </AppText>
          </View>
        )}
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  messages: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    gap: space.md,
  },
  messagesEmpty: { flexGrow: 1, justifyContent: "center" },
  dateLabel: { textAlign: "center", paddingTop: space.sm },
  bubbleWrap: { maxWidth: "82%", gap: space.xs },
  bubbleWrapOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleWrapOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  author: { paddingHorizontal: space.xs },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
  },
  time: { paddingHorizontal: space.xs },
  postingAs: { gap: space.xs },
  composeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    ...type.body,
    minHeight: HIT_TARGET,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space.md + 2,
    paddingTop: space.md - 1,
    paddingBottom: space.md - 1,
  },
  send: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  readOnly: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: HIT_TARGET,
  },
});
