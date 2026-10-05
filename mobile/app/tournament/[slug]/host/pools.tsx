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
  TournamentHostDivisionPoolsContract,
  TournamentHostPoolContract,
  TournamentHostPoolsContract,
} from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import {
  fetchTournamentHostPools,
  releaseTournamentHostDivisionPools,
  updateTournamentHostPoolSeeding,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  haptics,
  HIT_TARGET,
  Icon,
  ListGroup,
  ListRow,
  radius,
  ScreenScroll,
  space,
  type IconName,
} from "~/ui";

export default function TournamentHostPoolsScreen() {
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [payload, setPayload] = useState<TournamentHostPoolsContract | null>(
    null
  );
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostPools(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load pools."
  );

  useEffect(() => {
    if (data) setPayload(data.pools);
  }, [data]);

  const pools = payload ?? data?.pools ?? null;

  const runAction = useCallback(
    async (
      key: string,
      action: () => Promise<{ pools: TournamentHostPoolsContract }>,
      success: string
    ) => {
      setBusyKey(key);
      setActionError(null);
      setNotice(null);
      try {
        const result = await action();
        setPayload(result.pools);
        haptics.success();
        setNotice(success);
      } catch (cause) {
        haptics.error();
        setActionError(messageFor(cause, "Could not update pools."));
      } finally {
        setBusyKey(null);
      }
    },
    []
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
  if (error && !pools) {
    return (
      <ErrorScreen
        title="Pools unavailable"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  if (!pools) return <LoadingScreen />;

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      {pools.poolAssignmentBlocked ? (
        <Banner tone="info" message={pools.poolAssignmentBlocked} />
      ) : null}
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
          title="View public pools"
          subtitle="Standings and matches teams see after release"
          icon="eye-outline"
          onPress={() => router.push(`/tournament/${slug}/pools`)}
        />
      </ListGroup>

      {pools.divisions.length === 0 ? (
        <Card>
          <EmptyState
            icon="grid-outline"
            title="No pools yet"
            message="Add pools and courts in Setup, then assign teams to them in Registrations."
            action={{
              label: "Open Setup",
              icon: "construct-outline",
              onPress: () => router.push(`/tournament/${slug}/host/setup`),
            }}
          />
        </Card>
      ) : (
        pools.divisions.map((division) => (
          <DivisionPoolsCard
            key={division.id}
            division={division}
            canAssignPools={pools.canAssignPools}
            busyKey={busyKey}
            onAssignTeams={() =>
              router.push(`/tournament/${slug}/host/registrations?tab=teams`)
            }
            onRelease={() =>
              Alert.alert(
                `Release ${division.name}?`,
                "Pools, standings, and matches become visible to all teams and fans.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Release",
                    onPress: () =>
                      void runAction(
                        `release-${division.id}`,
                        () =>
                          releaseTournamentHostDivisionPools(slug, division.id).then(
                            (result) => ({ pools: result.pools })
                          ),
                        `${division.name} released to teams.`
                      ),
                  },
                ]
              )
            }
            onSaveSeeding={(poolId, poolName, teamIds) =>
              void runAction(
                `seed-${poolId}`,
                () =>
                  updateTournamentHostPoolSeeding(slug, poolId, teamIds).then(
                    (result) => ({ pools: result.pools })
                  ),
                `Seeding saved for ${poolName}.`
              )
            }
          />
        ))
      )}
    </ScreenScroll>
  );
}

function DivisionPoolsCard({
  division,
  canAssignPools,
  busyKey,
  onAssignTeams,
  onRelease,
  onSaveSeeding,
}: {
  division: TournamentHostDivisionPoolsContract;
  canAssignPools: boolean;
  busyKey: string | null;
  onAssignTeams: () => void;
  onRelease: () => void;
  onSaveSeeding: (poolId: string, poolName: string, teamIds: string[]) => void;
}) {
  const released = division.poolsReleasedAt != null;
  const hasTeams =
    division.pools.length > 0 && division.pools.some((pool) => pool.teams.length > 0);

  return (
    <Card style={styles.divisionCard}>
      <View style={styles.divisionHeader}>
        <AppText variant="headline" style={styles.flex}>
          {division.name}
        </AppText>
        <Badge
          label={released ? "Released" : "Host only"}
          tone={released ? "success" : "neutral"}
        />
      </View>
      {division.matchCount > 0 ? (
        <AppText variant="footnote" tone="muted">
          {division.completedMatchCount} of {division.matchCount} matches complete
        </AppText>
      ) : null}

      {!hasTeams ? (
        <EmptyState
          compact
          icon="people-outline"
          title="No teams assigned"
          message={`Assign confirmed teams to ${division.name} in Registrations.`}
          action={{ label: "Assign teams", icon: "people-outline", onPress: onAssignTeams }}
        />
      ) : (
        division.pools.map((pool) =>
          division.format === "pool_to_bracket" ? (
            <PoolSeeding
              key={pool.id}
              pool={pool}
              canEdit={canAssignPools}
              busy={busyKey === `seed-${pool.id}`}
              onSave={onSaveSeeding}
            />
          ) : (
            <ListGroup key={pool.id}>
              <ListRow
                title={pool.name}
                subtitle={`${pool.matchCount} matches · ${pool.teams.length} teams`}
              />
            </ListGroup>
          )
        )
      )}

      {!released ? (
        <View style={styles.releaseBlock}>
          <AppText variant="footnote" tone="muted">
            {division.matchCount === 0
              ? "Save seeding to generate matches, then release."
              : "Teams and fans can't see these pools until you release them."}
          </AppText>
          <Button
            label="Release to teams"
            icon="megaphone-outline"
            onPress={onRelease}
            loading={busyKey === `release-${division.id}`}
            disabled={division.matchCount === 0}
            fullWidth
          />
        </View>
      ) : null}
    </Card>
  );
}

