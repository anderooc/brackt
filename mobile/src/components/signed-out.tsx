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

import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useThemeColors } from "~/theme/colors";
import { AppText, Button, Icon, space, type IconName } from "~/ui";

/**
 * Tab roots stay reachable while signed out so guests can still browse public
 * tournaments; this replaces a hard redirect to the sign-in modal.
 */
export function SignedOutScreen({
  icon,
  title,
  message,
  showBrowse = false,
}: {
  icon: IconName;
  title: string;
  message: string;
  showBrowse?: boolean;
}) {
  const router = useRouter();
  const colors = useThemeColors();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.icon, { backgroundColor: colors.muted }]}>
        <Icon name={icon} size={28} tone="muted" />
      </View>
      <AppText variant="title" style={styles.center}>
        {title}
      </AppText>
      <AppText variant="callout" tone="muted" style={styles.center}>
        {message}
      </AppText>
      <View style={styles.actions}>
        <Button label="Sign in" fullWidth onPress={() => router.push("/sign-in")} />
        <Button
          label="Create account"
          variant="outline"
          fullWidth
          onPress={() => router.push("/sign-up")}
        />
        {showBrowse ? (
          <Button
            label="Browse tournaments"
            variant="ghost"
            icon="trophy-outline"
            fullWidth
            onPress={() => router.navigate("/tournaments")}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xxl,
    gap: space.md,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space.sm,
  },
  center: { textAlign: "center" },
  actions: {
    alignSelf: "stretch",
    gap: space.sm,
    marginTop: space.lg,
  },
});
