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

import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { haptics } from "~/ui/haptics";
import {
  motion,
  timingConfig,
  useReducedMotion,
} from "~/ui/motion";
import { AppText, Icon } from "~/ui/primitives";
import { HIT_TARGET, radius, space } from "~/ui/tokens";

export type SelectOption<T extends string | null> = { value: T; label: string };

/**
 * A one-line field showing only the current choice; tapping it opens a short
 * sheet of options with the current one checked.
 */
export function SelectField<T extends string | null>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  busy = false,
  inlineLabel = false,
  placeholder = "Not set",
}: {
  /** Names the field for screen readers and titles the sheet. */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  busy?: boolean;
  /** Show `label` inside the field, for compact rows without a form label. */
  inlineLabel?: boolean;
  placeholder?: string;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const sheetY = useSharedValue(40);
  const dim = useSharedValue(0);
  const current = options.find((o) => o.value === value);
  const shown = busy ? "Saving…" : (current?.label ?? placeholder);
  const empty = !current || value === null;

  useEffect(() => {
    if (!open) return;
    if (reduce) {
      sheetY.value = 0;
      dim.value = 1;
      return;
    }
    sheetY.value = 36;
    dim.value = 0;
    sheetY.value = withTiming(0, timingConfig(motion.layout));
    dim.value = withTiming(1, timingConfig(motion.state));
  }, [dim, open, reduce, sheetY]);

  function finishClose() {
    setOpen(false);
  }

  function dismiss() {
    if (!open) return;
    if (reduce) {
      finishClose();
      return;
    }
    sheetY.value = withTiming(28, timingConfig(motion.instant));
    dim.value = withTiming(0, timingConfig(motion.instant), (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }

  function choose(next: T) {
    dismiss();
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  }

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: dim.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        accessibilityHint="Opens a list to choose from"
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.field,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.muted : colors.card,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {inlineLabel ? (
          <AppText variant="subhead" tone="muted" weight="600">
            {label}
          </AppText>
        ) : null}
        <AppText
          variant="callout"
          weight={empty ? "400" : "600"}
          tone={empty ? "muted" : "default"}
          numberOfLines={1}
          style={[styles.value, inlineLabel && styles.valueRight]}
        >
          {shown}
        </AppText>
        <Icon name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={dismiss}
        statusBarTranslucent
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: withAlpha("#000000", 0.4) },
                backdropStyle,
              ]}
            />
          </Pressable>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: insets.bottom + space.md,
              },
              sheetStyle,
            ]}
          >
            <View style={styles.sheetHeader}>
              <AppText variant="headline" accessibilityRole="header">
                {label}
              </AppText>
              <Pressable accessibilityRole="button" onPress={dismiss} hitSlop={12}>
                <AppText variant="subhead" tone="primary" weight="600">
                  Cancel
                </AppText>
              </Pressable>
            </View>
            {options.map((option) => {
              const selected = option.value === value;
              return (
                <Pressable
                  key={String(option.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => choose(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    pressed && { backgroundColor: colors.muted },
                  ]}
                >
                  <AppText
                    variant="body"
                    weight={selected ? "600" : "400"}
                    tone={selected ? "primary" : "default"}
                    style={styles.value}
                  >
                    {option.label}
                  </AppText>
                  {selected ? <Icon name="checkmark" size={20} tone="primary" /> : null}
                </Pressable>
              );
            })}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: HIT_TARGET,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  value: { flex: 1 },
  valueRight: { textAlign: "right" },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderBottomWidth: 0,
    paddingTop: space.sm,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: HIT_TARGET + 6,
    paddingHorizontal: space.lg,
  },
});
