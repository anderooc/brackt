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

import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { formatMatchTime, MATCH_STATUS_LABELS } from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { AppText, Icon, StatusBadge, space } from "~/ui";

/** One scheduled match: a time column on the left, matchup and context on the right. */
export function ScheduleMatchItem({
  scheduledTime,
  status,
  teamAName,
  teamBName,
  eyebrow,
  details,
  footer,
  onPress,
}: {
  scheduledTime: string;
  status: string;
  teamAName: string;
  teamBName: string;
  eyebrow?: string | null;
  details: (string | null | undefined)[];
  footer?: ReactNode;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const live = status === "in_progress";
  const statusLabel = MATCH_STATUS_LABELS[status] ?? status;
  const detail = details.filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatMatchTime(scheduledTime)}, ${statusLabel}. ${teamAName} versus ${teamBName}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed
            ? colors.muted
            : live
              ? withAlpha(colors.live, 0.05)
              : "transparent",
        },
      ]}
    >
      <View style={styles.timeColumn}>
        <AppText variant="subhead" weight="700" style={{ fontVariant: ["tabular-nums"] }}>
          {formatMatchTime(scheduledTime)}
        </AppText>
        {status !== "upcoming" ? <StatusBadge kind="match" status={status} /> : null}
      </View>
      <View style={styles.body}>
        {eyebrow ? (
          <AppText variant="footnote" tone="secondary" weight="600" numberOfLines={1}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="callout" weight="600" numberOfLines={2}>
          {teamAName} vs {teamBName}
        </AppText>
        {detail ? (
          <AppText variant="footnote" tone="muted" numberOfLines={2}>
            {detail}
          </AppText>
        ) : null}
        {footer}
      </View>
      <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  timeColumn: { width: 72, gap: space.xs, alignSelf: "flex-start", paddingTop: 1 },
  body: { flex: 1, minWidth: 0, gap: space.xxs },
});
