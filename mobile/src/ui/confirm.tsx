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

import {
  ActionSheetIOS,
  Alert,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { haptics } from "~/ui/haptics";
import { AppText, Icon, Tappable } from "~/ui/primitives";
import { HIT_TARGET, radius, space } from "~/ui/tokens";

/*
 * Drastic actions (role changes, removals, leaving, deleting) never sit on a
 * row as a button. They're reached through a menu or a quiet link, and every
 * one confirms with its consequence spelled out.
 */

export type ActionChoice = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/** Native action sheet on iOS; a button alert on Android (two choices + Cancel fit). */
export function chooseAction({
  title,
  message,
  choices,
}: {
  title: string;
  message?: string;
  choices: ActionChoice[];
}) {
  if (choices.length === 0) return;
  haptics.selection();
  if (Platform.OS === "ios") {
    const labels = [...choices.map((c) => c.label), "Cancel"];
    const destructiveButtonIndex = choices
      .map((c, i) => (c.destructive ? i : -1))
      .filter((i) => i >= 0);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex,
      },
      (index) => {
        if (index < choices.length) choices[index]!.onPress();
      }
    );
    return;
  }
  Alert.alert(title, message, [
    ...choices.map((c) => ({
      text: c.label,
      style: c.destructive ? ("destructive" as const) : ("default" as const),
      onPress: c.onPress,
    })),
    { text: "Cancel", style: "cancel" as const },
  ]);
}

/** Cancel-first confirmation whose action button names exactly what happens. */
export function confirmDrastic({
  title,
  message,
  confirmLabel,
  destructive = true,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  haptics.warning();
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    {
      text: confirmLabel,
      style: destructive ? "destructive" : "default",
      onPress: onConfirm,
    },
  ]);
}

/** A quiet red text link for leaving or deleting; the trailing "…" promises a confirm step. */
export function DangerLink({
  label,
  icon = "trash-outline",
  onPress,
  disabled,
  accessibilityHint,
  style,
}: {
  label: string;
  icon?: Parameters<typeof Icon>[0]["name"];
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? "Asks you to confirm first"}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.link, disabled && styles.disabled, style]}
    >
      <Icon name={icon} size={16} tone="destructive" />
      <AppText variant="subhead" weight="600" tone="destructive">
        {label}…
      </AppText>
    </Tappable>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: space.xs,
    minHeight: HIT_TARGET,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  disabled: { opacity: 0.45 },
});
