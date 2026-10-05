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

import type { TournamentTeamContract } from "@/lib/api/contracts/tournament";
import { StyleSheet, View } from "react-native";
import {
  AppText,
  EmptyState,
  ListGroup,
  ListRow,
  Section,
  space,
} from "~/ui";

export function TournamentTeamsPanel({
  teams,
}: {
  teams: TournamentTeamContract[];
}) {
  if (teams.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No teams yet"
        message="Confirmed teams appear here as registration fills in."
      />
    );
  }

  const groups = groupByDivision(teams);

  return (
    <View style={styles.stack}>
      <AppText variant="footnote" tone="muted" weight="600">
        {teams.length} team{teams.length === 1 ? "" : "s"} confirmed
      </AppText>
      {groups.map((group) => (
        <Section
          key={group.name}
          title={group.name}
          description={`${group.teams.length} team${group.teams.length === 1 ? "" : "s"}`}
        >
          <ListGroup>
            {group.teams.map((team) => (
              <ListRow
                key={team.slug}
                title={team.name}
                subtitle={team.schoolName ?? team.university}
              />
            ))}
          </ListGroup>
        </Section>
      ))}
    </View>
  );
}

function groupByDivision(teams: TournamentTeamContract[]) {
  const groups: { name: string; teams: TournamentTeamContract[] }[] = [];
  const index = new Map<string, number>();

  for (const team of teams) {
    const name = team.divisionName ?? "Unassigned";
    const existing = index.get(name);
    if (existing === undefined) {
      index.set(name, groups.length);
      groups.push({ name, teams: [team] });
    } else {
      groups[existing].teams.push(team);
    }
  }

  return groups;
}

const styles = StyleSheet.create({
  stack: { gap: space.xxl },
});
