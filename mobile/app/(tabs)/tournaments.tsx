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

import type { TournamentListItemContract } from "@/lib/api/contracts/tournament";
import type { TeamGender, TeamRegion } from "@/types";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ApiClientError } from "~/api/client";
import { fetchTournaments } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  formatRailDate,
  formatScheduleHeading,
  parseISODate,
  todayISO,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { DateRail } from "~/tournament/date-rail";
import {
  buildScheduleGroups,
  countActiveTournamentFilters,
  emptyScheduleCopy,
  filterTournamentList,
  toggleSetValue,
} from "~/tournament/filter-tournament-list";
import { ListFiltersSheet } from "~/tournament/list-filters";
import { MonthCalendar } from "~/tournament/month-calendar";
import { ScheduleRow } from "~/tournament/schedule-row";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Chip,
  EmptyState,
  HeaderButton,
  HIT_TARGET,
  Icon,
  IconButton,
  ListGroup,
  radius,
  space,
  type,
} from "~/ui";

const LIST_LIMIT = 100;
const MAX_PAGES = 10;

export default function TournamentsScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const { session } = useSession();

  const [tournaments, setTournaments] = useState<
    TournamentListItemContract[] | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<Set<TeamGender>>(
    () => new Set()
  );
  const [regionFilter, setRegionFilter] = useState<Set<TeamRegion>>(
    () => new Set()
  );
  const [hideArchived, setHideArchived] = useState(false);
  const [registrationOpenOnly, setRegistrationOpenOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = parseISODate(todayISO());
    return { year: today.getFullYear(), monthIndex: today.getMonth() };
  });
  const [now, setNow] = useState(() => new Date().toISOString());
  const today = todayISO();

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      // Search, filters, and the calendar run on the client, so they need the
      // whole public list rather than just the first page.
      const all: TournamentListItemContract[] = [];
      for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex++) {
        const page = await fetchTournaments(
          { limit: LIST_LIMIT, offset: all.length },
          signal
        );
        all.push(...page.tournaments);
        if (page.tournaments.length === 0 || all.length >= page.total) break;
      }
      setTournaments(all);
    } catch (cause) {
      if (signal?.aborted) return;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Something went wrong loading tournaments."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [load])
  );

  useEffect(() => {
    if (!registrationOpenOnly) return;
    const id = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(id);
  }, [registrationOpenOnly]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setNow(new Date().toISOString());
    await load();
    setIsRefreshing(false);
  }, [load]);

  const activeCount = countActiveTournamentFilters({
    genderFilter,
    regionFilter,
    hideArchived,
    registrationOpenOnly,
  });
  const hasActiveFilters = activeCount > 0;

  const filtered = useMemo(() => {
    if (!tournaments) return [];
    return filterTournamentList(tournaments, {
      query,
      genderFilter,
      regionFilter,
      hideArchived,
      registrationOpenOnly,
      today,
      now,
    });
  }, [
    tournaments,
    query,
    genderFilter,
    regionFilter,
    hideArchived,
    registrationOpenOnly,
    today,
    now,
  ]);

  const groups = useMemo(
    () => buildScheduleGroups(filtered, { today, selectedDate }),
    [filtered, today, selectedDate]
  );
  const selectedGroup =
    groups.find((group) => group.date === selectedDate) ?? {
      date: selectedDate,
      tournaments: [] as TournamentListItemContract[],
    };
  const nextDateWithEvents =
    groups.find(
      (group) => group.date > selectedDate && group.tournaments.length > 0
    )?.date ??
    [...groups]
      .reverse()
      .find((group) => group.date < selectedDate && group.tournaments.length > 0)
      ?.date ??
    null;
  const markedDates = useMemo(
    () => new Set(filtered.map((tournament) => tournament.date)),
    [filtered]
  );

  const clearFilters = useCallback(() => {
    setGenderFilter(new Set());
    setRegionFilter(new Set());
    setHideArchived(false);
    setRegistrationOpenOnly(false);
  }, []);

  function handleCalendarSelect(iso: string) {
    setSelectedDate(iso);
    setCalendarOpen(false);
  }

  function toggleCalendar() {
    const next = parseISODate(selectedDate);
    setCalendarMonth({ year: next.getFullYear(), monthIndex: next.getMonth() });
    setCalendarOpen((open) => !open);
  }

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: session
        ? () => (
            <IconButton
              icon="add"
              accessibilityLabel="Create tournament"
              onPress={() => router.push("/tournament/new")}
            />
          )
        : () => (
            <HeaderButton
              label="Sign in"
              emphasis
              onPress={() => router.push("/sign-in")}
            />
          ),
    });
  }, [navigation, session]);

  if (tournaments === null && error === null) {
    return <LoadingScreen />;
  }

  if (tournaments === null && error) {
    return (
      <ErrorScreen
        title="Couldn’t load tournaments"
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  const empty =
    filtered.length === 0
      ? emptyScheduleCopy({
          loadedCount: tournaments?.length ?? 0,
          query,
          hasActiveFilters,
        })
      : null;
  const emptyAction = hasActiveFilters
    ? { label: "Clear filters", icon: "close-circle-outline" as const, onPress: clearFilters }
    : query.trim()
      ? { label: "Clear search", icon: "close-circle-outline" as const, onPress: () => setQuery("") }
      : undefined;

  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.toolbar}>
        <View
          style={[
            styles.search,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Icon name="search" size={18} tone="muted" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tournaments"
            placeholderTextColor={colors.mutedForeground}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search tournaments"
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
        <View style={styles.toolRow}>
          <Chip
            label="Filters"
            icon="options-outline"
            selected={hasActiveFilters}
            count={hasActiveFilters ? activeCount : undefined}
            onPress={() => setFiltersOpen(true)}
          />
          <Chip
            label={calendarOpen ? "Hide calendar" : "Calendar"}
            icon="calendar-outline"
            selected={calendarOpen}
            onPress={toggleCalendar}
          />
          {hasActiveFilters ? (
            <Button
              label="Clear"
              variant="ghost"
              size="sm"
              accessibilityLabel="Clear filters"
              onPress={clearFilters}
            />
          ) : null}
        </View>

        {calendarOpen ? (
          <MonthCalendar
            selectedDate={selectedDate}
            today={today}
            markedDates={markedDates}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            onSelectDate={handleCalendarSelect}
          />
        ) : null}
      </View>

      {error ? (
        <View style={styles.bannerWrap}>
          <Banner
            title="Couldn’t refresh"
            message={error}
            action={{ label: "Try again", onPress: () => void onRefresh() }}
            onDismiss={() => setError(null)}
          />
        </View>
      ) : null}

      {empty ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={refreshControl}
        >
          <EmptyState
            icon={emptyAction ? "search-outline" : "trophy-outline"}
            title={empty.title}
            message={empty.body}
            action={emptyAction}
          />
        </ScrollView>
      ) : (
        <View style={[styles.split, { borderTopColor: colors.border }]}>
          <ScrollView
            style={styles.dayPane}
            contentContainerStyle={styles.dayContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={refreshControl}
          >
            <View style={styles.dayHeading}>
              <View style={styles.dayHeadingText}>
                {selectedDate === today ? <Badge label="Today" tone="info" /> : null}
                <AppText variant="headline" accessibilityRole="header">
                  {formatScheduleHeading(selectedDate)}
                </AppText>
                {selectedGroup.tournaments.length > 0 ? (
                  <AppText variant="footnote" tone="muted">
                    {selectedGroup.tournaments.length === 1
                      ? "1 tournament"
                      : `${selectedGroup.tournaments.length} tournaments`}
                  </AppText>
                ) : null}
              </View>
              {selectedDate !== today ? (
                <Button
                  label="Today"
                  variant="ghost"
                  size="sm"
                  accessibilityLabel="Jump to today"
                  onPress={() => setSelectedDate(today)}
                />
              ) : null}
            </View>

            {selectedGroup.tournaments.length > 0 ? (
              <ListGroup>
                {selectedGroup.tournaments.map((item) => (
                  <ScheduleRow
                    key={item.slug}
                    tournament={item}
                    today={today}
                    onPress={() => router.push(`/tournament/${item.slug}`)}
                  />
                ))}
              </ListGroup>
            ) : (
              <EmptyState
                compact
                icon="calendar-clear-outline"
                title="Nothing on this day"
                message={
                  nextDateWithEvents
                    ? "Pick another date from the rail, or jump to the nearest event."
                    : "Pick another date from the rail."
                }
                action={
                  nextDateWithEvents
                    ? {
                        label: `Go to ${formatRailDate(nextDateWithEvents).monthDay}`,
                        icon: "arrow-forward",
                        onPress: () => setSelectedDate(nextDateWithEvents),
                      }
                    : undefined
                }
              />
            )}
          </ScrollView>
          <DateRail
            dates={groups.map((group) => group.date)}
            selectedDate={selectedDate}
            today={today}
            onSelect={setSelectedDate}
          />
        </View>
      )}

      <ListFiltersSheet
        visible={filtersOpen}
        genderFilter={genderFilter}
        regionFilter={regionFilter}
        hideArchived={hideArchived}
        registrationOpenOnly={registrationOpenOnly}
        activeCount={activeCount}
        onToggleGender={(value) =>
          setGenderFilter((prev) => toggleSetValue(prev, value))
        }
        onToggleRegion={(value) =>
          setRegionFilter((prev) => toggleSetValue(prev, value))
        }
        onHideArchivedChange={setHideArchived}
        onRegistrationOpenOnlyChange={(value) => {
          setRegistrationOpenOnly(value);
          setNow(new Date().toISOString());
        }}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toolbar: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.md,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    minHeight: HIT_TARGET,
    paddingVertical: 0,
  },
  toolRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  bannerWrap: { paddingHorizontal: space.lg, paddingBottom: space.md },
  split: {
    flex: 1,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dayPane: { flex: 1, minWidth: 0 },
  dayContent: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  dayHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  dayHeadingText: { flex: 1, gap: space.xs },
  emptyScroll: { flexGrow: 1, justifyContent: "center" },
});
