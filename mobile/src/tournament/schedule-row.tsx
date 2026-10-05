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

import type { TournamentListItemContract } from "@/lib/api/contracts/tournament";
import { Pressable, StyleSheet, View } from "react-native";
import {
  GENDER_LABELS,
  REGION_LABELS,
  registrationAvailabilityLabel,
  tournamentListStatusLabel,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { AppText, Badge, Icon, space, statusTone } from "~/ui";

export function ScheduleRow({
  tournament,
  today,
  onPress,
}: {
  tournament: TournamentListItemContract;
  today: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const status = tournamentListStatusLabel(tournament.status, tournament.date, today);
  const gender = GENDER_LABELS[tournament.gender] ?? tournament.gender;
  const region = REGION_LABELS[tournament.region] ?? tournament.region;
  const availability = registrationAvailabilityLabel(tournament.registrationAvailability);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tournament.name}, ${status}, ${tournament.location}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.muted : "transparent" },
      ]}
    >
      <View style={styles.body}>
        <View style={styles.top}>
          <AppText variant="headline" numberOfLines={2} style={styles.name}>
            {tournament.name}
          </AppText>
          <Badge
            label={status}
            tone={statusTone("tournament", tournament.status, tournament.date).tone}
          />
        </View>
        <MetaLine icon="location-outline" text={tournament.location} />
        <MetaLine icon="people-outline" text={`${gender} · ${region}`} />
        <MetaLine icon="clipboard-outline" text={availability} />
        {tournament.hostSchool ? (
          <AppText variant="footnote" tone="secondary" weight="600" numberOfLines={1}>
            Hosted by {tournament.hostSchool.name}
          </AppText>
        ) : null}
      </View>
      <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function MetaLine({
  icon,
  text,
}: {
  icon: "location-outline" | "people-outline" | "clipboard-outline";
  text: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.metaLine}>
      <Icon name={icon} size={14} color={colors.mutedForeground} />
      <AppText variant="footnote" tone="muted" numberOfLines={1} style={styles.metaText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
  },
  body: { flex: 1, minWidth: 0, gap: space.xs },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: space.sm,
    marginBottom: space.xxs,
  },
  name: { flex: 1 },
  metaLine: { flexDirection: "row", alignItems: "center", gap: space.xs },
  metaText: { flexShrink: 1 },
});
