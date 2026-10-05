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

import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { goBackOrReplace } from "~/lib/navigation";
import { AppText, HIT_TARGET, Icon, space } from "~/ui";

export function SectionBack({
  label = "Tournament",
  fallbackHref,
}: {
  label?: string;
  fallbackHref?: Href;
}) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      hitSlop={{ left: space.md, right: space.md }}
      onPress={() => goBackOrReplace(router, fallbackHref ?? "/")}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.5 : 1 }]}
    >
      <Icon name="chevron-back" size={22} tone="primary" />
      <AppText variant="body" tone="primary" weight="500">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    minHeight: HIT_TARGET,
    marginLeft: -space.xs,
    marginBottom: space.xs,
  },
});
