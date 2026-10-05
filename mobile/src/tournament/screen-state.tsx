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

import { StyleSheet, View } from "react-native";
import { useThemeColors } from "~/theme/colors";
import { EmptyState, SkeletonList, type IconName } from "~/ui";

export function LoadingScreen({ rows = 5 }: { rows?: number } = {}) {
  const colors = useThemeColors();
  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <SkeletonList rows={rows} />
    </View>
  );
}

export function ErrorScreen({
  title,
  message,
  onRetry,
  icon = "cloud-offline-outline",
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  icon?: IconName;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[styles.fill, styles.centered, { backgroundColor: colors.background }]}
    >
      <EmptyState
        icon={icon}
        title={title}
        message={message}
        action={
          onRetry
            ? { label: "Try again", icon: "refresh", onPress: onRetry }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: "center" },
});
