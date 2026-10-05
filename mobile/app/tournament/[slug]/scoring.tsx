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
  PublicMatchStatus,
  TournamentMatchContract,
} from "@/lib/api/contracts/tournament";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fetchTournamentMatches } from "~/api/endpoints";
import { usePolling } from "~/lib/use-polling";
import { MatchRow } from "~/tournament/match-row";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { usePublicLoader } from "~/tournament/use-public-loader";
import { Banner, EmptyState, ScreenScroll, SegmentedControl, space } from "~/ui";

type BoardTab = PublicMatchStatus;

const TABS: { id: BoardTab; label: string }[] = [
  { id: "in_progress", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Final" },
];

export default function ScoringScreen() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [chosenTab, setChosenTab] = useState<BoardTab | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) throw new Error("Tournament not found.");
      return (await fetchTournamentMatches(slug, signal)).matches;
    },
    [slug]
  );

  const { data, error, refreshError, isRefreshing, reload, refresh, poll } =
    usePublicLoader(load, "Could not load scores.");

  usePolling(poll, 8000, data !== null);

  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Scores unavailable"
        message={error ?? "Could not load scores."}
        onRetry={() => void reload()}
      />
    );
  }

  const grouped: Record<BoardTab, TournamentMatchContract[]> = {
    in_progress: data.filter((match) => match.status === "in_progress"),
    upcoming: data.filter((match) => match.status === "upcoming"),
    completed: data.filter((match) => match.status === "completed"),
  };
  const tab: BoardTab =
    chosenTab ??
    (grouped.in_progress.length > 0
      ? "in_progress"
      : grouped.upcoming.length > 0
        ? "upcoming"
        : grouped.completed.length > 0
          ? "completed"
          : "in_progress");
  const visible = grouped[tab];

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh} gap={space.lg}>
      <SegmentedControl
        accessibilityLabel="Match status"
        options={TABS.map((item) => ({ ...item, count: grouped[item.id].length }))}
        value={tab}
        onChange={setChosenTab}
      />

      {refreshError ? <Banner tone="error" message={refreshError} /> : null}

      {visible.length === 0 ? (
        <EmptyState
          icon={data.length === 0 ? "trophy-outline" : "time-outline"}
          title={emptyTitle(tab, data.length === 0)}
          message={emptyCopy(tab, data.length === 0)}
        />
      ) : (
        <View style={styles.list}>
          {visible.map((match) => (
            <MatchRow
              key={match.slug}
              match={match}
              onPress={() => router.push(`/tournament/${slug}/matches/${match.slug}`)}
            />
          ))}
        </View>
      )}
    </ScreenScroll>
  );
}

function emptyTitle(tab: BoardTab, nonePosted: boolean): string {
  if (nonePosted) return "No matches posted yet";
  if (tab === "in_progress") return "Nothing live right now";
  if (tab === "upcoming") return "No upcoming matches";
  return "No finals yet";
}

function emptyCopy(tab: BoardTab, nonePosted: boolean): string {
  if (nonePosted) {
    return "Scores appear here once the host releases pools or brackets.";
  }
  if (tab === "in_progress") return "Check Upcoming for what’s next. This page updates on its own.";
  if (tab === "upcoming") return "Every scheduled match has started or finished.";
  return "Completed matches show up here as they finish.";
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
});
