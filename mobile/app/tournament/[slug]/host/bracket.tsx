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

import type { TournamentBracketSettingsContract } from "@/lib/api/contracts/tournament-ops";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import {
  fetchTournamentHostBrackets,
  regenerateTournamentHostBrackets,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { BRACKET_COUNT_OPTIONS } from "~/lib/format";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  haptics,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
} from "~/ui";

function bracketStructureLabel(settings: TournamentBracketSettingsContract) {
  const option = BRACKET_COUNT_OPTIONS.find(
    (row) => row.value === settings.bracketCount
  );
  return option?.label ?? `${settings.bracketCount} bracket(s)`;
}

function tierSummary(settings: TournamentBracketSettingsContract): string | null {
  const parts: string[] = [];
  if (settings.bracketCount >= 2) {
    parts.push(`Gold ${settings.goldTeamCount ?? "not set"}`);
    if (settings.bracketCount === 3) {
      parts.push(`Silver ${settings.silverTeamCount ?? "not set"}`);
    }
  }
  if (settings.totalBracketTeams > 0) {
    parts.push(`${settings.totalBracketTeams} teams in pool play`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default function TournamentHostBracketScreen() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [settings, setSettings] =
    useState<TournamentBracketSettingsContract | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostBrackets(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load bracket ops."
  );

  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  const current = settings ?? data?.settings ?? null;

  const onRegenerate = useCallback(() => {
    if (!slug || !current?.canRegenerate) return;
    Alert.alert(
      "Regenerate brackets?",
      "This clears current bracket matches and re-seeds gold / silver / bronze from the latest pool standings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => {
            setBusy(true);
            setActionError(null);
            setNotice(null);
            void regenerateTournamentHostBrackets(slug)
              .then((result) => {
                setSettings(result.settings);
                haptics.success();
                setNotice("Brackets regenerated from the latest pool standings.");
              })
              .catch((cause) => {
                haptics.error();
                setActionError(
                  messageFor(cause, "Could not regenerate brackets.")
                );
              })
              .finally(() => setBusy(false));
          },
        },
      ]
    );
  }, [current?.canRegenerate, slug]);

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
  if (error && !current) {
    return (
      <ErrorScreen
        title="Bracket ops unavailable"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  if (!current) return <LoadingScreen />;

  const blocked = !current.canRegenerate;

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      {error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: () => void refresh() }}
        />
      ) : null}
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      {notice ? (
        <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <ListGroup>
        <ListRow
          title="View public bracket"
          subtitle="The draw teams and fans see once pools are released"
          icon="eye-outline"
          onPress={() => router.push(`/tournament/${slug}/bracket`)}
        />
      </ListGroup>

      {!current.hasPoolToBracket ? (
        <Card>
          <EmptyState
            icon="git-network-outline"
            title="No pool-to-bracket pools"
            message="Bracket tiers apply when a pool plays group matches before brackets. Add or update pools in Setup."
            action={{
              label: "Open Setup",
              icon: "construct-outline",
              onPress: () => router.push(`/tournament/${slug}/host/setup`),
            }}
          />
        </Card>
      ) : (
        <>
          <Section title="Tiers">
            <ListGroup>
              <ListRow
                title={bracketStructureLabel(current)}
                subtitle={tierSummary(current)}
                icon="trophy-outline"
                onPress={() => router.push(`/tournament/${slug}/settings/bracket`)}
                accessibilityHint="Opens bracket settings"
              />
            </ListGroup>
          </Section>

          <Section
            title="Regenerate"
            description="Re-seed gold, silver, and bronze from current pool standings. Only available before any bracket match has been played."
          >
            {blocked ? (
              <Banner
                tone="warning"
                message={
                  current.regenerateBlockedReason ??
                  "Bracket regeneration isn't available right now."
                }
              />
            ) : null}
            <Button
              label="Regenerate brackets"
              icon="refresh"
              variant="destructiveOutline"
              onPress={onRegenerate}
              loading={busy}
              disabled={blocked}
              fullWidth
            />
          </Section>
        </>
      )}
    </ScreenScroll>
  );
}
