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

import type { GlobalScheduleMatchContract } from "@/lib/api/contracts/global-schedule";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { GENDER_LABELS, REGION_LABELS } from "~/lib/format";
import { AppText, EmptyState, ListGroup, space } from "~/ui";
import { ScheduleMatchItem } from "~/tournament/schedule-match-item";

// Group by the device's calendar day so headings agree with the local times shown.
function localDayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function GlobalSchedulePanel({
  matches,
}: {
  matches: GlobalScheduleMatchContract[];
}) {
  const router = useRouter();

  const days = useMemo(() => {
    const groups: { key: string; label: string; matches: GlobalScheduleMatchContract[] }[] = [];
    for (const match of matches) {
      const key = localDayKey(match.scheduledTime);
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = {
          key,
          label: new Date(match.scheduledTime).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
          }),
          matches: [],
        };
        groups.push(group);
      }
      group.matches.push(match);
    }
    return groups;
  }, [matches]);

  if (matches.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="No scheduled matches yet"
        message="Matches show up here once hosts give them a start time."
      />
    );
  }

  return (
    <View style={styles.days}>
      {days.map((day) => (
        <View key={day.key} style={styles.day}>
          <AppText variant="subhead" weight="600" tone="muted" accessibilityRole="header">
            {day.label}
          </AppText>
          <ListGroup>
            {day.matches.map((match) => (
              <ScheduleMatchItem
                key={match.id}
                scheduledTime={match.scheduledTime}
                status={match.status}
                teamAName={match.teamAName}
                teamBName={match.teamBName}
                eyebrow={match.tournamentName}
                details={[
                  match.contextLabel,
                  match.courtName,
                  match.refTeamName ? `Ref: ${match.refTeamName}` : null,
                  `${GENDER_LABELS[match.gender] ?? match.gender} · ${REGION_LABELS[match.region] ?? match.region}`,
                ]}
                onPress={() =>
                  router.push(`/tournament/${match.tournamentSlug}/matches/${match.matchSlug}`)
                }
              />
            ))}
          </ListGroup>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: space.xl },
  day: { gap: space.sm },
});
