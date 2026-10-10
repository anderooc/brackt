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
  TournamentHostChecklistStepContract,
  TournamentHostOverviewContract,
} from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  fetchTournamentHostOverview,
  updateTournamentHostStatus,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  PLAY_FORMAT_LABELS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_STATUS_VALUES,
} from "~/lib/format";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Card,
  Chip,
  ChipRow,
  haptics,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  space,
  StatusBadge,
} from "~/ui";

function plural(count: number, word: string, pluralWord = `${word}s`) {
  return `${count} ${count === 1 ? word : pluralWord}`;
}

type StepAction =
  | { kind: "route"; path: string }
  | { kind: "status"; status: string }
  | null;

function stepAction(
  step: TournamentHostChecklistStepContract,
  overview: TournamentHostOverviewContract
): StepAction {
  const base = `/tournament/${overview.slug}`;
  switch (step.id) {
    case "setup":
      return { kind: "route", path: `${base}/host/setup` };
    case "open":
      return step.done ? null : { kind: "status", status: "registration_open" };
    case "confirm":
      return { kind: "route", path: `${base}/host/registrations?tab=pending` };
    case "pool-settings":
      return { kind: "route", path: `${base}/settings/pool` };
    case "bracket-settings":
      return { kind: "route", path: `${base}/settings/bracket` };
    case "pools":
    case "release":
      return { kind: "route", path: `${base}/host/pools` };
    case "bracket":
      return {
        kind: "route",
        path: overview.sections.bracket ? `${base}/host/bracket` : `${base}/bracket`,
      };
    case "schedule":
      return overview.sections.schedule
        ? { kind: "route", path: `${base}/host/schedule` }
        : null;
    case "run":
      return step.done ? null : { kind: "status", status: "in_progress" };
    default:
      return null;
  }
}

function stepHint(
  step: TournamentHostChecklistStepContract,
  overview: TournamentHostOverviewContract
): string | undefined {
  if (step.done) return undefined;
  switch (step.id) {
    case "setup":
      return "Add pools and courts in Setup.";
    case "open":
      return "Tap to set status to Registration open when teams can sign up.";
    case "confirm":
      return overview.counts.pendingCount > 0
        ? `${plural(overview.counts.pendingCount, "team")} waiting for approval.`
        : "Approve pending teams, then close registration.";
    case "pools":
      return overview.playFormat === "pool_to_bracket"
        ? "Assign teams to pools in Registrations, then save seeding in Pools to create matches."
        : "Assign teams in Registrations, then save seeding to build the bracket.";
    case "release":
      return "Release pools when schedules are ready for teams and fans.";
    case "bracket":
      return overview.playFormat === "pool_to_bracket"
        ? "Brackets seed automatically when every pool finishes."
        : "Teams appear once seeding is saved.";
    case "schedule":
      return "Set start times and courts in Schedule.";
    case "run":
      return "Tap to set status to In progress on event day.";
    default:
      return step.hint;
  }
}

