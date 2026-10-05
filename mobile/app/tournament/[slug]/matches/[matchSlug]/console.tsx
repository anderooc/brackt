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

import type { MatchConsoleContract } from "@/lib/api/contracts/match-console";
import { Redirect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { Alert } from "react-native";
import {
  fetchMatchConsole,
  runMatchConsoleAction,
  runMatchCrewAction,
  saveMatchSetScore,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { usePolling } from "~/lib/use-polling";
import { MatchConsolePanel } from "~/tournament/match-console-panel";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import { Banner, ScreenScroll, haptics } from "~/ui";

export default function MatchConsoleScreen() {
  const navigation = useNavigation();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug, matchSlug } = useLocalSearchParams<{
    slug: string;
    matchSlug: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [consoleData, setConsoleData] = useState<MatchConsoleContract | null>(
    null
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!slug || !matchSlug) {
        return Promise.reject(new Error("Match not found."));
      }
      return fetchMatchConsole(slug, matchSlug, signal);
    },
    [slug, matchSlug]
  );

  const { data, error, isRefreshing, reload, refresh, poll } = usePublicLoader(
    load,
    "Could not load the match console."
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Match console" });
  }, [navigation]);

  useLayoutEffect(() => {
    if (data) setConsoleData(data);
  }, [data]);

  usePolling(
    poll,
    4000,
    (consoleData ?? data)?.derivedPhase === "in_progress"
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug || !matchSlug) {
    return (
      <ErrorScreen
        title="Match unavailable"
        message="This link is missing the match. Go back and open it again."
      />
    );
  }
  if (data === null && error === null) return <LoadingScreen />;

  const view = consoleData ?? data;
  if (!view) {
    return (
      <ErrorScreen
        title="Match unavailable"
        message={error ?? "Could not load the match console."}
        onRetry={() => void reload()}
      />
    );
  }

  async function applyConsole(next: MatchConsoleContract) {
    setConsoleData(next);
  }

  async function runAction(action: () => Promise<{ console: MatchConsoleContract }>) {
    setBusy(true);
    setActionError(null);
    try {
      const result = await action();
      await applyConsole(result.console);
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Something went wrong."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  function confirmFinalize(winnerSlug: string | null, label: string) {
    Alert.alert("Finalize match", `Record result: ${label}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Finalize",
        onPress: () =>
          void runAction(() =>
            runMatchConsoleAction(slug!, matchSlug!, "finalize", { winnerSlug })
          ),
      },
    ]);
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh}>
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      <MatchConsolePanel
        data={view}
        busy={busy}
        onLifecycle={(action, winnerSlug) => {
          if (action === "finalize") {
            const label =
              winnerSlug === view.teamA?.slug
                ? view.teamA?.name ?? "Team A"
                : winnerSlug === view.teamB?.slug
                  ? view.teamB?.name ?? "Team B"
                  : "Tie";
            confirmFinalize(winnerSlug ?? null, label);
            return;
          }
          if (action === "reopen") {
            Alert.alert(
              "Reopen match",
              "Reopen this match for score corrections?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reopen",
                  onPress: () =>
                    void runAction(() =>
                      runMatchConsoleAction(slug!, matchSlug!, "reopen")
                    ),
                },
              ]
            );
            return;
          }
          void runAction(() =>
            runMatchConsoleAction(slug!, matchSlug!, action)
          );
        }}
        onSaveSet={async (setNumber, teamAScore, teamBScore) => {
          setActionError(null);
          try {
            const result = await saveMatchSetScore(
              slug!,
              matchSlug!,
              setNumber,
              teamAScore,
              teamBScore
            );
            await applyConsole(result.console);
          } catch (cause) {
            setActionError(messageFor(cause, "Could not save the score."));
            haptics.error();
          }
        }}
        onCrewAction={(action, role) => {
          void runAction(() => {
            if (action === "claim") {
              return runMatchCrewAction(slug!, matchSlug!, "claim", { role });
            }
            return runMatchCrewAction(slug!, matchSlug!, action);
          });
        }}
      />
    </ScreenScroll>
  );
}
