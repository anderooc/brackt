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

import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { formatMatchTime, PERSONAL_SCHEDULE_ROLE_LABELS } from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { AppText, Badge, Icon, radius, space, StatusBadge } from "~/ui";

/** The viewer's next match, with enough detail to know where to be. */
export function UpNextMatch({
  match,
  showTournament = true,
}: {
  match: PersonalScheduleMatchContract;
  showTournament?: boolean;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const day = new Date(match.scheduledTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = formatMatchTime(match.scheduledTime);
  const where = [match.courtName, match.contextLabel].filter(Boolean).join(" · ");
  const role = PERSONAL_SCHEDULE_ROLE_LABELS[match.role] ?? match.role;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Up next: ${day} at ${time}. ${match.teamAName} versus ${match.teamBName}. ${where}. ${role}`}
      onPress={() =>
        router.push(`/tournament/${match.tournamentSlug}/matches/${match.matchSlug}`)
      }
      style={({ pressed }) => [
        styles.card,
        {
          borderColor: colors.border,
          backgroundColor: withAlpha(colors.primary, pressed ? 0.14 : 0.07),
        },
      ]}
    >
      <View style={styles.when}>
        <AppText variant="footnote" tone="muted">
          {day}
        </AppText>
        <AppText variant="title" numberOfLines={1} style={styles.tabular}>
          {time}
        </AppText>
        {match.warmupStart ? (
          <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.tabular}>
            Warmup {formatMatchTime(match.warmupStart)}
          </AppText>
        ) : null}
      </View>
      <View style={styles.body}>
        {showTournament ? (
          <AppText variant="footnote" tone="muted" weight="500" numberOfLines={1}>
            {match.tournamentName}
          </AppText>
        ) : null}
        <AppText variant="callout" weight="600" numberOfLines={2}>
          {match.teamAName}
          <AppText variant="callout" tone="muted">
            {" vs "}
          </AppText>
          {match.teamBName}
        </AppText>
        {where ? (
          <AppText variant="footnote" tone="muted" numberOfLines={1}>
            {where}
          </AppText>
        ) : null}
        <View style={styles.tags}>
          <Badge label={role} tone={match.role === "playing" ? "info" : "warning"} />
          {match.status !== "upcoming" ? (
            <StatusBadge kind="match" status={match.status} />
          ) : null}
          {match.myTeamName ? (
            <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.team}>
              {match.myTeamName}
            </AppText>
          ) : null}
        </View>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  when: { width: 112, gap: space.xxs },
  body: { flex: 1, minWidth: 0, gap: space.xs },
  tags: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  team: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
});
