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

import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  fetchTournamentRegisterOptions,
  submitTournamentRegistration,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { formatDeadline } from "~/lib/format";
import { goBackOrReplace } from "~/lib/navigation";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  BottomBar,
  Button,
  Card,
  EmptyState,
  haptics,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  space,
  StatusBadge,
} from "~/ui";

export default function RegisterScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    acceptedCount: number;
    waitlistedCount: number;
  } | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentRegisterOptions(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load registration."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="link-outline"
          title="Tournament unavailable"
          message="This registration link is missing its tournament."
          action={{
            label: "Go back",
            icon: "chevron-back",
            onPress: () => goBackOrReplace(router, "/"),
          }}
        />
      </View>
    );
  }
  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Registration unavailable"
        message={error ?? "Could not load registration."}
        onRetry={() => void refresh()}
      />
    );
  }

  function toggle(teamSlug: string) {
    haptics.selection();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamSlug)) next.delete(teamSlug);
      else next.add(teamSlug);
      return next;
    });
  }

  async function onSubmit() {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const outcome = await submitTournamentRegistration(slug!, {
        teamSlugs: [...selected],
        operationId: Crypto.randomUUID(),
      });
      haptics.success();
      setResult(outcome);
      setSelected(new Set());
      await refresh();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not register teams."));
    } finally {
      setBusy(false);
    }
  }

  const spotsLeft =
    data.availability.capacity === null
      ? null
      : Math.max(
          0,
          data.availability.capacity - data.availability.registeredCount
        );

  const facts = [
    `${data.availability.registeredCount} registered`,
    spotsLeft !== null ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left` : null,
    data.availability.waitlistCount > 0
      ? `${data.availability.waitlistCount} waitlisted`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const resultMessage = result
    ? [
        result.acceptedCount > 0
          ? `${result.acceptedCount} team${result.acceptedCount === 1 ? "" : "s"} registered.`
          : null,
        result.waitlistedCount > 0
          ? `${result.waitlistedCount} team${result.waitlistedCount === 1 ? "" : "s"} added to the waitlist.`
          : null,
      ]
        .filter(Boolean)
        .join(" ") || "Your registration was received."
    : "";

  const showFooter =
    data.registrationOpen && data.eligibleTeams.length > 0 && !result;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        <AppText variant="subhead" tone="muted">
          Select the teams you captain to enter this{" "}
          {data.genderLabel.toLowerCase()} tournament.
        </AppText>

        <Card>
          <View style={styles.factRow}>
            <Icon name="people-outline" size={18} tone="muted" />
            <AppText variant="subhead">{facts}</AppText>
          </View>
          {data.availability.deadline ? (
            <View style={styles.factRow}>
              <Icon name="time-outline" size={18} tone="muted" />
              <AppText variant="subhead">
                Registration closes {formatDeadline(data.availability.deadline)}
              </AppText>
            </View>
          ) : null}
        </Card>

        {result ? (
          <Banner
            tone="success"
            title="Registration submitted"
            message={resultMessage}
            action={{
              label: "Back to tournament",
              onPress: () => goBackOrReplace(router, `/tournament/${slug}`),
            }}
          />
        ) : null}

        {!data.registrationOpen ? (
          <Banner
            tone="warning"
            title="Registration closed"
            message={data.closedReason ?? "This tournament is not accepting new teams."}
          />
        ) : null}

        {actionError ? (
          <Banner
            tone="error"
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        ) : null}

        {data.myTeams.length > 0 ? (
          <Section title="Already entered">
            <ListGroup>
              {data.myTeams.map((team) => (
                <ListRow
                  key={team.slug}
                  title={team.name}
                  icon="shield-checkmark-outline"
                  trailing={<StatusBadge kind="registration" status={team.status} />}
                />
              ))}
            </ListGroup>
          </Section>
        ) : null}

        {data.eligibleTeams.length > 0 ? (
          <Section
            title="Your teams"
            description={
              data.registrationOpen ? "Tap a team to select it." : undefined
            }
          >
            <ListGroup>
              {data.eligibleTeams.map((team) => {
                const isSelected = selected.has(team.slug);
                return (
                  <ListRow
                    key={team.slug}
                    title={team.name}
                    subtitle={team.university}
                    chevron={false}
                    disabled={!data.registrationOpen || busy || result !== null}
                    onPress={() => toggle(team.slug)}
                    accessibilityLabel={`${team.name}, ${team.university}${isSelected ? ", selected" : ""}`}
                    accessibilityHint="Toggles this team for registration"
                    trailing={
                      <Icon
                        name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                        size={24}
                        tone={isSelected ? "primary" : "muted"}
                      />
                    }
                  />
                );
              })}
            </ListGroup>
          </Section>
        ) : data.emptyMessage ? (
          <EmptyState
            icon="people-outline"
            title="No teams to register"
            message={data.emptyMessage}
          />
        ) : null}
      </ScreenScroll>

      {showFooter ? (
        <BottomBar>
          <Button
            label={
              selected.size <= 1
                ? "Register team"
                : `Register ${selected.size} teams`
            }
            loading={busy}
            disabled={selected.size === 0}
            onPress={() => void onSubmit()}
            fullWidth
          />
        </BottomBar>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: "center" },
  factRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
