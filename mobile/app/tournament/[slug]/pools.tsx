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
  PlayDivisionContract,
  PlayPoolContract,
} from "@/lib/api/contracts/tournament";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fetchTournamentPlay } from "~/api/endpoints";
import { formatSigned } from "~/lib/format";
import { usePolling } from "~/lib/use-polling";
import { HostSettingsEntry } from "~/tournament/host-settings-entry";
import { MatchRow } from "~/tournament/match-row";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { usePublicLoader } from "~/tournament/use-public-loader";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Banner,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ScreenScroll,
  Section,
  space,
} from "~/ui";

const ALL = "__all__";

export default function PoolsScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [filter, setFilter] = useState<string>(ALL);

  const load = useCallback(
    (signal?: AbortSignal) => {
      if (!slug) return Promise.reject(new Error("Tournament not found."));
      return fetchTournamentPlay(slug, signal);
    },
    [slug]
  );

  const { data, error, refreshError, isRefreshing, reload, refresh, poll, clearError } =
    usePublicLoader(load, "Could not load pools.");

  usePolling(
    poll,
    15000,
    data?.divisions.some((division) => division.released) ?? false
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Pools" });
  }, [navigation]);

  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Pools unavailable"
        message={error ?? "Could not load pools."}
        onRetry={() => void reload()}
      />
    );
  }

  const withPools = data.divisions.filter(
    (division) =>
      division.format === "pool_to_bracket" || division.pools.length > 0
  );
  const visible =
    filter === ALL || !withPools.some((division) => division.name === filter)
      ? withPools
      : withPools.filter((division) => division.name === filter);

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={refresh}>
      {refreshError ? (
        <Banner tone="error" message={refreshError} onDismiss={clearError} />
      ) : null}
      {slug ? (
        <HostSettingsEntry
          slug={slug}
          href={`/tournament/${slug}/settings/pool`}
          title="Pool settings"
          detail="Match format, scoring, and tie-breaks"
        />
      ) : null}
      {withPools.length === 0 ? (
        <EmptyState
          icon="git-network-outline"
          title="No pool play"
          message="This tournament goes straight to the bracket."
          action={{
            label: "View bracket",
            icon: "arrow-forward",
            onPress: () => router.push(`/tournament/${slug}/bracket`),
          }}
        />
      ) : (
        <>
          {withPools.length > 1 ? (
            <ChipRow>
              <Chip
                label="All"
                selected={filter === ALL}
                onPress={() => setFilter(ALL)}
              />
              {withPools.map((division) => (
                <Chip
                  key={division.name}
                  label={division.name}
                  selected={filter === division.name}
                  onPress={() => setFilter(division.name)}
                />
              ))}
            </ChipRow>
          ) : null}
          {visible.map((division) => (
            <DivisionPools
              key={division.name}
              division={division}
              onMatchPress={(matchSlug) =>
                router.push(`/tournament/${slug}/matches/${matchSlug}`)
              }
            />
          ))}
        </>
      )}
    </ScreenScroll>
  );
}

function DivisionPools({
  division,
  onMatchPress,
}: {
  division: PlayDivisionContract;
  onMatchPress: (matchSlug: string) => void;
}) {
  return (
    <Section title={division.name}>
      {!division.released ? (
        <Card>
          <EmptyState
            compact
            icon="time-outline"
            title="Pools not posted yet"
            message="Standings appear here once the host releases play."
          />
        </Card>
      ) : division.pools.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon="grid-outline"
            title="No pools here yet"
            message="Pools appear once the host assigns teams."
          />
        </Card>
      ) : (
        <View style={styles.pools}>
          {division.pools.map((pool) => (
            <PoolBlock
              key={pool.name}
              divisionName={division.name}
              pool={pool}
              onMatchPress={onMatchPress}
            />
          ))}
        </View>
      )}
    </Section>
  );
}

function PoolBlock({
  divisionName,
  pool,
  onMatchPress,
}: {
  divisionName: string;
  pool: PlayPoolContract;
  onMatchPress: (matchSlug: string) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.pool}>
      {pool.name !== divisionName ? (
        <AppText variant="callout" weight="600">
          {pool.name}
        </AppText>
      ) : null}
      <Card padded={false}>
        <View
          style={[
            styles.tableRow,
            styles.tableHead,
            { borderBottomColor: colors.border },
          ]}
        >
          <AppText variant="caption" tone="muted" style={styles.rank}>
            #
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.teamCol}>
            Team
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.stat}>
            W-L
          </AppText>
          <AppText variant="caption" tone="muted" style={styles.stat}>
            Sets
          </AppText>
          <AppText
            variant="caption"
            tone="muted"
            style={styles.stat}
            accessibilityLabel="Point difference"
          >
            +/−
          </AppText>
        </View>
        {pool.standings.map((row, index) => (
          <View
            key={row.teamSlug}
            style={styles.tableRow}
            accessible
            accessibilityLabel={`${index + 1}. ${row.teamName}. ${row.wins} wins, ${row.losses} losses. Sets ${row.setsWon} to ${row.setsLost}. Point difference ${formatSigned(row.pointDiff)}`}
          >
            <AppText variant="footnote" tone="muted" style={styles.rank}>
              {index + 1}
            </AppText>
            <AppText
              variant="callout"
              weight="600"
              style={styles.teamCol}
              numberOfLines={1}
            >
              {row.teamName}
            </AppText>
            <AppText variant="footnote" style={styles.stat}>
              {row.wins}–{row.losses}
            </AppText>
            <AppText variant="footnote" style={styles.stat}>
              {row.setsWon}–{row.setsLost}
            </AppText>
            <AppText variant="footnote" style={styles.stat}>
              {formatSigned(row.pointDiff)}
            </AppText>
          </View>
        ))}
      </Card>
      {pool.matches.length === 0 ? (
        <AppText variant="subhead" tone="muted">
          Matches appear here after the host schedules this pool.
        </AppText>
      ) : (
        <View style={styles.matches}>
          {pool.matches.map((match) => (
            <MatchRow
              key={match.slug}
              match={match}
              compact
              onPress={() => onMatchPress(match.slug)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pools: { gap: space.xxl },
  pool: { gap: space.md },
  tableHead: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm + space.xxs,
    gap: space.sm,
  },
  rank: { width: 20, fontVariant: ["tabular-nums"] },
  teamCol: { flex: 1 },
  stat: { width: 40, textAlign: "right", fontVariant: ["tabular-nums"] },
  matches: { gap: space.sm },
});
