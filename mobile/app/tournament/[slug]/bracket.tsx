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

import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { fetchTournamentPlay } from "~/api/endpoints";
import { BRACKET_TYPE_LABELS } from "~/lib/format";
import { usePolling } from "~/lib/use-polling";
import { DrawnBracket } from "~/tournament/bracket-draw";
import { flattenBrackets, type DisplayBracket } from "~/tournament/flatten-brackets";
import { HostSettingsEntry } from "~/tournament/host-settings-entry";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { usePublicLoader } from "~/tournament/use-public-loader";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Banner,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Icon,
  ScreenScroll,
  space,
} from "~/ui";

const ALL = "__all__";

function bracketKey(bracket: DisplayBracket): string {
  return `${bracket.tier}-${bracket.name}-${bracket.contextName ?? ""}`;
}

function bracketLabel(bracket: DisplayBracket): string {
  return bracket.contextName
    ? `${bracket.name} · ${bracket.contextName}`
    : bracket.name;
}

export default function BracketScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [filter, setFilter] = useState<string>(ALL);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!slug) return Promise.reject(new Error("Tournament not found."));
      return fetchTournamentPlay(slug, signal);
    },
    [slug]
  );

  const { data, error, refreshError, isRefreshing, reload, refresh, poll, clearError } =
    usePublicLoader(load, "Could not load the bracket.");

  usePolling(
    poll,
    15000,
    data?.divisions.some((division) => division.released) ?? false
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Bracket" });
  }, [navigation]);

  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Bracket unavailable"
        message={error ?? "Could not load the bracket."}
        onRetry={() => void reload()}
      />
    );
  }

  const brackets = flattenBrackets(data);
  const anyReleased = data.divisions.some((division) => division.released);
  const visible =
    filter === ALL || !brackets.some((bracket) => bracketKey(bracket) === filter)
      ? brackets
      : brackets.filter((bracket) => bracketKey(bracket) === filter);

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh} gap={space.xl}>
      {refreshError ? (
        <Banner tone="error" message={refreshError} onDismiss={clearError} />
      ) : null}
      {slug ? (
        <HostSettingsEntry
          slug={slug}
          href={`/tournament/${slug}/settings/bracket`}
          title="Bracket settings"
          detail="Gold / silver / bronze structure"
        />
      ) : null}
      {data.divisions.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="No bracket yet"
          message="The bracket lands here after the host releases play."
        />
      ) : !anyReleased ? (
        <EmptyState
          icon="time-outline"
          title="Bracket not released"
          message="The host has not released this bracket yet. Pull down to check again."
        />
      ) : brackets.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="Waiting on pool play"
          message="Bracket rounds appear after pool play is seeded."
          action={{
            label: "View pools",
            icon: "grid-outline",
            onPress: () => router.push(`/tournament/${slug}/pools`),
          }}
        />
      ) : (
        <>
          {brackets.length > 1 ? (
            <ChipRow>
              <Chip
                label="All"
                selected={filter === ALL}
                onPress={() => setFilter(ALL)}
              />
              {brackets.map((bracket) => (
                <Chip
                  key={bracketKey(bracket)}
                  label={bracketLabel(bracket)}
                  selected={filter === bracketKey(bracket)}
                  onPress={() => setFilter(bracketKey(bracket))}
                />
              ))}
            </ChipRow>
          ) : null}
          {visible.map((bracket) => (
            <BracketSection
              key={bracketKey(bracket)}
              bracket={bracket}
              onMatchPress={(matchSlug) =>
                router.push(`/tournament/${slug}/matches/${matchSlug}`)
              }
            />
          ))}
        </>
      )}
    </ScreenScroll>
  );
}

function BracketSection({
  bracket,
  onMatchPress,
}: {
  bracket: DisplayBracket;
  onMatchPress: (matchSlug: string) => void;
}) {
  const colors = useThemeColors();
  const typeLabel = BRACKET_TYPE_LABELS[bracket.type];
  const showType = bracket.type === "double_elimination";
  const reduceMotion = useReduceMotion();
  const hintOpacity = useRef(new Animated.Value(1)).current;
  const hintDismissed = useRef(false);

  const dismissHint = useCallback(() => {
    if (hintDismissed.current) return;
    hintDismissed.current = true;
    if (reduceMotion) {
      hintOpacity.setValue(0);
      return;
    }
    Animated.timing(hintOpacity, {
      toValue: 0,
      duration: 1400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [hintOpacity, reduceMotion]);

  const onBracketScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(event.nativeEvent.contentOffset.x) < 16) return;
      dismissHint();
    },
    [dismissHint]
  );

  const meta = [bracket.contextName, showType ? typeLabel : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card padded={false} style={styles.section}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <AppText variant="headline" accessibilityRole="header">
          {bracket.name} bracket
        </AppText>
        {meta ? (
          <AppText variant="footnote" tone="muted">
            {meta}
          </AppText>
        ) : null}
      </View>
      {bracket.matches.length === 0 ? (
        <EmptyState
          compact
          icon="hourglass-outline"
          title="Not seeded yet"
          message="Seeds automatically when pool play finishes."
        />
      ) : (
        <>
          <Animated.View style={[styles.hint, { opacity: hintOpacity }]}>
            <Icon name="swap-horizontal" size={14} tone="muted" />
            <AppText variant="caption" tone="muted">
              Swipe sideways to see later rounds
            </AppText>
          </Animated.View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.draw}
            onScroll={onBracketScroll}
            scrollEventThrottle={16}
          >
            <DrawnBracket
              matches={bracket.matches}
              onMatchPress={onMatchPress}
            />
          </ScrollView>
        </>
      )}
    </Card>
  );
}

function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => sub.remove();
  }, []);
  return reduceMotion;
}

const styles = StyleSheet.create({
  section: { overflow: "hidden" },
  header: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: space.xxs,
  },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  draw: { paddingHorizontal: space.lg, paddingVertical: space.md },
});
