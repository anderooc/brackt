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

import type { TeamListItemContract } from "@/lib/api/contracts/team";
import { Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import { fetchTeams } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { GENDER_LABELS, REGION_LABELS, TEAM_ROLE_LABELS } from "~/lib/format";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import {
  Badge,
  Banner,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  ScreenScroll,
  space,
  StatusBadge,
} from "~/ui";

export default function TeamsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [teams, setTeams] = useState<TeamListItemContract[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const page = await fetchTeams(signal);
      setTeams(page.teams);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not load your teams."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [session, load])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="add"
          accessibilityLabel="Create team"
          onPress={() => router.push("/teams/new")}
        />
      ),
    });
  }, [navigation, router]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  }, [load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (teams === null && error === null) return <LoadingScreen />;
  if (teams === null) {
    return (
      <ErrorScreen
        title="Couldn’t load teams"
        message={error ?? "Could not load your teams."}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void onRefresh()} gap={space.lg}>
      {error ? (
        <Banner
          title="Couldn’t refresh"
          message={error}
          action={{ label: "Try again", onPress: () => void onRefresh() }}
          onDismiss={() => setError(null)}
        />
      ) : null}

      {teams.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No teams yet"
          message="Create a team to manage your roster and register for tournaments."
          action={{
            label: "Create team",
            icon: "add",
            onPress: () => router.push("/teams/new"),
          }}
        />
      ) : (
        <ListGroup>
          {teams.map((team) => {
            const subtitle = [
              team.school?.name ?? team.university,
              `${GENDER_LABELS[team.gender] ?? team.gender} · ${REGION_LABELS[team.region] ?? team.region}`,
            ]
              .filter(Boolean)
              .join("\n");
            return (
              <ListRow
                key={team.slug}
                icon="people-outline"
                title={team.name}
                subtitle={subtitle}
                numberOfLines={3}
                onPress={() => router.push(`/teams/${team.slug}`)}
                meta={
                  <View style={styles.badges}>
                    <Badge label={TEAM_ROLE_LABELS[team.role] ?? team.role} />
                    {!team.school && team.verificationStatus !== "verified" ? (
                      <StatusBadge kind="verification" status={team.verificationStatus} />
                    ) : null}
                  </View>
                }
              />
            );
          })}
        </ListGroup>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.xs,
    marginTop: space.xs,
  },
});
