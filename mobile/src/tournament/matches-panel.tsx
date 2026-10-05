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

import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { MatchRow } from "~/tournament/match-row";
import { AppText, EmptyState, Section, space } from "~/ui";

export function TournamentMatchesPanel({
  matches,
  tournamentSlug,
}: {
  matches: TournamentMatchContract[];
  tournamentSlug: string;
}) {
  const router = useRouter();

  if (matches.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="No matches yet"
        message="Matches appear here once the host releases pools or brackets."
      />
    );
  }

  const groups = groupMatches(matches);
  const liveCount = matches.filter((m) => m.status === "in_progress").length;

  return (
    <View style={styles.stack}>
      <AppText variant="footnote" tone="muted" weight="600">
        {matches.length} match{matches.length === 1 ? "" : "es"}
        {liveCount > 0 ? ` · ${liveCount} live` : ""}
      </AppText>
      {groups.map((group) => (
        <Section key={group.key} title={group.title} description={group.subtitle}>
          <View style={styles.rows}>
            {group.matches.map((match) => (
              <MatchRow
                key={match.slug}
                match={match}
                onPress={() =>
                  router.push(
                    `/tournament/${tournamentSlug}/matches/${match.slug}`
                  )
                }
              />
            ))}
          </View>
        </Section>
      ))}
    </View>
  );
}

function groupMatches(matches: TournamentMatchContract[]) {
  const map = new Map<
    string,
    {
      key: string;
      title: string;
      subtitle: string;
      matches: TournamentMatchContract[];
    }
  >();

  for (const match of matches) {
    const division = match.divisionName ?? "Tournament";
    const phaseLabel = match.phase === "bracket" ? "Bracket" : "Pool play";
    const key = `${division}::${match.phase}`;
    const existing = map.get(key);
    if (existing) {
      existing.matches.push(match);
    } else {
      map.set(key, {
        key,
        title: division,
        subtitle: phaseLabel,
        matches: [match],
      });
    }
  }

  return Array.from(map.values());
}

const styles = StyleSheet.create({
  stack: { gap: space.xxl },
  rows: { gap: space.sm },
});
