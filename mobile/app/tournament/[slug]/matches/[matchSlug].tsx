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

import type { TournamentMatchDetailContract } from "@/lib/api/contracts/tournament";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fetchMatchConsole, fetchTournamentMatch } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { formatMatchTime } from "~/lib/format";
import { usePolling } from "~/lib/use-polling";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { usePublicLoader } from "~/tournament/use-public-loader";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Banner,
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  StatusBadge,
  space,
} from "~/ui";

export default function MatchDetailScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { session } = useSession();
  const { slug, matchSlug } = useLocalSearchParams<{
    slug: string;
    matchSlug: string;
  }>();
  const [canOpenConsole, setCanOpenConsole] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!slug || !matchSlug) {
        return Promise.reject(new Error("Match not found."));
      }
      return fetchTournamentMatch(slug, matchSlug, signal);
    },
    [slug, matchSlug]
  );

  const { data, error, refreshError, isRefreshing, reload, refresh, poll } =
    usePublicLoader(load, "Could not load this match.");

  usePolling(poll, 5000, data?.status === "in_progress");

  useEffect(() => {
    if (!session || !slug || !matchSlug) {
      setCanOpenConsole(false);
      return;
    }
    const controller = new AbortController();
    void fetchMatchConsole(slug, matchSlug, controller.signal)
      .then((console) => {
        const perms = console.permissions;
        setCanOpenConsole(
          perms.canScore ||
            perms.canRunLifecycle ||
            perms.canClaimCrewSlot ||
            perms.isOrganizer ||
            perms.isRefMember
        );
      })
      .catch(() => {
        setCanOpenConsole(false);
      });
    return () => controller.abort();
  }, [session, slug, matchSlug, data?.status]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Match" });
  }, [navigation]);

  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Match unavailable"
        message={error ?? "Could not load this match."}
        onRetry={() => void reload()}
      />
    );
  }

  const sets = data.sets.slice().sort((a, b) => a.setNumber - b.setNumber);
  const setsWonA = sets.filter((set) => set.teamAScore > set.teamBScore).length;
  const setsWonB = sets.filter((set) => set.teamBScore > set.teamAScore).length;

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh} gap={space.xxl}>
      {refreshError ? <Banner tone="error" message={refreshError} /> : null}

      <Card style={styles.scoreboard}>
        <View style={styles.boardTop}>
          <StatusBadge kind="match" status={data.status} />
          <AppText variant="footnote" tone="muted" numberOfLines={1} style={styles.tournamentName}>
            {data.tournamentName}
          </AppText>
        </View>
        <View style={styles.teams}>
          <TeamSide
            name={data.teamA?.name ?? "TBD"}
            won={data.winnerSlug != null && data.winnerSlug === data.teamA?.slug}
          />
          <View style={styles.total} accessible accessibilityLabel={`Sets ${setsWonA} to ${setsWonB}`}>
            <AppText variant="largeTitle" style={styles.totalText}>
              {setsWonA}
              <AppText variant="title" tone="muted">
                {"  –  "}
              </AppText>
              {setsWonB}
            </AppText>
            <AppText variant="caption" tone="muted">
              Sets
            </AppText>
          </View>
          <TeamSide
            name={data.teamB?.name ?? "TBD"}
            won={data.winnerSlug != null && data.winnerSlug === data.teamB?.slug}
          />
        </View>
      </Card>

      {canOpenConsole ? (
        <Button
          label="Open match console"
          icon="create-outline"
          fullWidth
          onPress={() => router.push(`/tournament/${slug}/matches/${matchSlug}/console`)}
        />
      ) : null}

      <Section title="Set scores">
        {sets.length === 0 ? (
          <AppText variant="subhead" tone="muted">
            {data.status === "upcoming"
              ? "Set scores appear here once the match starts."
              : "No set scores posted yet."}
          </AppText>
        ) : (
          <ListGroup>
            {sets.map((set) => (
              <SetRow key={set.setNumber} set={set} />
            ))}
          </ListGroup>
        )}
      </Section>

      <Section title="Details">
        <ListGroup>
          {data.scheduledTime ? (
            <ListRow icon="time-outline" iconTone="secondary" title={formatMatchTime(data.scheduledTime)} subtitle="Start time" />
          ) : null}
          {data.courtName ? (
            <ListRow icon="location-outline" iconTone="secondary" title={data.courtName} subtitle="Court" />
          ) : null}
          <ListRow
            icon={data.phase === "bracket" ? "git-network-outline" : "grid-outline"}
            iconTone="secondary"
            title={data.divisionName ?? (data.phase === "bracket" ? "Bracket" : "Pool play")}
            subtitle={data.phase === "bracket" ? "Bracket" : "Pool"}
          />
          {data.refTeamName ? (
            <ListRow icon="flag-outline" iconTone="secondary" title={data.refTeamName} subtitle="Reffing team" />
          ) : null}
        </ListGroup>
      </Section>
    </ScreenScroll>
  );
}

function TeamSide({ name, won }: { name: string; won: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={styles.teamSide}>
      <AppText
        variant="headline"
        weight={won ? "700" : "600"}
        tone={name === "TBD" ? "muted" : "default"}
        numberOfLines={3}
        style={styles.teamName}
      >
        {name}
      </AppText>
      {won ? (
        <View style={styles.winner}>
          <Icon name="trophy" size={14} color={colors.success} />
          <AppText variant="caption" tone="success">
            Winner
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

function SetRow({ set }: { set: TournamentMatchDetailContract["sets"][number] }) {
  const aWon = set.teamAScore > set.teamBScore;
  const bWon = set.teamBScore > set.teamAScore;
  return (
    <View
      style={styles.setRow}
      accessible
      accessibilityLabel={`Set ${set.setNumber}: ${set.teamAScore} to ${set.teamBScore}`}
    >
      <AppText variant="subhead" tone="muted" style={styles.setLabel}>
        Set {set.setNumber}
      </AppText>
      <AppText variant="title" weight={aWon ? "700" : "400"} tone={aWon ? "default" : "muted"} style={styles.setScore}>
        {set.teamAScore}
      </AppText>
      <AppText variant="subhead" tone="muted">
        –
      </AppText>
      <AppText variant="title" weight={bWon ? "700" : "400"} tone={bWon ? "default" : "muted"} style={styles.setScore}>
        {set.teamBScore}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreboard: { gap: space.lg, paddingVertical: space.xl },
  boardTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tournamentName: { flex: 1, textAlign: "right" },
  teams: { flexDirection: "row", alignItems: "center", gap: space.sm },
  teamSide: { flex: 1, alignItems: "center", gap: space.xs },
  teamName: { textAlign: "center" },
  winner: { flexDirection: "row", alignItems: "center", gap: space.xxs },
  total: { alignItems: "center", minWidth: 96 },
  totalText: { fontVariant: ["tabular-nums"], fontSize: 40, lineHeight: 46 },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  setLabel: { flex: 1 },
  setScore: { width: 44, textAlign: "center", fontVariant: ["tabular-nums"] },
});
