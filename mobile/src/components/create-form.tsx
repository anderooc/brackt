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

import { useState, type ReactNode, type Ref } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from "react-native";
import type { ThemeColors } from "~/theme/colors";
import { Button, Chip, ChipRow, radius, space, type } from "~/ui";

export function FormField({
  label,
  hint,
  error,
  children,
  colors,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[styles.hint, { color: colors.destructive }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function FormTextInput({
  colors,
  multiline,
  editable = true,
  style,
  accessibilityLabel,
  placeholder,
  onFocus,
  onBlur,
  ref,
  ...rest
}: Omit<TextInputProps, "style" | "value" | "onChangeText"> & {
  value: string;
  onChangeText: (value: string) => void;
  colors: ThemeColors;
  style?: StyleProp<TextStyle>;
  ref?: Ref<TextInput>;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      {...rest}
      ref={ref}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      editable={editable}
      accessibilityLabel={accessibilityLabel ?? placeholder}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        styles.input,
        multiline && styles.textarea,
        style,
        {
          color: colors.foreground,
          borderColor: focused ? colors.primary : colors.border,
          backgroundColor: editable ? colors.card : colors.muted,
        },
      ]}
    />
  );
}

export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  colors,
  labels,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T) => void;
  colors: ThemeColors;
  labels: Record<string, string>;
}) {
  return (
    <ChipRow>
      {options.map((option) => (
        <Chip
          key={option}
          label={labels[option] ?? option}
          selected={value === option}
          onPress={() => onChange(option)}
        />
      ))}
    </ChipRow>
  );
}

export function FormSubmitButton({
  label,
  busy,
  disabled,
  onPress,
  variant = "primary",
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onPress: () => void;
  colors?: ThemeColors;
  variant?: "primary" | "outline" | "destructive";
}) {
  return (
    <Button
      label={label}
      loading={busy}
      disabled={disabled}
      onPress={onPress}
      variant={variant}
      fullWidth
      style={styles.submit}
    />
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  label: { ...type.subhead, fontWeight: "600" },
  hint: { ...type.footnote },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 16,
  },
  textarea: { minHeight: 104, textAlignVertical: "top" },
  submit: { marginTop: space.sm },
});
