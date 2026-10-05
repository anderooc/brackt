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

import { Pressable, StyleSheet, View } from "react-native";
import { formatMonthTitle, parseISODate } from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import {
  AppText,
  haptics,
  HIT_TARGET,
  IconButton,
  radius,
  space,
} from "~/ui";
import { monthCellIsos, shiftMonth } from "./filter-tournament-list";

const WEEKDAYS = [
  { key: "sun", short: "S", label: "Sunday" },
  { key: "mon", short: "M", label: "Monday" },
  { key: "tue", short: "T", label: "Tuesday" },
  { key: "wed", short: "W", label: "Wednesday" },
  { key: "thu", short: "T", label: "Thursday" },
  { key: "fri", short: "F", label: "Friday" },
  { key: "sat", short: "S", label: "Saturday" },
] as const;

const DAY_SIZE = 36;

export function MonthCalendar({
  selectedDate,
  today,
  markedDates,
  month,
  onMonthChange,
  onSelectDate,
}: {
  selectedDate: string;
  today: string;
  markedDates: ReadonlySet<string>;
  month: { year: number; monthIndex: number };
  onMonthChange: (next: { year: number; monthIndex: number }) => void;
  onSelectDate: (iso: string) => void;
}) {
  const colors = useThemeColors();
  const cells = monthCellIsos(month.year, month.monthIndex);
  const monthTitle = formatMonthTitle(month.year, month.monthIndex);

  return (
    <View
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}
      accessibilityLabel={`Calendar, ${monthTitle}`}
    >
      <View style={styles.monthBar}>
        <IconButton
          icon="chevron-back"
          accessibilityLabel="Previous month"
          onPress={() => {
            haptics.selection();
            onMonthChange(shiftMonth(month.year, month.monthIndex, -1));
          }}
        />
        <AppText variant="headline" accessibilityRole="header">
          {monthTitle}
        </AppText>
        <IconButton
          icon="chevron-forward"
          accessibilityLabel="Next month"
          onPress={() => {
            haptics.selection();
            onMonthChange(shiftMonth(month.year, month.monthIndex, 1));
          }}
        />
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((day) => (
          <AppText
            key={day.key}
            variant="caption"
            tone="muted"
            accessibilityLabel={day.label}
            style={styles.weekday}
          >
            {day.short}
          </AppText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((iso, index) => {
          if (!iso) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }
          const isSelected = iso === selectedDate;
          const isToday = iso === today;
          const hasEvents = markedDates.has(iso);
          const dayNumber = parseISODate(iso).getDate();
          return (
            <Pressable
              key={iso}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${formatA11yDay(iso)}${hasEvents ? ", has tournaments" : ""}${isToday ? ", today" : ""}`}
              onPress={() => {
                haptics.selection();
                onSelectDate(iso);
              }}
              style={styles.dayCell}
            >
              {({ pressed }) => (
                <>
                  <View
                    style={[
                      styles.dayHit,
                      pressed && !isSelected && { backgroundColor: colors.muted },
                      isToday &&
                        !isSelected && {
                          borderColor: colors.primary,
                          borderWidth: 1,
                          backgroundColor: withAlpha(colors.primary, pressed ? 0.16 : 0.08),
                        },
                      isSelected && {
                        backgroundColor: pressed
                          ? withAlpha(colors.primary, 0.85)
                          : colors.primary,
                      },
                    ]}
                  >
                    <AppText
                      variant="subhead"
                      weight={isSelected || isToday ? "700" : "500"}
                      style={{
                        color: isSelected
                          ? colors.primaryForeground
                          : isToday
                            ? colors.primary
                            : colors.foreground,
                      }}
                    >
                      {dayNumber}
                    </AppText>
                  </View>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: hasEvents
                          ? isSelected
                            ? colors.primary
                            : colors.mutedForeground
                          : "transparent",
                      },
                    ]}
                  />
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatA11yDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.lg,
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.xs,
  },
  weekRow: { flexDirection: "row" },
  weekday: {
    width: "14.285%",
    textAlign: "center",
    paddingBottom: space.xs,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.285%",
    alignItems: "center",
    justifyContent: "center",
    minHeight: HIT_TARGET + space.xs,
    paddingTop: space.xxs,
  },
  dayHit: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: radius.full,
    marginTop: space.xxs,
  },
});
