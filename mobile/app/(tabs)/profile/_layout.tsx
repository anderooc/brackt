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

import { Stack } from "expo-router";
import { Platform } from "react-native";
import { useThemeColors } from "~/theme/colors";

export default function ProfileStackLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground, fontWeight: "600" },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === "android" ? "ios_from_right" : "default",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Profile" }} />
      <Stack.Screen
        name="edit"
        options={{ title: "Edit profile", headerBackTitle: "Profile" }}
      />
      <Stack.Screen
        name="password"
        options={{ title: "Change password", headerBackTitle: "Profile" }}
      />
      <Stack.Screen
        name="delete-account"
        options={{ title: "Delete account", headerBackTitle: "Profile" }}
      />
    </Stack>
  );
}
