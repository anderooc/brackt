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

import type { TournamentDetailContract } from "@/lib/api/contracts/tournament";
import { StyleSheet, View } from "react-native";
import { CourtScene, useCoverInks } from "~/brand/court-scene";
import { formatCalendarDate } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { AppText, Icon, radius, space, StatusBadge } from "~/ui";

/** Tournament header, matching the web cover: court scene over a soft court-blue wash. */
export function TournamentCover({
  tournament,
}: {
  tournament: TournamentDetailContract;
}) {
  const colors = useThemeColors();
  const inks = useCoverInks();

  return (
    <View
      style={[
        styles.cover,
        { backgroundColor: inks.mist.color, borderColor: colors.border },
      ]}
    >
      <CourtScene width={176} style={styles.art} />
      <View style={styles.body}>
        <StatusBadge kind="tournament" status={tournament.status} date={tournament.date} />
        <AppText variant="largeTitle" accessibilityRole="header">
          {tournament.name}
        </AppText>
        <View style={styles.meta}>
          <Icon name="calendar-outline" size={15} tone="primary" />
          <AppText variant="subhead" weight="600" tone="secondary">
            {formatCalendarDate(tournament.date)}
          </AppText>
          <Icon name="location-outline" size={15} tone="primary" />
          <AppText
            variant="subhead"
            weight="600"
            tone="secondary"
            numberOfLines={1}
            style={styles.place}
          >
            {tournament.location}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    paddingTop: space.sm,
  },
  art: { alignSelf: "center" },
  body: {
    gap: space.sm,
    paddingHorizontal: space.lg + 4,
    paddingBottom: space.xl,
    marginTop: -space.md,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: space.xs },
  place: { flexShrink: 1, marginLeft: space.xxs },
});
