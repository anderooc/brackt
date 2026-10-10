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
  TournamentDetailContract,
  TournamentMatchContract,
  TournamentTeamContract,
} from "@/lib/api/contracts/tournament";
import type { TournamentParticipationContract } from "@/lib/api/contracts/tournament-ops";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import {
  fetchTournament,
  fetchTournamentMatches,
  fetchTournamentParticipation,
  fetchTournamentTeams,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { usePolling } from "~/lib/use-polling";
import { TournamentMatchesPanel } from "~/tournament/matches-panel";
import { TournamentOverview } from "~/tournament/overview";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { TournamentTeamsPanel } from "~/tournament/teams-panel";
import { messageFor as loaderMessageFor } from "~/tournament/use-public-loader";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Banner,
  EmptyState,
  HIT_TARGET,
  Icon,
  ScreenScroll,
  SegmentedControl,
  SkeletonList,
  space,
} from "~/ui";

type TabId = "overview" | "teams" | "matches";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams" },
  { id: "matches", label: "Matches" },
];

export default function TournamentDetailScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug, tab: tabParam } = useLocalSearchParams<{
    slug: string;
    tab?: string;
  }>();

  const initialTab: TabId =
    tabParam === "teams" || tabParam === "matches" ? tabParam : "overview";
  const [tab, setTab] = useState<TabId>(initialTab);

  useEffect(() => {
    if (tabParam === "teams" || tabParam === "matches" || tabParam === "overview") {
      setTab(tabParam);
    }
  }, [tabParam]);
  const [tournament, setTournament] = useState<TournamentDetailContract | null>(
    null
  );
  const [participation, setParticipation] =
    useState<TournamentParticipationContract | null>(null);
  const [teams, setTeams] = useState<TournamentTeamContract[] | null>(null);
  const [matches, setMatches] = useState<TournamentMatchContract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teamsError, setTeamsError] = useState<string | null>(null);
  const [matchesError, setMatchesError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadOverview = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return;
      // Wait for auth so Team tools can load with the rest of the overview.
      if (sessionLoading) return;
      try {
        setError(null);
        if (!session) {
          const detail = await fetchTournament(slug, signal);
          if (signal?.aborted) return;
          setTournament(detail);
          setParticipation(null);
          return;
        }
        const [detail, part] = await Promise.all([
          fetchTournament(slug, signal),
          fetchTournamentParticipation(slug, signal).catch(() => null),
        ]);
        if (signal?.aborted) return;
        setTournament(detail);
        setParticipation(part);
      } catch (cause) {
        if (signal?.aborted) return;
        setError(messageFor(cause, "Could not load this tournament."));
      }
    },
    [session, sessionLoading, slug]
  );

  const loadTeams = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return;
      try {
        setTeamsError(null);
        const result = await fetchTournamentTeams(slug, signal);
        if (signal?.aborted) return;
        setTeams(result.teams);
      } catch (cause) {
        if (signal?.aborted) return;
        setTeamsError(loaderMessageFor(cause, "Could not load teams."));
      }
    },
    [slug]
  );

  const loadMatches = useCallback(
    async (signal?: AbortSignal) => {
      if (!slug) return;
      try {
        setMatchesError(null);
        const result = await fetchTournamentMatches(slug, signal);
        if (signal?.aborted) return;
        setMatches(result.matches);
      } catch (cause) {
        if (signal?.aborted) return;
        setMatchesError(loaderMessageFor(cause, "Could not load matches."));
      }
    },
    [slug]
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void loadOverview(controller.signal);
      return () => controller.abort();
    }, [loadOverview])
  );

  useEffect(() => {
    if (tab !== "teams" || teams !== null || teamsError !== null) return;
    const controller = new AbortController();
    void loadTeams(controller.signal);
    return () => controller.abort();
  }, [tab, teams, teamsError, loadTeams]);

  useEffect(() => {
    if (tab !== "matches" || matches !== null || matchesError !== null) return;
    const controller = new AbortController();
    void loadMatches(controller.signal);
    return () => controller.abort();
  }, [tab, matches, matchesError, loadMatches]);

  const pollMatches = useCallback(async () => {
    if (!slug) return;
    try {
      const result = await fetchTournamentMatches(slug);
      setMatches(result.matches);
    } catch {
      // Keep the last good list; pull-to-refresh surfaces errors.
    }
  }, [slug]);

  usePolling(pollMatches, 15000, tab === "matches" && matches !== null);

  useLayoutEffect(() => {
    const canGoBack = navigation.canGoBack();
    navigation.setOptions({
      title: tournament?.name ?? "Tournament",
      headerBackTitle: "Tournaments",
      animationTypeForReplace: "pop",
      // Native back only appears when the stack has history. Deep links / cold
      // starts land here as the root screen, so provide an explicit fallback.
      headerLeft: canGoBack
        ? undefined
        : () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Tournaments"
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              onPress={() => router.replace("/tournaments")}
              style={({ pressed }) => [
                styles.headerBack,
                { opacity: pressed ? 0.5 : 1 },
              ]}
            >
              <Icon name="chevron-back" size={24} color={colors.primary} />
              <AppText variant="body" tone="primary">
                Tournaments
              </AppText>
            </Pressable>
          ),
    });
  }, [colors.primary, navigation, router, tournament?.name]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    // Only the visible tab is refetched in place; hidden tabs reload on next visit.
    if (tab !== "teams") {
      setTeams(null);
      setTeamsError(null);
    }
    if (tab !== "matches") {
      setMatches(null);
      setMatchesError(null);
    }
    if (tab === "teams" && teams === null) setTeamsError(null);
    if (tab === "matches" && matches === null) setMatchesError(null);
    await Promise.all([
      loadOverview(),
      tab === "teams" && teams !== null ? loadTeams() : null,
      tab === "matches" && matches !== null ? loadMatches() : null,
    ]);
    setIsRefreshing(false);
  }, [loadOverview, loadTeams, loadMatches, tab, teams, matches]);

  const selectTab = useCallback(
    (next: TabId) => {
      setTab(next);
      router.setParams({ tab: next });
    },
    [router]
  );

  if (!slug) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="help-circle-outline"
          title="Tournament not found"
          message="This link is missing the tournament. Browse the list to find it."
          action={{ label: "Browse tournaments", onPress: () => router.replace("/tournaments") }}
        />
      </View>
    );
  }

  if (tournament === null && error === null) return <LoadingScreen />;

  if (!tournament) {
    return (
      <ErrorScreen
        title="Tournament unavailable"
        message={error ?? "Could not load this tournament."}
        onRetry={() => void loadOverview()}
      />
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.tabs,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <SegmentedControl
          accessibilityLabel="Tournament sections"
          options={TABS}
          value={tab}
          onChange={selectTab}
        />
      </View>

      <ScreenScroll refreshing={isRefreshing} onRefresh={onRefresh}>
        {error ? (
          <Banner
            tone="error"
            title="Could not refresh"
            message={error}
            action={{ label: "Try again", onPress: () => void loadOverview() }}
          />
        ) : null}

        {tab === "overview" ? (
          <TournamentOverview
            tournament={tournament}
            participation={participation}
          />
        ) : null}

        {tab === "teams" && teams !== null && teamsError ? (
          <Banner tone="error" message={teamsError} onDismiss={() => setTeamsError(null)} />
        ) : null}
        {tab === "matches" && matches !== null && matchesError ? (
          <Banner
            tone="error"
            message={matchesError}
            onDismiss={() => setMatchesError(null)}
          />
        ) : null}

        {tab === "teams" ? (
          teams !== null ? (
            <TournamentTeamsPanel teams={teams} />
          ) : teamsError ? (
            <Banner
              tone="error"
              title="Teams unavailable"
              message={teamsError}
              action={{ label: "Try again", onPress: () => setTeamsError(null) }}
            />
          ) : (
            <SkeletonList rows={6} header={false} />
          )
        ) : null}

        {tab === "matches" ? (
          matches !== null ? (
            <TournamentMatchesPanel
              matches={matches}
              tournamentSlug={tournament.slug}
            />
          ) : matchesError ? (
            <Banner
              tone="error"
              title="Matches unavailable"
              message={matchesError}
              action={{ label: "Try again", onPress: () => setMatchesError(null) }}
            />
          ) : (
            <SkeletonList rows={4} header={false} />
          )
        ) : null}
      </ScreenScroll>
    </View>
  );
}

function messageFor(cause: unknown, fallback: string): string {
  if (cause instanceof ApiClientError && cause.code === "not_found") {
    return "This tournament is not posted, or the link is out of date.";
  }
  return loaderMessageFor(cause, fallback);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center" },
  headerBack: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: HIT_TARGET,
    marginLeft: -space.sm,
  },
  tabs: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
