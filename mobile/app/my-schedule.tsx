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

import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { downloadMyScheduleIcs, fetchPersonalSchedule } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { shareDownloadedFile } from "~/lib/share-pdf";
import { PersonalSchedulePanel } from "~/tournament/personal-schedule-panel";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import { AppText, Banner, Button, EmptyState, ScreenScroll, space } from "~/ui";

const FALLBACK_ERROR = "Could not load your schedule.";

export default function MyScheduleScreen() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [matches, setMatches] = useState<
    Awaited<ReturnType<typeof fetchPersonalSchedule>>["matches"]
  >([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportCalendar() {
    setExporting(true);
    try {
      await shareDownloadedFile(
        () => downloadMyScheduleIcs(),
        "brackt-my-schedule.ics",
        "ics"
      );
    } catch (cause) {
      Alert.alert("Couldn't export schedule", messageFor(cause, FALLBACK_ERROR));
    } finally {
      setExporting(false);
    }
  }

  const load = useCallback(async (signal?: AbortSignal) => {
    const schedule = await fetchPersonalSchedule(signal);
    setMatches(schedule.matches);
    setError(null);
    setReady(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = new AbortController();
      void load(controller.signal).catch((cause) => {
        if (controller.signal.aborted) return;
        setError(messageFor(cause, FALLBACK_ERROR));
        setReady(true);
      });
      return () => controller.abort();
    }, [session, load])
  );

  const retry = useCallback(() => {
    setError(null);
    setReady(false);
    void load().catch((cause) => {
      setError(messageFor(cause, FALLBACK_ERROR));
      setReady(true);
    });
  }, [load]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void load()
      .catch((cause) => setError(messageFor(cause, FALLBACK_ERROR)))
      .finally(() => setIsRefreshing(false));
  }, [load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!ready && !error) return <LoadingScreen />;
  if (error && matches.length === 0) {
    return (
      <ErrorScreen
        title="Could not load schedule"
        message={error}
        onRetry={retry}
      />
    );
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={onRefresh} gap={space.lg}>
      {error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: onRefresh }}
        />
      ) : null}
      {matches.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming matches"
          message="Games for your teams, reffing assignments, and scorekeeping shifts show up here once a host posts the schedule."
          action={{
            label: "Browse tournaments",
            icon: "trophy-outline",
            onPress: () => router.push("/tournaments"),
          }}
        />
      ) : (
        <>
          <AppText variant="subhead" tone="muted">
            Upcoming matches for your teams, plus your reffing and scorekeeping
            assignments.
          </AppText>
          <PersonalSchedulePanel matches={matches} />
          <Button
            label="Add to calendar"
            icon="calendar-outline"
            variant="outline"
            loading={exporting}
            onPress={() => void exportCalendar()}
          />
          <AppText variant="footnote" tone="muted">
            Shares an .ics file you can open in Calendar or Google Calendar.
            Times in the file won&apos;t change if the host reschedules, so
            export again after updates.
          </AppText>
        </>
      )}
    </ScreenScroll>
  );
}
