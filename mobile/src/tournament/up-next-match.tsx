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
import { AppText, Icon, radius, space } from "~/ui";

/**
 * The viewer's next match, with enough detail to know where to be.
 * `accent` is a solid court-blue card for plain screens; `raised` is a light
 * card for sitting on the court-blue Home header.
 */
export function UpNextMatch({
  match,
  showTournament = true,
  variant = "accent",
}: {
  match: PersonalScheduleMatchContract;
  showTournament?: boolean;
  variant?: "accent" | "raised";
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const accent = variant === "accent";
  const ink = accent
    ? { fg: colors.heroForeground, muted: colors.heroMuted, time: colors.heroForeground }
    : { fg: colors.foreground, muted: colors.mutedForeground, time: colors.primary };
  const pill = accent
    ? { bg: withAlpha("#ffffff", 0.16), fg: colors.heroForeground }
    : { bg: withAlpha(colors.primary, 0.1), fg: colors.primary };

  const day = new Date(match.scheduledTime).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = formatMatchTime(match.scheduledTime);
  const where = [match.courtName, match.contextLabel].filter(Boolean).join(" · ");
  const role = PERSONAL_SCHEDULE_ROLE_LABELS[match.role] ?? match.role;
  const live = match.status === "in_progress";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${live ? "Live now" : "Up next"}: ${day} at ${time}. ${match.teamAName} versus ${match.teamBName}. ${where}. ${role}`}
      onPress={() =>
        router.push(`/tournament/${match.tournamentSlug}/matches/${match.matchSlug}`)
      }
      style={({ pressed }) => [
        styles.card,
        accent
          ? { backgroundColor: colors.hero }
          : {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: StyleSheet.hairlineWidth * 2,
              shadowColor: "#0b1a33",
            },
        !accent && styles.raised,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <View style={styles.when}>
          <AppText variant="footnote" weight="600" style={{ color: ink.muted }}>
            {day}
          </AppText>
          <AppText variant="largeTitle" numberOfLines={1} style={[styles.time, { color: ink.time }]}>
            {time}
          </AppText>
        </View>
        {live ? (
          <View style={[styles.pill, { backgroundColor: colors.live }]}>
            <View style={styles.liveDot} />
            <AppText variant="caption" weight="700" style={{ color: "#ffffff" }}>
              Live
            </AppText>
          </View>
        ) : match.warmupStart ? (
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <Icon name="timer-outline" size={13} color={pill.fg} />
            <AppText variant="caption" weight="600" style={[styles.tabular, { color: pill.fg }]}>
              Warmup {formatMatchTime(match.warmupStart)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        {showTournament ? (
          <AppText variant="footnote" weight="500" numberOfLines={1} style={{ color: ink.muted }}>
            {match.tournamentName}
          </AppText>
        ) : null}
        <AppText variant="headline" numberOfLines={2} style={{ color: ink.fg }}>
          {match.teamAName}
          <AppText variant="headline" weight="600" style={{ color: ink.muted }}>
            {"  vs  "}
          </AppText>
          {match.teamBName}
        </AppText>
        <View style={styles.meta}>
          <View style={[styles.pill, { backgroundColor: pill.bg }]}>
            <AppText variant="caption" weight="700" style={{ color: pill.fg }}>
              {role}
            </AppText>
          </View>
          <AppText variant="footnote" numberOfLines={1} style={[styles.where, { color: ink.muted }]}>
            {[where, match.myTeamName].filter(Boolean).join(" · ")}
          </AppText>
          <Icon name="arrow-forward" size={18} color={ink.muted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    gap: space.md,
    borderRadius: radius.lg + 4,
  },
  raised: {
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.md,
  },
  when: { gap: space.xxs, flexShrink: 1 },
  time: { fontSize: 34, lineHeight: 38, fontVariant: ["tabular-nums"] },
  body: { gap: space.sm },
  meta: { flexDirection: "row", alignItems: "center", gap: space.sm },
  where: { flex: 1, minWidth: 0 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
  tabular: { fontVariant: ["tabular-nums"] },
});
