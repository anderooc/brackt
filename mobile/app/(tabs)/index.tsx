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

import type { DashboardContract } from "@/lib/api/contracts/dashboard";
import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { Redirect, useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import { fetchDashboard, fetchNotifications, fetchPersonalSchedule } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  DASHBOARD_RELATION_LABELS,
  formatCalendarDate,
  GENDER_LABELS,
  REGION_LABELS,
  TEAM_ROLE_LABELS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { useNotificationsRealtimeRevision } from "~/notifications/NotificationsRealtimeProvider";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { PersonalSchedulePanel } from "~/tournament/personal-schedule-panel";
import {
  AppText,
  Badge,
  Banner,
  Card,
  EmptyState,
  IconButton,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  space,
  statusTone,
} from "~/ui";

export default function DashboardScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [data, setData] = useState<DashboardContract | null>(null);
  const [scheduleMatches, setScheduleMatches] = useState<
    PersonalScheduleMatchContract[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const notificationsRevision = useNotificationsRealtimeRevision();

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const [page, schedule] = await Promise.all([
        fetchDashboard(signal),
        fetchPersonalSchedule(signal, { limit: 5 }),
      ]);
      setData(page);
      setScheduleMatches(schedule.matches);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not load your dashboard."
      );
    }
  }, []);

  const loadUnread = useCallback(async (signal?: AbortSignal) => {
    try {
      const inbox = await fetchNotifications({ limit: 1, signal });
      setUnreadNotifications(inbox.unreadCount);
    } catch {
      // Badge is best-effort.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = new AbortController();
      void loadUnread(controller.signal);
      return () => controller.abort();
    }, [session, loadUnread])
  );

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void loadUnread(controller.signal);
    return () => controller.abort();
  }, [notificationsRevision, session, loadUnread]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: session
        ? () => (
            <IconButton
              icon="notifications-outline"
              badge={unreadNotifications}
              accessibilityLabel={
                unreadNotifications > 0
                  ? `Notifications, ${unreadNotifications} unread`
                  : "Notifications"
              }
              onPress={() => router.push("/notifications")}
            />
          )
        : undefined,
    });
  }, [navigation, router, session, unreadNotifications]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [session, load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (data === null && error === null) return <LoadingScreen />;
  if (data === null) {
    return (
      <ErrorScreen
        title="Couldn’t load your home screen"
        message={error ?? "Please try again."}
        onRetry={() => void load()}
      />
    );
  }

  const isNewUser =
    data.stats.teamCount === 0 && data.tournaments.length === 0 && !data.school;

  return (
    <ScreenScroll
      refreshing={isRefreshing}
      onRefresh={async () => {
        setIsRefreshing(true);
        await load();
        setIsRefreshing(false);
      }}
    >
      <View style={styles.welcome}>
        <AppText variant="largeTitle">Welcome back, {data.firstName}</AppText>
        <AppText variant="callout" tone="muted">
          {data.school
            ? `Your hub for ${data.school.name}.`
            : "Your teams, signups, and tournaments."}
        </AppText>
      </View>

      {error ? (
        <Banner tone="error" title="Couldn’t refresh" message={error} />
      ) : null}

      {isNewUser ? (
        <Section
          title="Get started"
          description="Join your school, set up a team roster, or find a tournament to enter."
        >
          <ListGroup>
            <ListRow
              icon="search-outline"
              title="Find your school"
              subtitle="Join your club’s school page"
              onPress={() => router.push("/schools")}
            />
            <ListRow
              icon="school-outline"
              title="Create a school"
              subtitle="If your club isn’t listed yet"
              onPress={() => router.push("/schools/new")}
            />
            <ListRow
              icon="people-outline"
              title="Create a team"
              subtitle="Build a roster to register with"
              onPress={() => router.push("/teams/new")}
            />
            <ListRow
              icon="trophy-outline"
              title="Browse tournaments"
              onPress={() => router.push("/tournaments")}
            />
          </ListGroup>
        </Section>
      ) : (
        <>
          <SummaryStrip
            items={[
              { label: "Teams", value: data.stats.teamCount },
              {
                label: "Upcoming events",
                value: data.stats.upcomingCount,
                hint:
                  data.stats.pendingCount > 0
                    ? `${data.stats.pendingCount} pending`
                    : undefined,
              },
              { label: "Past events", value: data.stats.pastCount },
            ]}
          />

          <Section
            title="Your schedule"
            action={
              scheduleMatches.length > 0
                ? { label: "View all", onPress: () => router.push("/my-schedule") }
                : undefined
            }
          >
            <PersonalSchedulePanel matches={scheduleMatches} compact />
            <ListGroup>
              <ListRow
                icon="calendar-outline"
                title="All scheduled matches"
                subtitle="Every tournament, by day"
                onPress={() => router.push("/schedule")}
              />
            </ListGroup>
          </Section>
        </>
      )}

      <Section
        title="My teams"
        action={{ label: "See all", onPress: () => router.push("/teams") }}
      >
        <ListGroup>
          {data.school ? (
            <ListRow
              icon="school-outline"
              iconTone="secondary"
              title={data.school.name}
              subtitle="Your school"
              onPress={() => router.push(`/schools/${data.school!.slug}`)}
            />
          ) : null}
          {data.teams.map((team) => (
            <ListRow
              key={team.slug}
              icon="people-outline"
              title={team.name}
              subtitle={[
                TEAM_ROLE_LABELS[team.role] ?? team.role,
                team.jerseyNumber != null ? `#${team.jerseyNumber}` : null,
                `${GENDER_LABELS[team.gender] ?? team.gender} ${REGION_LABELS[team.region] ?? team.region}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => router.push(`/teams/${team.slug}`)}
            />
          ))}
          {data.teams.length === 0 ? (
            <ListRow
              icon="add-circle-outline"
              title="Create a team"
              subtitle="Build a roster to register for tournaments"
              onPress={() => router.push("/teams/new")}
            />
          ) : null}
        </ListGroup>
      </Section>

      <Section
        title="My tournaments"
        action={{ label: "Browse", onPress: () => router.push("/tournaments") }}
      >
        {data.tournaments.length === 0 ? (
          <EmptyState
            compact
            icon="trophy-outline"
            title="No tournaments yet"
            message="Tournaments you host or sign up for will show up here."
          />
        ) : (
          <ListGroup>
            {data.tournaments.map((tournament) => (
              <ListRow
                key={tournament.slug}
                title={tournament.name}
                subtitle={[
                  formatCalendarDate(tournament.date),
                  tournament.teamName,
                  tournament.divisionName,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                meta={
                  <View style={styles.badgeRow}>
                    <Badge
                      label={
                        DASHBOARD_RELATION_LABELS[tournament.relation] ??
                        tournament.relation
                      }
                      tone={statusTone("dashboard_relation", tournament.relation).tone}
                    />
                  </View>
                }
                onPress={() => router.push(`/tournament/${tournament.slug}`)}
              />
            ))}
          </ListGroup>
        )}
      </Section>
    </ScreenScroll>
  );
}

function SummaryStrip({
  items,
}: {
  items: { label: string; value: number; hint?: string }[];
}) {
  const colors = useThemeColors();
  return (
    <Card padded={false} style={styles.summary}>
      {items.map((item, index) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}${item.hint ? `, ${item.hint}` : ""}`}
          style={[
            styles.summaryCell,
            index > 0 && {
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderLeftColor: colors.border,
            },
          ]}
        >
          <AppText variant="title" style={{ fontVariant: ["tabular-nums"] }}>
            {item.value}
          </AppText>
          <AppText variant="footnote" tone="muted" weight="500">
            {item.label}
          </AppText>
          {item.hint ? (
            <AppText variant="caption" tone="warning">
              {item.hint}
            </AppText>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  welcome: { gap: space.xs },
  summary: { flexDirection: "row" },
  summaryCell: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.xxs,
  },
  badgeRow: { flexDirection: "row", marginTop: space.xs },
});
