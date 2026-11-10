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
import { AppText, radius, space } from "~/ui";

/** Month over day-of-month, for scanning a list of events by date. */
export function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const colors = useThemeColors();
  const d = parseISODate(date);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          borderColor: colors.border,
          backgroundColor: muted ? "transparent" : colors.background,
        },
      ]}
    >
      <AppText variant="caption" tone="muted">
        {d.toLocaleDateString("en-US", { month: "short" })}
      </AppText>
      <AppText
        variant="headline"
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
    width: 46,
    alignItems: "center",
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  day: { fontVariant: ["tabular-nums"], lineHeight: 20 },
});
