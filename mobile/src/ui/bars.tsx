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

import { useEffect, useState, type ReactNode } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "~/theme/colors";
import { AppText } from "~/ui/primitives";
import { haptics } from "~/ui/haptics";
import { HIT_TARGET, space, type } from "~/ui/tokens";

/** Height of the on-screen keyboard measured from the bottom of the window. */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const animate = (event: KeyboardEvent) => {
      if (Platform.OS !== "ios") return;
      LayoutAnimation.configureNext({
        duration: event.duration || 250,
        update: { type: LayoutAnimation.Types.keyboard },
      });
    };

    const show = Keyboard.addListener(showEvent, (event) => {
      animate(event);
      setHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      animate(event);
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/**
 * Footer pinned to the bottom of a stack screen. Clears the home indicator and
 * rides above the keyboard so composers and save buttons stay reachable.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const bottom = keyboard > 0 ? keyboard + space.sm : Math.max(insets.bottom, space.md);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: bottom,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.switchRow, disabled && { opacity: 0.5 }]}>
      <View style={styles.switchText}>
        <AppText variant="callout" weight="600">
          {label}
        </AppText>
        {description ? (
          <AppText variant="footnote" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={(next) => {
          haptics.selection();
          onValueChange(next);
        }}
        trackColor={{ true: colors.primary, false: colors.border }}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

/** Text action for navigation headers ("New", "Save", "Sign in"). */
export function HeaderButton({
  label,
  onPress,
  accessibilityLabel,
  disabled,
  emphasis = false,
}: {
  label: string;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  emphasis?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.headerButton,
        { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 },
      ]}
    >
      <Text
        style={[
          type.headline,
          { color: colors.primary, fontWeight: emphasis ? "600" : "400" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: HIT_TARGET + 12,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  switchText: { flex: 1, gap: space.xxs },
  headerButton: {
    minHeight: HIT_TARGET,
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
});
