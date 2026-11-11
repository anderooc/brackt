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

import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors, withAlpha } from "~/theme/colors";
import { prefersReducedMotion } from "~/ui/disclosure";
import { haptics } from "~/ui/haptics";
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
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const shown = busy ? "Saving…" : (current?.label ?? placeholder);
  const empty = !current || value === null;

  function choose(next: T) {
    setOpen(false);
    if (next !== value) {
      haptics.selection();
      onChange(next);
    }
  }

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
        animationType={prefersReducedMotion() ? "none" : "fade"}
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={[styles.backdrop, { backgroundColor: withAlpha("#000000", 0.4) }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              paddingBottom: insets.bottom + space.md,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <AppText variant="headline" accessibilityRole="header">
              {label}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              hitSlop={12}
            >
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
  backdrop: { flex: 1 },
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
