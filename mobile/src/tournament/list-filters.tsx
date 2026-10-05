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

import type { TeamGender, TeamRegion } from "@/types";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GENDER_LABELS,
  REGION_LABELS,
  TEAM_GENDER_VALUES,
  TEAM_REGION_VALUES,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Chip,
  ChipRow,
  HeaderButton,
  ListGroup,
  Section,
  space,
  SwitchRow,
} from "~/ui";

export function ListFiltersSheet({
  visible,
  genderFilter,
  regionFilter,
  hideArchived,
  registrationOpenOnly,
  activeCount,
  onToggleGender,
  onToggleRegion,
  onHideArchivedChange,
  onRegistrationOpenOnlyChange,
  onClear,
  onClose,
}: {
  visible: boolean;
  genderFilter: ReadonlySet<TeamGender>;
  regionFilter: ReadonlySet<TeamRegion>;
  hideArchived: boolean;
  registrationOpenOnly: boolean;
  activeCount: number;
  onToggleGender: (value: TeamGender) => void;
  onToggleRegion: (value: TeamRegion) => void;
  onHideArchivedChange: (value: boolean) => void;
  onRegistrationOpenOnlyChange: (value: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const hasActive = activeCount > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {hasActive ? (
              <HeaderButton
                label="Clear all"
                accessibilityLabel="Clear all filters"
                onPress={onClear}
              />
            ) : null}
          </View>
          <AppText variant="headline" accessibilityRole="header">
            Filters
          </AppText>
          <View style={[styles.headerSide, styles.headerSideEnd]}>
            <HeaderButton label="Done" emphasis onPress={onClose} />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <ListGroup>
            <SwitchRow
              label="Hide past events"
              description="Only show today and upcoming dates"
              value={hideArchived}
              onValueChange={onHideArchivedChange}
            />
            <SwitchRow
              label="Registration open"
              description="Only tournaments accepting sign-ups"
              value={registrationOpenOnly}
              onValueChange={onRegistrationOpenOnlyChange}
            />
          </ListGroup>

          <Section title="Gender">
            <ChipRow>
              {TEAM_GENDER_VALUES.map((value) => {
                const selected = genderFilter.has(value);
                return (
                  <Chip
                    key={value}
                    label={GENDER_LABELS[value]}
                    selected={selected}
                    icon={selected ? "checkmark" : undefined}
                    onPress={() => onToggleGender(value)}
                  />
                );
              })}
            </ChipRow>
          </Section>

          <Section title="Region">
            <ChipRow>
              {TEAM_REGION_VALUES.map((value) => {
                const selected = regionFilter.has(value);
                return (
                  <Chip
                    key={value}
                    label={REGION_LABELS[value]}
                    selected={selected}
                    icon={selected ? "checkmark" : undefined}
                    onPress={() => onToggleRegion(value)}
                  />
                );
              })}
            </ChipRow>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  headerSide: { flex: 1, flexDirection: "row" },
  headerSideEnd: { justifyContent: "flex-end" },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
    gap: space.xxl,
  },
});
