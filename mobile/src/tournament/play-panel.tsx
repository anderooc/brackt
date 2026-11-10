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

import type {
  TournamentDetailContract,
  TournamentMatchContract,
} from "@/lib/api/contracts/tournament";
import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { downloadMyScheduleIcs } from "~/api/endpoints";
import { shareDownloadedFile } from "~/lib/share-pdf";
import { TournamentMatchesPanel } from "~/tournament/matches-panel";
import { PersonalSchedulePanel } from "~/tournament/personal-schedule-panel";
import type { PlayView } from "~/tournament/tournament-tabs";
import { UpNextMatch } from "~/tournament/up-next-match";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  ListGroup,
  ListRow,
  Section,
  SegmentedControl,
  SkeletonList,
  space,
} from "~/ui";

const VIEW_OPTIONS: { id: PlayView; label: string }[] = [
  { id: "mine", label: "Your matches" },
  { id: "all", label: "All matches" },
];

export function TournamentPlayPanel({
  tournament,
  isOrganizer,
  myMatches,
  view,
  onViewChange,
  matches,
  matchesError,
  onRetryMatches,
}: {
  tournament: TournamentDetailContract;
  isOrganizer: boolean;
  myMatches: PersonalScheduleMatchContract[];
  view: PlayView;
  onViewChange: (view: PlayView) => void;
  matches: TournamentMatchContract[] | null;
  matchesError: string | null;
  onRetryMatches: () => void;
}) {
  const router = useRouter();
  const slug = tournament.slug;
  const anyPosted = tournament.divisions.some((d) => d.poolsReleased);

  return (
    <View style={styles.stack}>
      <ListGroup>
        <ListRow
          icon="grid-outline"
          title="Pools"
          subtitle={anyPosted ? "Standings and pool matches" : "Not posted yet"}
          onPress={() => router.push(`/tournament/${slug}/pools`)}
        />
        <ListRow
          icon="git-network-outline"
          title="Bracket"
          subtitle="Elimination rounds"
          onPress={() => router.push(`/tournament/${slug}/bracket`)}
        />
        <ListRow
          icon="pulse-outline"
          title="Live scores"
          subtitle="What's on court now"
          onPress={() => router.push(`/tournament/${slug}/scoring`)}
        />
        {tournament.status === "in_progress" || isOrganizer ? (
          <ListRow
            icon="tv-outline"
            title="Court board"
            subtitle="Full-screen scoreboard for a tablet at the venue"
            onPress={() => router.push(`/tournament/${slug}/scoreboard`)}
          />
        ) : null}
      </ListGroup>

      {myMatches.length > 0 ? (
        <SegmentedControl
          accessibilityLabel="Which matches"
          options={VIEW_OPTIONS}
          value={view}
          onChange={onViewChange}
        />
      ) : null}

      {view === "mine" && myMatches.length > 0 ? (
        <YourMatches matches={myMatches} />
      ) : matches !== null ? (
        <>
          {matchesError ? <Banner tone="error" message={matchesError} /> : null}
          <TournamentMatchesPanel matches={matches} tournamentSlug={slug} />
        </>
      ) : matchesError ? (
        <Banner
          tone="error"
          title="Matches unavailable"
          message={matchesError}
          action={{ label: "Try again", onPress: onRetryMatches }}
        />
      ) : (
        <SkeletonList rows={4} header={false} />
      )}
    </View>
  );
}

function YourMatches({ matches }: { matches: PersonalScheduleMatchContract[] }) {
  const [exporting, setExporting] = useState(false);
  const ahead = matches.filter((m) => m.status !== "completed");
  const finished = matches.filter((m) => m.status === "completed");
  const [next, ...later] = ahead;

  async function exportCalendar() {
    setExporting(true);
    try {
      await shareDownloadedFile(
        () => downloadMyScheduleIcs(),
        "brackt-my-schedule.ics",
        "ics"
      );
    } catch (cause) {
      Alert.alert(
        "Couldn't export schedule",
        messageFor(cause, "Could not export your schedule.")
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={styles.stack}>
      {next ? (
        <Section title="Up next">
          <UpNextMatch match={next} showTournament={false} />
          {later.length > 0 ? <PersonalSchedulePanel matches={later} compact /> : null}
          <Button
            label="Add to calendar"
            icon="calendar-outline"
            variant="outline"
            size="sm"
            loading={exporting}
            onPress={() => void exportCalendar()}
          />
        </Section>
      ) : (
        <AppText variant="subhead" tone="muted">
          You’ve played all your scheduled matches here.
        </AppText>
      )}
      {finished.length > 0 ? (
        <Section title="Finished">
          <PersonalSchedulePanel matches={finished} compact />
        </Section>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
});
