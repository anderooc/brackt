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

import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { Image, type ColorValue } from "react-native";
import { useThemeColors } from "~/theme/colors";
import { haptics, type IconName } from "~/ui";

const LOGO_ON_COURT = require("../../assets/brand/logo-dark.png");

function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size - 2} color={color} />
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.foreground, fontFamily: "Archivo_700Bold" },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "PlusJakartaSans_600SemiBold",
          letterSpacing: -0.1,
        },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}
      screenListeners={{ tabPress: () => haptics.selection() }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerStyle: { backgroundColor: colors.hero },
          headerTitle: () => (
            <Image
              source={LOGO_ON_COURT}
              style={{ width: 96, height: 23 }}
              resizeMode="contain"
              accessibilityRole="header"
              accessibilityLabel="brackt home"
            />
          ),
          tabBarIcon: tabIcon("home", "home-outline"),
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: "Tournaments",
          tabBarIcon: tabIcon("trophy", "trophy-outline"),
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: "Teams",
          headerShown: false,
          tabBarIcon: tabIcon("people", "people-outline"),
        }}
      />
      <Tabs.Screen
        name="schools"
        options={{
          title: "Schools",
          headerShown: false,
          tabBarIcon: tabIcon("school", "school-outline"),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: tabIcon("person-circle", "person-circle-outline"),
        }}
      />
    </Tabs>
  );
}
