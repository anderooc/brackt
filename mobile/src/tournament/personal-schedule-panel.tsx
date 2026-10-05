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

import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { formatCalendarDate, PERSONAL_SCHEDULE_ROLE_LABELS } from "~/lib/format";
import { AppText, Badge, EmptyState, ListGroup, space } from "~/ui";
import { ScheduleMatchItem } from "~/tournament/schedule-match-item";

export function PersonalSchedulePanel({
  matches,
  compact,
}: {
  matches: PersonalScheduleMatchContract[];
  compact?: boolean;
}) {
  const router = useRouter();

  if (matches.length === 0) {
    return (
      <EmptyState
        compact
        icon="calendar-outline"
        title="No upcoming matches"
        message="Games for your teams, reffing assignments, and scorekeeping shifts will show up here once a host posts the schedule."
      />
    );
  }

  return (
    <ListGroup>
      {matches.map((match) => (
        <ScheduleMatchItem
          key={match.id}
          scheduledTime={match.scheduledTime}
          status={match.status}
          teamAName={match.teamAName}
          teamBName={match.teamBName}
          eyebrow={
            compact
              ? null
              : `${match.tournamentName} · ${formatCalendarDate(match.tournamentDate)}`
          }
          details={[match.courtName, match.contextLabel]}
          footer={
            <View style={styles.roleRow}>
              <Badge
                label={PERSONAL_SCHEDULE_ROLE_LABELS[match.role] ?? match.role}
                tone={match.role === "playing" ? "info" : "warning"}
              />
              {match.myTeamName ? (
                <AppText variant="footnote" tone="muted" numberOfLines={1} style={styles.team}>
                  {match.myTeamName}
                </AppText>
              ) : null}
            </View>
          }
          onPress={() =>
            router.push(`/tournament/${match.tournamentSlug}/matches/${match.matchSlug}`)
          }
        />
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  roleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginTop: space.xs,
  },
  team: { flexShrink: 1 },
});
