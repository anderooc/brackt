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

import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { Pressable, StyleSheet, View } from "react-native";
import {
  formatMatchTime,
  formatSetLine,
  MATCH_STATUS_LABELS,
} from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { AppText, Icon, StatusBadge, radius, space } from "~/ui";

export function MatchRow({
  match,
  onPress,
  compact,
}: {
  match: TournamentMatchContract;
  onPress?: () => void;
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const status = MATCH_STATUS_LABELS[match.status] ?? match.status;
  const setLine = formatSetLine(match.sets);
  const teamA = match.teamA?.name ?? "TBD";
  const teamB = match.teamB?.name ?? "TBD";
  const live = match.status === "in_progress";
  const meta = [
    match.scheduledTime ? formatMatchTime(match.scheduledTime) : null,
    match.courtName,
    compact ? null : match.phase === "bracket" ? "Bracket" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${status}. ${teamA} versus ${teamB}. ${meta}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderColor: live ? withAlpha(colors.live, 0.5) : colors.border,
          backgroundColor: pressed
            ? colors.muted
            : live
              ? withAlpha(colors.live, 0.04)
              : colors.card,
        },
      ]}
    >
      <View style={styles.top}>
        <StatusBadge kind="match" status={match.status} />
        {meta ? (
          <AppText variant="footnote" tone="muted" numberOfLines={1} style={styles.meta}>
            {meta}
          </AppText>
        ) : null}
        {onPress ? (
          <Icon name="chevron-forward" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>

      <TeamLine name={teamA} won={match.winnerSlug === match.teamA?.slug} />
      <TeamLine name={teamB} won={match.winnerSlug === match.teamB?.slug} />

      {setLine ? (
        <AppText
          variant="footnote"
          tone="muted"
          style={[styles.sets, { fontVariant: ["tabular-nums"] }]}
        >
          {setLine}
        </AppText>
      ) : null}
    </Pressable>
  );
}

function TeamLine({ name, won }: { name: string; won: boolean }) {
  const colors = useThemeColors();
  return (
    <View style={styles.teamLine}>
      <AppText
        variant="body"
        weight={won ? "700" : "500"}
        tone={name === "TBD" ? "muted" : "default"}
        numberOfLines={1}
        style={styles.teamName}
      >
        {name}
      </AppText>
      {won ? (
        <Icon name="checkmark-circle" size={16} color={colors.success} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.xs,
  },
  meta: { flex: 1, textAlign: "right" },
  teamLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
  teamName: { flexShrink: 1 },
  sets: { marginTop: space.xs },
});
