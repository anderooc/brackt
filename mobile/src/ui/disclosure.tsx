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

import { useCallback, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from "react-native";
import { useThemeColors } from "~/theme/colors";
import { haptics } from "~/ui/haptics";
import { Icon } from "~/ui/primitives";
import { space } from "~/ui/tokens";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

let reduceMotion = false;
void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
  reduceMotion = enabled;
});
AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
  reduceMotion = enabled;
});

/** Eases the next layout change (200 ms), or snaps when Reduce Motion is on. */
export function animateNextLayout() {
  if (reduceMotion) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(200, LayoutAnimation.Types.easeInEaseOut, "opacity")
  );
}

/** One open row at a time: opening another closes the first. */
export function useExpandedRow() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggle = useCallback((id: string) => {
    haptics.selection();
    animateNextLayout();
    setExpandedId((current) => (current === id ? null : id));
  }, []);
  const collapse = useCallback(() => {
    animateNextLayout();
    setExpandedId(null);
  }, []);
  return { expandedId, toggle, collapse };
}

/**
 * A list row whose editing controls stay folded away until it's tapped, so a
 * roster reads as a list of people rather than a wall of buttons.
 */
export function DisclosureRow({
  summary,
  expanded,
  onToggle,
  accessibilityLabel,
  children,
}: {
  summary: ReactNode;
  expanded: boolean;
  /** Omit when the viewer can't change anything on this row. */
  onToggle?: () => void;
  accessibilityLabel: string;
  children?: ReactNode;
}) {
  const colors = useThemeColors();

  if (!onToggle) {
    return <View style={styles.summary}>{summary}</View>;
  }

  return (
    <View style={expanded ? { backgroundColor: colors.muted } : null}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={expanded ? "Hides the editing options" : "Shows editing options"}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.summary,
          pressed && !expanded && { backgroundColor: colors.muted },
        ]}
      >
        <View style={styles.summaryContent}>{summary}</View>
        <Icon
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedForeground}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  summaryContent: { flex: 1, minWidth: 0 },
  body: {
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
  },
});
