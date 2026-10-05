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

import { useNavigation, useRouter } from "expo-router";
import { useCallback, useState, type ReactNode, type Ref } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { useThemeColors } from "~/theme/colors";
import { AppText, Button, radius, space } from "~/ui";

const AUTH_ROUTES = new Set([
  "sign-in",
  "sign-up",
  "forgot-password",
  "reset-password",
]);

/**
 * Closes every auth modal stacked on top of the screen that opened the flow,
 * so finishing sign-up from sign-in does not land back on sign-in.
 */
export function useExitAuthFlow() {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    const routes = navigation.getState()?.routes ?? [];
    let count = 0;
    for (let i = routes.length - 1; i >= 0; i--) {
      if (!AUTH_ROUTES.has(routes[i].name)) break;
      count++;
    }
    if (count > 0 && count < routes.length) {
      router.dismiss(count);
      return;
    }
    router.replace("/");
  }, [navigation, router]);
}

export function AuthScreen({
  children,
  lead,
}: {
  children: ReactNode;
  lead?: string;
}) {
  const colors = useThemeColors();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        {lead ? (
          <AppText variant="callout" tone="muted">
            {lead}
          </AppText>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthInput({
  ref,
  style,
  onFocus,
  onBlur,
  invalid = false,
  ...props
}: TextInputProps & { ref?: Ref<TextInput>; invalid?: boolean }) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedForeground}
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
        {
          color: colors.foreground,
          borderColor: invalid
            ? colors.destructive
            : focused
              ? colors.primary
              : colors.border,
          backgroundColor: colors.card,
        },
        style,
      ]}
      {...props}
    />
  );
}

/** Stack of the primary submit button and secondary text links under a form. */
export function AuthActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function AuthLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      label={label}
      onPress={onPress}
      variant="ghost"
      size="sm"
      haptic={false}
      style={styles.link}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: space.xxl,
    paddingTop: space.xxl,
    paddingBottom: space.xxxl + space.lg,
    gap: space.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md + 2,
    paddingVertical: space.md,
    minHeight: 48,
    fontSize: 16,
  },
  actions: { gap: space.sm, marginTop: space.xs },
  link: { alignSelf: "center", minHeight: 44 },
});
