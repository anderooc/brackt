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

import { useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { formatRailDate } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { AppText, haptics, radius, space } from "~/ui";

const DATE_RAIL_ITEM_HEIGHT = 60;
const DATE_RAIL_ITEM_GAP = space.xs;
const DATE_RAIL_STRIDE = DATE_RAIL_ITEM_HEIGHT + DATE_RAIL_ITEM_GAP;
const DATE_RAIL_PADDING = space.sm;
const DATE_RAIL_WIDTH = 84;

export function DateRail({
  dates,
  selectedDate,
  today,
  onSelect,
}: {
  dates: string[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}) {
  const colors = useThemeColors();
  const listRef = useRef<FlatList<string>>(null);
  const selectedIndex = dates.indexOf(selectedDate);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: selectedIndex,
        viewPosition: 0.4,
        animated: true,
      });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex]);

  return (
    <View
      style={[
        styles.rail,
        { backgroundColor: colors.muted, borderLeftColor: colors.border },
      ]}
      accessibilityLabel="Date selector"
    >
      <FlatList
        ref={listRef}
        data={dates}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: DATE_RAIL_STRIDE,
          offset: DATE_RAIL_PADDING + DATE_RAIL_STRIDE * index,
          index,
        })}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({
              index,
              viewPosition: 0.4,
              animated: false,
            });
          }, 80);
        }}
        contentContainerStyle={styles.railContent}
        renderItem={({ item }) => {
          const isSelected = item === selectedDate;
          const isToday = item === today;
          const { weekday, monthDay } = formatRailDate(item);
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={
                isToday ? `Today, ${monthDay}` : `${weekday}, ${monthDay}`
              }
              onPress={() => {
                if (!isSelected) haptics.selection();
                onSelect(item);
              }}
              style={({ pressed }) => [
                styles.item,
                isSelected
                  ? { backgroundColor: colors.card, borderColor: colors.border }
                  : pressed && { backgroundColor: colors.background },
              ]}
            >
              {isSelected ? (
                <View style={[styles.indicator, { backgroundColor: colors.primary }]} />
              ) : null}
              <AppText
                variant="caption"
                weight={isToday || isSelected ? "700" : "600"}
                tone={isToday ? "primary" : isSelected ? "default" : "muted"}
                style={isToday ? styles.todayLabel : undefined}
              >
                {isToday ? "Today" : weekday}
              </AppText>
              <AppText
                variant="footnote"
                weight={isSelected ? "700" : "500"}
                tone={isSelected ? "default" : "muted"}
              >
                {monthDay}
              </AppText>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: DATE_RAIL_WIDTH,
    alignSelf: "stretch",
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  railContent: {
    paddingVertical: DATE_RAIL_PADDING,
    paddingHorizontal: space.xs,
    gap: DATE_RAIL_ITEM_GAP,
  },
  item: {
    height: DATE_RAIL_ITEM_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    gap: space.xxs,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  indicator: {
    position: "absolute",
    left: 0,
    top: space.md,
    bottom: space.md,
    width: 3,
    borderTopRightRadius: radius.full,
    borderBottomRightRadius: radius.full,
  },
  todayLabel: { textTransform: "uppercase", letterSpacing: 0.5 },
});
