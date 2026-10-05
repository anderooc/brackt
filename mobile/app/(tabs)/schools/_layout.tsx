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
import { useThemeColors } from "~/theme/colors";

export default function SchoolsStackLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground, fontWeight: "600" },
        headerTintColor: colors.primary,
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Schools" }} />
      <Stack.Screen name="new" options={{ title: "Create school", headerBackTitle: "Schools" }} />
      <Stack.Screen
        name="[slug]"
        options={{ title: "School", headerBackTitle: "Schools" }}
      />
      <Stack.Screen
        name="[slug]/edit"
        options={{ title: "Edit school", headerBackTitle: "School" }}
      />
    </Stack>
  );
}
