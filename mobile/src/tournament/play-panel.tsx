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
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Banner,
  Button,
  Icon,
  radius,
  Section,
  SegmentedControl,
  SkeletonList,
  space,
  Tappable,
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
  const colors = useThemeColors();
  const slug = tournament.slug;
  const anyPosted = tournament.divisions.some((d) => d.poolsReleased);

  return (
    <View style={styles.stack}>
      <View
        accessibilityRole="toolbar"
        style={[styles.toolbar, { borderColor: colors.border, backgroundColor: colors.card }]}
      >
        {[
          {
            key: "pools",
            icon: "grid-outline" as const,
            label: "Pools",
            hint: anyPosted ? "Standings and pool matches" : "Not posted yet",
            href: `/tournament/${slug}/pools`,
          },
          {
            key: "bracket",
            icon: "git-network-outline" as const,
            label: "Bracket",
            hint: "Elimination rounds",
            href: `/tournament/${slug}/bracket`,
          },
          {
            key: "live",
            icon: "pulse-outline" as const,
            label: "Live",
            hint: "What's on court now",
            href: `/tournament/${slug}/scoring`,
          },
          ...(tournament.status === "in_progress" || isOrganizer
            ? [
                {
                  key: "board",
                  icon: "tv-outline" as const,
                  label: "Court board",
                  hint: "Full-screen scoreboard for a tablet at the venue",
                  href: `/tournament/${slug}/scoreboard`,
                },
              ]
            : []),
        ].map((link, index) => (
          <Tappable
            key={link.key}
            accessibilityRole="button"
            accessibilityLabel={link.label}
            accessibilityHint={link.hint}
            onPress={() => router.push(link.href)}
            style={[
              styles.tool,
              index > 0 && {
                borderLeftWidth: StyleSheet.hairlineWidth,
                borderLeftColor: colors.border,
              },
            ]}
          >
            <View>
              <Icon name={link.icon} size={22} tone="primary" />
              {link.key === "live" && tournament.status === "in_progress" ? (
                <View style={[styles.liveDot, { backgroundColor: colors.live }]} />
              ) : null}
            </View>
            <AppText variant="caption" weight="600" numberOfLines={1}>
              {link.label}
            </AppText>
          </Tappable>
        ))}
      </View>

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
  toolbar: {
    flexDirection: "row",
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: "hidden",
  },
  tool: {
    flex: 1,
    alignItems: "center",
    gap: space.xs,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
  },
  liveDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