export default function TournamentHostScreen() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostOverview(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load host tools."
  );

  const applyStatus = useCallback(
    async (status: string) => {
      if (!slug || !data || data.overview.status === status) return;
      setPendingStatus(status);
      setActionError(null);
      setNotice(null);
      try {
        await updateTournamentHostStatus(slug, status);
        await reload(undefined, "silent");
        haptics.success();
        setNotice(`Status set to ${TOURNAMENT_STATUS_LABELS[status] ?? status}.`);
      } catch (cause) {
        haptics.error();
        setActionError(messageFor(cause, "Could not update status."));
      } finally {
        setPendingStatus(null);
      }
    },
    [data, reload, slug]
  );

  const confirmStatus = useCallback(
    (status: string) => {
      if (!data || data.overview.status === status) return;
      const label = TOURNAMENT_STATUS_LABELS[status] ?? status;
      Alert.alert(`Set status to ${label}?`, statusConfirmMessage(status), [
        { text: "Cancel", style: "cancel" },
        { text: "Set status", onPress: () => void applyStatus(status) },
      ]);
    },
    [applyStatus, data]
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <ErrorScreen
        title="Missing tournament"
        message="No tournament was specified. Go back and open it again."
        onRetry={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />
    );
  }
  if (error && !data) {
    return (
      <ErrorScreen
        title="Host tools unavailable"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  if (!data) return <LoadingScreen />;

  const overview = data.overview;
  const base = `/tournament/${slug}`;
  const { counts, sections } = overview;
  const doneCount = overview.checklist.filter((step) => step.done).length;
  const teamCount = counts.confirmedCount + counts.checkedInCount;
  const statusBusy = pendingStatus != null;

  const registrationDetail = [
    plural(counts.registrationCount, "team"),
    counts.pendingCount > 0 ? `${counts.pendingCount} pending` : null,
    counts.waitlistCount > 0 ? `${counts.waitlistCount} waitlisted` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <Card>
        <AppText variant="title">{overview.name}</AppText>
        <View style={styles.heroMeta}>
          <StatusBadge kind="tournament" status={overview.status} date={overview.date} />
          <AppText variant="subhead" tone="muted">
            {PLAY_FORMAT_LABELS[overview.playFormat] ?? overview.playFormat}
          </AppText>
        </View>
      </Card>

      {error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: () => void refresh() }}
        />
      ) : null}
      {overview.isArchived ? (
        <Banner
          tone="warning"
          title="Archived"
          message="The tournament date has passed, so status and preparation changes are locked. Update the date to make changes."
        />
      ) : overview.preparationLockedReason ? (
        <Banner tone="info" message={overview.preparationLockedReason} />
      ) : null}

      <Section title="Status" description="Who can see and register for this tournament.">
        <ChipRow>
          {TOURNAMENT_STATUS_VALUES.map((status) => (
            <Chip
              key={status}
              label={TOURNAMENT_STATUS_LABELS[status] ?? status}
              selected={(pendingStatus ?? overview.status) === status}
              disabled={statusBusy || overview.isArchived}
              onPress={() => confirmStatus(status)}
            />
          ))}
        </ChipRow>
        {actionError ? (
          <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
        ) : null}
        {notice ? (
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        ) : null}
      </Section>

      <Section
        title="Readiness"
        description={`${doneCount} of ${overview.checklist.length} steps done`}
      >
        <ListGroup>
          {overview.checklist.map((step) => {
            const action = stepAction(step, overview);
            const onPress =
              action?.kind === "route"
                ? () => router.push(action.path)
                : action?.kind === "status" && !statusBusy && !overview.isArchived
                  ? () => confirmStatus(action.status)
                  : undefined;
            return (
              <ListRow
                key={step.id}
                title={step.label}
                subtitle={stepHint(step, overview)}
                icon={step.done ? "checkmark-circle" : "ellipse-outline"}
                iconTone={step.done ? "success" : "muted"}
                trailing={
                  <Badge
                    label={step.done ? "Done" : "To do"}
                    tone={step.done ? "success" : "neutral"}
                  />
                }
                onPress={onPress}
                numberOfLines={3}
              />
            );
          })}
        </ListGroup>
      </Section>

      <Section title="Game day">
        <ListGroup>
          {overview.canCheckIn ? (
            <ListRow
              title="Check-in"
              subtitle={`${counts.checkedInCount} of ${plural(teamCount, "team")} checked in`}
              icon="checkbox-outline"
              onPress={() => router.push(`${base}/host/registrations?tab=checkin`)}
            />
          ) : null}
          {sections.schedule ? (
            <ListRow
              title="Schedule"
              subtitle="Start times, courts, and reffing teams"
              icon="time-outline"
              onPress={() => router.push(`${base}/host/schedule`)}
            />
          ) : null}
          {sections.pools ? (
            <ListRow
              title="Pools"
              subtitle="Seeding, matches, and release"
              icon="grid-outline"
              onPress={() => router.push(`${base}/host/pools`)}
            />
          ) : null}
          {sections.bracket ? (
            <ListRow
              title="Bracket"
              subtitle="Tiers and regenerate"
              icon="git-network-outline"
              onPress={() => router.push(`${base}/host/bracket`)}
            />
          ) : null}
          <ListRow
            title="Live scores"
            subtitle="What's on court now"
            icon="pulse-outline"
            onPress={() => router.push(`${base}/scoring`)}
          />
          <ListRow
            title="Matches"
            subtitle="Public schedule and results"
            icon="list-outline"
            onPress={() => router.push(`${base}?tab=matches`)}
          />
          <ListRow
            title="Court board"
            subtitle="Full-screen scoreboard for a tablet at the venue"
            icon="tv-outline"
            onPress={() => router.push(`${base}/scoreboard`)}
          />
          <ListRow
            title="Chat"
            subtitle="Announcements and team discussion"
            icon="chatbubbles-outline"
            onPress={() => router.push(`${base}/chat`)}
          />
          <ListRow
            title="Email"
            subtitle="Message registered captains"
            icon="mail-outline"
            onPress={() => router.push(`${base}/email`)}
          />
        </ListGroup>
      </Section>

      <Section title="Setup">
        <ListGroup>
          <ListRow
            title="Pools and courts"
            subtitle={`${plural(counts.divisionCount, "pool")} · ${plural(counts.courtCount, "court")}`}
            icon="construct-outline"
            onPress={() => router.push(`${base}/host/setup`)}
          />
          <ListRow
            title="Registrations"
            subtitle={registrationDetail}
            icon="people-outline"
            onPress={() => router.push(`${base}/host/registrations`)}
          />
          {sections.poolSettings ? (
            <ListRow
              title="Pool settings"
              subtitle="Match format, scoring, and tie-breaks"
              icon="options-outline"
              onPress={() => router.push(`${base}/settings/pool`)}
            />
          ) : null}
          {sections.bracketSettings ? (
            <ListRow
              title="Bracket settings"
              subtitle="Gold, silver, and bronze tiers"
              icon="trophy-outline"
              onPress={() => router.push(`${base}/settings/bracket`)}
            />
          ) : null}
          <ListRow
            title="Payment"
            subtitle="Entry fee and payment methods"
            icon="card-outline"
            onPress={() => router.push(`${base}/settings/payment`)}
          />
          <ListRow
            title="Waiver"
            subtitle="Waiver PDF and signing rules"
            icon="document-text-outline"
            onPress={() => router.push(`${base}/settings/waiver`)}
          />
          <ListRow
            title="Waiver tracking"
            subtitle="Who has signed, team by team"
            icon="checkmark-done-outline"
            onPress={() => router.push(`${base}/waiver`)}
          />
          <ListRow
            title="Packet"
            subtitle="Logistics notes and PDF color"
            icon="folder-open-outline"
            onPress={() => router.push(`${base}/settings/packet`)}
          />
        </ListGroup>
      </Section>

      <Section title="Tournament">
        <ListGroup>
          <ListRow
            title="Name and listing"
            subtitle="Rename, location, description, duplicate, or delete"
            icon="create-outline"
            onPress={() => router.push(`${base}/host/details`)}
          />
          <ListRow
            title="Staff"
            subtitle="Co-hosts and staff who can help run the event"
            icon="person-add-outline"
            onPress={() => router.push(`${base}/host/staff`)}
          />
        </ListGroup>
      </Section>
    </ScreenScroll>
  );
}

function statusConfirmMessage(status: string): string {
  switch (status) {
    case "draft":
      return "Teams won't be able to register while the tournament is a draft.";
    case "registration_open":
      return "Teams will be able to find and register for this tournament.";
    case "registration_closed":
      return "New teams will no longer be able to register.";
    case "in_progress":
      return "Teams and fans will see the event as live.";
    case "completed":
      return "The event will be marked as finished.";
    default:
      return "This changes what teams and fans see.";
  }
}

const styles = StyleSheet.create({
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: space.sm,
  },
});