function PoolSeeding({
  pool,
  canEdit,
  busy,
  onSave,
}: {
  pool: TournamentHostPoolContract;
  canEdit: boolean;
  busy: boolean;
  onSave: (poolId: string, poolName: string, teamIds: string[]) => void;
}) {
  const sorted = [...pool.teams].sort((a, b) => {
    const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
    const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });
  const savedOrder = sorted.map((team) => team.id);
  const [order, setOrder] = useState(savedOrder);

  useEffect(() => {
    setOrder(savedOrder);
  }, [pool.id, pool.teams.map((team) => `${team.id}:${team.seed}`).join(",")]);

  const teamById = new Map(pool.teams.map((team) => [team.id, team]));
  const locked = pool.matchesStarted || !canEdit;
  const dirty = order.join(",") !== savedOrder.join(",");

  if (pool.teams.length < 2) {
    return (
      <AppText variant="footnote" tone="muted">
        Add at least 2 teams to {pool.name} before setting seeds.
      </AppText>
    );
  }

  const move = (index: number, direction: -1 | 1) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <View style={styles.seeding}>
      <View style={styles.seedingHeader}>
        <AppText variant="callout" weight="600">
          {pool.name}
        </AppText>
        <AppText variant="footnote" tone="muted">
          {locked
            ? pool.matchesStarted
              ? "Matches have started, so seeding is locked."
              : "Seeding is read-only right now."
            : "Seed 1 is the top seed. Saving creates round-robin matches."}
        </AppText>
      </View>
      <ListGroup>
        {order.map((teamId, index) => {
          const team = teamById.get(teamId);
          if (!team) return null;
          return (
            <View key={teamId} style={styles.seedRow}>
              <AppText variant="headline" tone="primary" style={styles.seedRank}>
                {index + 1}
              </AppText>
              <View style={styles.flex}>
                <AppText variant="callout" weight="600" numberOfLines={1}>
                  {team.name}
                </AppText>
                <AppText variant="footnote" tone="muted" numberOfLines={1}>
                  {team.university}
                </AppText>
              </View>
              {!locked ? (
                <View style={styles.seedControls}>
                  <ReorderButton
                    icon="chevron-up"
                    accessibilityLabel={`Move ${team.name} up`}
                    disabled={busy || index === 0}
                    onPress={() => move(index, -1)}
                  />
                  <ReorderButton
                    icon="chevron-down"
                    accessibilityLabel={`Move ${team.name} down`}
                    disabled={busy || index === order.length - 1}
                    onPress={() => move(index, 1)}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </ListGroup>
      {!locked ? (
        <Button
          label={
            pool.matchCount > 0 && !dirty
              ? "Save seeding"
              : "Save seeding and create matches"
          }
          variant={dirty || pool.matchCount === 0 ? "primary" : "outline"}
          onPress={() => onSave(pool.id, pool.name, order)}
          loading={busy}
          fullWidth
        />
      ) : null}
    </View>
  );
}

function ReorderButton({
  icon,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.reorderButton,
        {
          backgroundColor: pressed ? colors.muted : "transparent",
          opacity: disabled ? 0.3 : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} tone="primary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  divisionCard: { gap: space.md },
  divisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  releaseBlock: { gap: space.sm },
  seeding: { gap: space.sm },
  seedingHeader: { gap: space.xxs },
  seedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: HIT_TARGET + 12,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
  },
  seedRank: { width: 24, textAlign: "center" },
  seedControls: { flexDirection: "row" },
  reorderButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
