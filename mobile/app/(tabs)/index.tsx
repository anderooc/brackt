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
  DashboardAttentionContract,
  DashboardContract,
  DashboardHostingContract,
  DashboardTournamentContract,
} from "@/lib/api/contracts/dashboard";
import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import {
  downloadMyScheduleIcs,
  fetchDashboard,
  fetchNotifications,
  fetchPersonalSchedule,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { CourtScene } from "~/brand/court-scene";
import { SignedOutScreen } from "~/components/signed-out";
import {
  attentionRoute,
  headlineSummary,
  hostingFacts,
  hostingFill,
  relativeDay,
  shortDate,
} from "~/lib/dashboard";
import { TEAM_ROLE_LABELS, todayISO } from "~/lib/format";
import { shareDownloadedFile } from "~/lib/share-pdf";
import { useNotificationsRealtimeRevision } from "~/notifications/NotificationsRealtimeProvider";
import { useThemeColors } from "~/theme/colors";
import { DateTile } from "~/tournament/date-tile";
import { PersonalSchedulePanel } from "~/tournament/personal-schedule-panel";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { UpNextMatch } from "~/tournament/up-next-match";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Icon,
  IconButton,
  ListGroup,
  ListRow,
  radius,
  ScreenScroll,
  Section,
  space,
  StatusBadge,
  Tappable,
  type IconName,
} from "~/ui";

const SCHEDULE_PREVIEW_COUNT = 3;

const ATTENTION_ICON: Record<DashboardAttentionContract["kind"], IconName> = {
  approve_teams: "person-add-outline",
  review_payments: "wallet-outline",
  pay_fee: "wallet-outline",
  sign_waiver: "create-outline",
  collect_waivers: "create-outline",
};

