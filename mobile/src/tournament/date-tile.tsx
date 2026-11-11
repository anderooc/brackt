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

import { StyleSheet, View } from "react-native";
import { parseISODate } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { AppText, radius } from "~/ui";

/** A torn-off calendar page: court-blue month strip over the day number. */
export function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const colors = useThemeColors();
  const d = parseISODate(date);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        { borderColor: colors.border, backgroundColor: colors.card },
      ]}
    >
      <View
        style={[
          styles.strip,
          { backgroundColor: muted ? colors.muted : colors.hero },
        ]}
      >
        <AppText
          variant="caption"
          weight="700"
          style={[
            styles.month,
            { color: muted ? colors.mutedForeground : colors.heroForeground },
          ]}
        >
          {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
        </AppText>
      </View>
      <AppText
        variant="title"
        tone={muted ? "muted" : "default"}
        style={styles.day}
      >
        {d.getDate()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 48,
    borderRadius: radius.sm + 2,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
    alignItems: "center",
  },
  strip: { alignSelf: "stretch", alignItems: "center", paddingVertical: 2 },
  month: { fontSize: 10, lineHeight: 13 },
  day: { fontSize: 21, lineHeight: 26, fontVariant: ["tabular-nums"], paddingBottom: 2 },
});
