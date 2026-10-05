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

import type { SchoolListItemContract } from "@/lib/api/contracts/school";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, TextInput, View } from "react-native";
import { ApiClientError } from "~/api/client";
import { fetchSchools } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  GENDER_LABELS,
  REGION_LABELS,
  SCHOOL_VERIFICATION_LABELS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import {
  AppText,
  Badge,
  Banner,
  EmptyState,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  radius,
  space,
  statusTone,
} from "~/ui";

export default function SchoolsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [schools, setSchools] = useState<SchoolListItemContract[]>([]);
  const [mySchool, setMySchool] = useState<{
    slug: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const hasSearch = debouncedQuery.length > 0;

  const loadMine = useCallback(async (signal?: AbortSignal) => {
    const page = await fetchSchools({ limit: 1 }, signal);
    setMySchool(page.mySchool);
    setError(null);
  }, []);

  const loadSearch = useCallback(
    async (signal?: AbortSignal) => {
      if (!debouncedQuery) {
        setSchools([]);
        return;
      }
      setIsSearching(true);
      try {
        const page = await fetchSchools(
          { q: debouncedQuery, limit: 50 },
          signal
        );
        setSchools(page.schools);
        setMySchool(page.mySchool);
        setError(null);
      } finally {
        if (!signal?.aborted) setIsSearching(false);
      }
    },
    [debouncedQuery]
  );

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = new AbortController();
      void loadMine(controller.signal)
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            cause instanceof ApiClientError
              ? cause.message
              : "Could not load schools."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setReady(true);
        });
      return () => controller.abort();
    }, [session, loadMine])
  );

  useEffect(() => {
    if (!session || !ready) return;
    if (!hasSearch) {
      setSchools([]);
      setIsSearching(false);
      return;
    }
    const controller = new AbortController();
    void loadSearch(controller.signal).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setSchools([]);
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not load schools."
      );
    });
    return () => controller.abort();
  }, [session, ready, hasSearch, loadSearch]);

  const sorted = useMemo(() => {
    return [...schools].sort((a, b) => {
      if (a.matchesViewerEmail !== b.matchesViewerEmail) {
        return a.matchesViewerEmail ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [schools]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!ready && error === null) return <LoadingScreen />;
  if (!ready && error) {
    return (
      <ErrorScreen
        title="Couldn’t load schools"
        message={error}
        onRetry={() => void loadMine()}
      />
    );
  }

  return (
    <ScreenScroll
      gap={space.xl}
      refreshing={isRefreshing}
      onRefresh={async () => {
        setIsRefreshing(true);
        try {
          await loadMine();
          if (hasSearch) await loadSearch();
        } finally {
          setIsRefreshing(false);
        }
      }}
    >
      <View
        style={[
          styles.search,
          { backgroundColor: colors.muted },
        ]}
      >
        <Icon name="search" size={18} tone="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by school or university"
          placeholderTextColor={colors.mutedForeground}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search schools"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
        {isSearching ? <ActivityIndicator size="small" color={colors.mutedForeground} /> : null}
      </View>

      {error ? <Banner tone="error" message={error} /> : null}

      {!hasSearch ? (
        <Section title={mySchool ? "Your school" : "Get started"}>
          <ListGroup>
            {mySchool ? (
              <ListRow
                icon="school"
                iconTone="secondary"
                title={mySchool.name}
                onPress={() => router.push(`/schools/${mySchool.slug}`)}
              />
            ) : (
              <ListRow
                icon="add-circle-outline"
                title="Create a school"
                subtitle="Set up your club’s page if it isn’t listed"
                onPress={() => router.push("/schools/new")}
              />
            )}
          </ListGroup>
          <AppText variant="footnote" tone="muted">
            Search above to find your club and request to join its roster.
          </AppText>
        </Section>
      ) : sorted.length === 0 ? (
        isSearching ? null : (
          <EmptyState
            icon="search-outline"
            title="No schools found"
            message={`Nothing matches “${debouncedQuery}”. Check the spelling, or create the school if it isn’t listed.`}
            action={
              mySchool
                ? undefined
                : { label: "Create school", icon: "add", onPress: () => router.push("/schools/new") }
            }
          />
        )
      ) : (
        <ListGroup>
          {sorted.map((item) => (
            <ListRow
              key={item.slug}
              title={item.name}
              subtitle={`${item.university}\n${GENDER_LABELS[item.gender] ?? item.gender} ${REGION_LABELS[item.region] ?? item.region} · ${item.teamCount} team${item.teamCount === 1 ? "" : "s"}`}
              numberOfLines={3}
              meta={
                <View style={styles.badges}>
                  <Badge
                    label={
                      SCHOOL_VERIFICATION_LABELS[item.verificationStatus] ??
                      item.verificationStatus
                    }
                    tone={statusTone("verification", item.verificationStatus).tone}
                  />
                  {item.matchesViewerEmail ? (
                    <Badge label="Matches your email" tone="info" />
                  ) : null}
                </View>
              }
              onPress={() => router.push(`/schools/${item.slug}`)}
            />
          ))}
        </ListGroup>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: space.xs },
});