export default function DashboardScreen() {
  const colors = useThemeColors();
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
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [exporting, setExporting] = useState(false);
  const notificationsRevision = useNotificationsRealtimeRevision();

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const [page, schedule] = await Promise.all([
        fetchDashboard(signal),
        fetchPersonalSchedule(signal, { limit: 20, upcomingOnly: true }),
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
              color={colors.heroForeground}
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
  }, [colors.heroForeground, navigation, router, session, unreadNotifications]);

  // The court-blue header needs light status-bar content in both themes.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("auto");
    }, [])
  );

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [session, load]);

  async function exportCalendar() {
    setExporting(true);
    try {
      await shareDownloadedFile(
        () => downloadMyScheduleIcs(),
        "brackt-my-schedule.ics",
        "ics"
      );
    } catch (cause) {
      Alert.alert(
        "Couldn't export schedule",
        messageFor(cause, "Could not export your schedule.")
      );
    } finally {
      setExporting(false);
    }
  }

  if (sessionLoading) return <LoadingScreen />;
  if (!session) {
    return (
      <SignedOutScreen
        icon="trophy-outline"
        title="Welcome to brackt"
        message="Sign in to see your teams, registrations, and match schedule. You can browse public tournaments without an account."
        showBrowse
        art
      />
    );
  }
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

  const today = todayISO();
  // Servers that predate these fields omit them; treat that as nothing to show.
  const attention = data.attention ?? [];
  const hostingList = data.hosting ?? [];
  const upcomingAll = data.tournaments.filter((t) => t.relation !== "past");
  const upcoming = upcomingAll.filter((t) => !t.isOrganizer);
  const past = data.tournaments.filter((t) => t.relation === "past");
  const isNewUser =
    data.teams.length === 0 && data.tournaments.length === 0 && !data.school;
  const [nextMatch, ...laterMatches] = scheduleMatches;
  const shownLater = showAllMatches
    ? laterMatches
    : laterMatches.slice(0, SCHEDULE_PREVIEW_COUNT);
  const hiddenCount = laterMatches.length - shownLater.length;
  const showSchedule = data.teams.length > 0 || Boolean(nextMatch);

  return (
    <ScreenScroll
      refreshing={isRefreshing}
      onRefresh={async () => {
        setIsRefreshing(true);
        await load();
        setIsRefreshing(false);
      }}
    >
      <HomeHero
        firstName={data.firstName}
        summary={
          isNewUser
            ? "Let’s get you on the court."
            : headlineSummary(attention.length, upcomingAll[0] ?? null, today)
        }
        nextMatch={nextMatch ?? null}
        nextEvent={nextMatch ? null : (upcomingAll[0] ?? null)}
        today={today}
        exporting={exporting}
        onExport={() => {
          if (!exporting) void exportCalendar();
        }}
      />

      {error ? (
        <Banner tone="error" title="Couldn’t refresh" message={error} />
      ) : null}

      {isNewUser ? (
        <Section title="Get started">
          <ListGroup>
            <ListRow
              icon="people-outline"
              title="Join your club team"
              subtitle="Find your roster, or create one and invite players"
              onPress={() => router.push("/teams")}
            />
            <ListRow
              icon="school-outline"
              title="Find your school"
              subtitle="See the events your club hosts"
              onPress={() => router.push("/schools")}
            />
            <ListRow
              icon="trophy-outline"
              title="Find a tournament"
              subtitle="Sign your team up for an event"
              onPress={() => router.push("/tournaments")}
            />
          </ListGroup>
        </Section>
      ) : null}

      {attention.length > 0 ? (
        <Section title="Needs you">
          <ListGroup>
            {attention.map((item) => (
              <ListRow
                key={item.key}
                icon={ATTENTION_ICON[item.kind]}
                title={item.title}
                subtitle={[
                  item.tournament.name,
                  item.detail,
                  relativeDay(item.tournament.date, today) ??
                    shortDate(item.tournament.date),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                accessibilityHint={`Opens ${item.cta.toLowerCase()}`}
                onPress={() => router.push(attentionRoute(item))}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {laterMatches.length > 0 ? (
        <Section title="Coming up">
          <PersonalSchedulePanel matches={shownLater} />
          {hiddenCount > 0 || showAllMatches ? (
            <ToggleRow
              label={showAllMatches ? "Show fewer" : `Show ${hiddenCount} more`}
              open={showAllMatches}
              onPress={() => setShowAllMatches((v) => !v)}
            />
          ) : null}
        </Section>
      ) : showSchedule && !nextMatch ? (
        <Section title="Your schedule">
          <AppText variant="subhead" tone="muted">
            No matches yet. Your games and ref duties land here once a host
            releases the schedule.
          </AppText>
        </Section>
      ) : null}

      {hostingList.length > 0 ? (
        <Section
          title="Hosting"
          action={{
            label: "New",
            onPress: () => router.push("/tournament/new"),
          }}
        >
          <ListGroup>
            {hostingList.map((hosted) => (
              <HostingRow key={hosted.slug} hosting={hosted} today={today} />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {!isNewUser ? (
        <Section
          title="Upcoming events"
          action={{ label: "Find more", onPress: () => router.push("/tournaments") }}
        >
          {upcoming.length > 0 ? (
            <ListGroup>
              {upcoming.map((t) => (
                <EventRow key={t.slug} tournament={t} today={today} />
              ))}
            </ListGroup>
          ) : (
            <AppText variant="subhead" tone="muted">
              {hostingList.length > 0
                ? "None of your teams are signed up for another event."
                : "Nothing on the calendar. Find a tournament for your team to enter."}
            </AppText>
          )}
          {past.length > 0 ? (
            <ToggleRow
              label={`Past events (${data.stats.pastCount})`}
              open={showPast}
              onPress={() => setShowPast((v) => !v)}
            />
          ) : null}
          {showPast ? (
            <ListGroup>
              {past.map((t) => (
                <EventRow key={t.slug} tournament={t} today={today} />
              ))}
            </ListGroup>
          ) : null}
        </Section>
      ) : null}

      {!isNewUser ? (
        <Section
          title="Your teams"
          action={{ label: "New team", onPress: () => router.push("/teams/new") }}
        >
          <ListGroup>
            {data.teams.map((team) => (
              <ListRow
                key={team.slug}
                icon="people-outline"
                title={team.name}
                subtitle={[
                  TEAM_ROLE_LABELS[team.role] ?? team.role,
                  team.jerseyNumber != null ? `#${team.jerseyNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                onPress={() => router.push(`/teams/${team.slug}`)}
              />
            ))}
            {data.school ? (
              <ListRow
                icon="school-outline"
                iconTone="secondary"
                title={data.school.name}
                subtitle="Your school"
                onPress={() => router.push(`/schools/${data.school!.slug}`)}
              />
            ) : (
              <ListRow
                icon="school-outline"
                iconTone="secondary"
                title="Join your school"
                subtitle="See the events your club hosts"
                onPress={() => router.push("/schools")}
              />
            )}
            {data.teams.length === 0 ? (
              <ListRow
                icon="search-outline"
                title="Find your team"
                subtitle="You're not on a roster yet"
                onPress={() => router.push("/teams")}
              />
            ) : null}
          </ListGroup>
        </Section>
      ) : null}
    </ScreenScroll>
  );
}

function HomeHero({
  firstName,
  summary,
  nextMatch,
  nextEvent,
  today,
  exporting,
  onExport,
}: {
  firstName: string;
  summary: string;
  nextMatch: PersonalScheduleMatchContract | null;
  nextEvent: DashboardTournamentContract | null;
  today: string;
  exporting: boolean;
  onExport: () => void;
}) {
  const colors = useThemeColors();
  const router = useRouter();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hasCard = Boolean(nextMatch || nextEvent);

  return (
    <View style={styles.heroWrap}>
      {/* Paints the pull-to-refresh overscroll in court blue too. */}
      <View style={[styles.heroBleed, { backgroundColor: colors.hero }]} />
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.hero },
          hasCard && styles.heroWithCard,
        ]}
      >
        <View style={styles.heroArt} pointerEvents="none">
          <CourtScene variant="hero" width={270} style={styles.heroScene} />
        </View>
        <AppText variant="footnote" weight="600" style={{ color: colors.heroMuted }}>
          {dateLabel}
        </AppText>
        <AppText
          variant="largeTitle"
          accessibilityRole="header"
          numberOfLines={2}
          style={[styles.greeting, { color: colors.heroForeground }]}
        >
          Hi, {firstName}
        </AppText>
        <AppText variant="callout" weight="500" style={[styles.summary, { color: colors.heroMuted }]}>
          {summary}
        </AppText>
      </View>

      {nextMatch ? (
        <View style={styles.heroCard}>
          <UpNextMatch match={nextMatch} variant="raised" />
          <Tappable
            accessibilityRole="button"
            accessibilityLabel="Add your schedule to your calendar"
            onPress={onExport}
            style={styles.calendarLink}
          >
            <Icon name="calendar-outline" size={16} tone="primary" />
            <AppText variant="subhead" tone="primary" weight="600">
              {exporting ? "Exporting…" : "Add to calendar"}
            </AppText>
          </Tappable>
        </View>
      ) : nextEvent ? (
        <View style={styles.heroCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Next event: ${nextEvent.name}, ${
              relativeDay(nextEvent.date, today) ?? shortDate(nextEvent.date)
            }`}
            onPress={() => router.push(`/tournament/${nextEvent.slug}`)}
            style={({ pressed }) => [
              styles.eventCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: "#0b1a33",
              },
              pressed && styles.pressed,
            ]}
          >
            <DateTile date={nextEvent.date} />
            <View style={styles.rowText}>
              <AppText variant="footnote" weight="600" tone="primary">
                {relativeDay(nextEvent.date, today) ?? "Next event"}
              </AppText>
              <AppText variant="headline" numberOfLines={1}>
                {nextEvent.name}
              </AppText>
              <AppText variant="footnote" tone="muted" numberOfLines={1}>
                {[nextEvent.location, nextEvent.teamName].filter(Boolean).join(" · ")}
              </AppText>
            </View>
            <Icon name="arrow-forward" size={18} tone="muted" />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  open,
  onPress,
}: {
  label: string;
  open: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={onPress}
      style={styles.toggle}
    >
      <Icon name={open ? "chevron-up" : "chevron-down"} size={16} tone="muted" />
      <AppText variant="subhead" tone="muted" weight="500">
        {label}
      </AppText>
    </Tappable>
  );
}

function EventRow({
  tournament: t,
  today,
}: {
  tournament: DashboardTournamentContract;
  today: string;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const isPast = t.relation === "past";
  const live = t.status === "in_progress" && !isPast;
  const when = isPast ? null : relativeDay(t.date, today);
  const line = [when, t.location].filter(Boolean).join(" · ");
  const entry = [t.teamName, t.divisionName].filter(Boolean).join(" · ");

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={[t.name, when ?? shortDate(t.date), t.location, entry]
        .filter(Boolean)
        .join(". ")}
      onPress={() => router.push(`/tournament/${t.slug}`)}
      style={styles.row}
    >
      <DateTile date={t.date} muted={isPast} />
      <View style={styles.rowText}>
        <AppText variant="callout" weight="600" numberOfLines={1}>
          {t.name}
        </AppText>
        {line ? (
          <AppText variant="footnote" tone="muted" numberOfLines={1}>
            {line}
          </AppText>
        ) : null}
        {entry ? (
          <AppText variant="caption" tone="muted" numberOfLines={1}>
            {entry}
          </AppText>
        ) : null}
      </View>
      {live ? (
        <StatusBadge kind="tournament" status={t.status} date={t.date} />
      ) : !isPast && t.relation !== "signed_up" ? (
        <StatusBadge kind="dashboard_relation" status={t.relation} />
      ) : null}
      <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Tappable>
  );
}

function HostingRow({
  hosting,
  today,
}: {
  hosting: DashboardHostingContract;
  today: string;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const facts = [relativeDay(hosting.date, today), ...hostingFacts(hosting)]
    .filter(Boolean)
    .join(" · ");
  const fill = hostingFill(hosting);

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${hosting.name}. ${facts}`}
      onPress={() => router.push(`/tournament/${hosting.slug}`)}
      style={styles.row}
    >
      <DateTile date={hosting.date} />
      <View style={styles.rowText}>
        <AppText variant="callout" weight="600" numberOfLines={1}>
          {hosting.name}
        </AppText>
        <AppText variant="footnote" tone="muted" numberOfLines={2}>
          {facts}
        </AppText>
        {fill != null ? (
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fill,
                { width: `${Math.round(fill * 100)}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
        ) : null}
      </View>
      <StatusBadge kind="tournament" status={hosting.status} date={hosting.date} />
      <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Tappable>
  );
}

const styles = StyleSheet.create({
  heroWrap: { marginHorizontal: -space.lg, marginTop: -space.lg },
  heroBleed: { position: "absolute", left: 0, right: 0, top: -800, height: 800 },
  hero: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.xs,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroWithCard: { paddingBottom: 72 },
  heroArt: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroScene: { position: "absolute", right: -96, bottom: -60 },
  greeting: {
    fontSize: 40,
    lineHeight: 46,
    fontStyle: "italic",
    fontWeight: "900",
    letterSpacing: -0.8,
    marginTop: space.xxs,
  },
  summary: { maxWidth: 255 },
  heroCard: {
    marginTop: -56,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  calendarLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: space.xs,
    minHeight: 36,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth * 2,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: space.xxs },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  track: {
    height: 4,
    maxWidth: 160,
    borderRadius: radius.full,
    overflow: "hidden",
    marginTop: space.xs,
  },
  fill: { height: "100%", borderRadius: radius.full },
});
