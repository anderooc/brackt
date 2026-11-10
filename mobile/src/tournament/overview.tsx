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
import type { TournamentDetailContract } from "@/lib/api/contracts/tournament";
import type { TournamentHostOverviewContract } from "@/lib/api/contracts/tournament-host";
import type { TournamentParticipationContract } from "@/lib/api/contracts/tournament-ops";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import { withdrawTournamentRegistration } from "~/api/endpoints";
import { openInMaps } from "~/lib/links";
import {
  DIVISION_FORMAT_LABELS,
  formatCalendarDate,
  formatDeadline,
  GENDER_LABELS,
  REGION_LABELS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { HostChecklistCard } from "~/tournament/host-checklist-card";
import { UpNextMatch } from "~/tournament/up-next-match";
import {
  AppText,
  Banner,
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Section,
  StatusBadge,
  Tappable,
  HIT_TARGET,
  haptics,
  space,
  type IconName,
} from "~/ui";

type LinkItem = {
  href: Href;
  title: string;
  detail: string;
  icon: IconName;
};

export function TournamentOverview({
  tournament,
  participation,
  hostOverview,
  myMatches,
  onParticipationChanged,
  onOpenMyMatches,
}: {
  tournament: TournamentDetailContract;
  participation: TournamentParticipationContract | null;
  /** Loaded for organizers only; drives the setup checklist. */
  hostOverview: TournamentHostOverviewContract | null;
  /** The viewer's matches here (played, reffing, or crew), oldest first. */
  myMatches: PersonalScheduleMatchContract[];
  onParticipationChanged?: () => void | Promise<void>;
  onOpenMyMatches: () => void;
}) {
  const router = useRouter();
  const slug = tournament.slug;
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  function confirmWithdraw(teamSlug: string, teamName: string) {
    Alert.alert(
      `Withdraw ${teamName}?`,
      "Your spot is released and the next waitlisted team may take it. You'd need to register again to get back in.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw team",
          style: "destructive",
          onPress: () => void withdraw(teamSlug),
        },
      ]
    );
  }

  async function withdraw(teamSlug: string) {
    setWithdrawing(teamSlug);
    setWithdrawError(null);
    try {
      await withdrawTournamentRegistration(slug, teamSlug);
      haptics.success();
      onParticipationChanged?.();
    } catch (cause) {
      haptics.error();
      setWithdrawError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not withdraw this team. Try again."
      );
    } finally {
      setWithdrawing(null);
    }
  }

  const alreadyEntered = (participation?.myTeams.length ?? 0) > 0;
  const showRegister =
    tournament.registrationOpen &&
    !alreadyEntered &&
    (participation == null || participation.canRegister);

  const access = participation?.access;
  const teamLinks: LinkItem[] = access
    ? ([
        access.packet
          ? {
              href: `/tournament/${slug}/packet` as Href,
              title: "Packet",
              detail: "Rules, schedule, and logistics",
              icon: "document-text-outline" as const,
            }
          : null,
        access.waiver
          ? {
              href: `/tournament/${slug}/waiver` as Href,
              title: "Waiver",
              detail: "Download and complete team waivers",
              icon: "create-outline" as const,
            }
          : null,
        access.payment
          ? {
              href: `/tournament/${slug}/payment` as Href,
              title: "Payment",
              detail: "Fee instructions and payment status",
              icon: "card-outline" as const,
            }
          : null,
        access.chat
          ? {
              href: `/tournament/${slug}/chat` as Href,
              title: "Chat",
              detail: "Announcements and team discussion",
              icon: "chatbubbles-outline" as const,
            }
          : null,
      ] as (LinkItem | null)[]).filter((link): link is LinkItem => link !== null)
    : [];

  const isOrganizer = participation?.isOrganizer ?? false;
  const upNext = myMatches.find((m) => m.status !== "completed") ?? null;

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <StatusBadge
          kind="tournament"
          status={tournament.status}
          date={tournament.date}
        />
        <AppText variant="title" accessibilityRole="header">
          {tournament.name}
        </AppText>
      </View>

      {isOrganizer ? (
        <>
          {hostOverview ? (
            <HostChecklistCard
              overview={hostOverview}
              onChanged={() => onParticipationChanged?.()}
            />
          ) : null}
          <ListGroup>
            <ListRow
              icon="construct-outline"
              title="Manage tournament"
              subtitle="Status, teams, schedule, settings, and staff"
              onPress={() => router.push(`/tournament/${slug}/host`)}
            />
          </ListGroup>
        </>
      ) : null}

      {showRegister ? (
        <Button
          label="Register a team"
          icon="add-circle-outline"
          fullWidth
          onPress={() => router.push(`/tournament/${slug}/register`)}
        />
      ) : null}

      {!isOrganizer && myMatches.length > 0 ? (
        <Section
          title={upNext ? "Your next match" : "Your matches"}
          action={{
            label: upNext ? "All your matches" : "See results",
            onPress: onOpenMyMatches,
          }}
        >
          {upNext ? (
            <UpNextMatch match={upNext} showTournament={false} />
          ) : (
            <AppText variant="subhead" tone="muted">
              You’ve played all your scheduled matches here.
            </AppText>
          )}
        </Section>
      ) : null}

      {alreadyEntered ? (
        <Section title="Your teams">
          {withdrawError ? (
            <Banner
              tone="error"
              message={withdrawError}
              onDismiss={() => setWithdrawError(null)}
            />
          ) : null}
          <ListGroup>
            {participation!.myTeams.map((team) => (
              <ListRow
                key={team.slug}
                title={team.name}
                subtitle={
                  withdrawing === team.slug
                    ? "Withdrawing…"
                    : team.status !== "waitlisted" && tournament.status !== "completed"
                      ? "Tap to manage"
                      : undefined
                }
                icon="people-outline"
                trailing={<StatusBadge kind="registration" status={team.status} />}
                onPress={
                  team.status !== "waitlisted" &&
                  tournament.status !== "completed" &&
                  withdrawing === null
                    ? () => confirmWithdraw(team.slug, team.name)
                    : undefined
                }
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      {!isOrganizer ? <LinkSection title="Team tools" links={teamLinks} /> : null}

      <KeyFacts tournament={tournament} />

      <Availability tournament={tournament} />

      {tournament.description ? (
        <Section title="About">
          <AppText variant="body">{tournament.description}</AppText>
        </Section>
      ) : null}
    </View>
  );
}

function LinkSection({ title, links }: { title: string; links: LinkItem[] }) {
  const router = useRouter();
  if (links.length === 0) return null;
  return (
    <Section title={title}>
      <ListGroup>
        {links.map((link) => (
          <ListRow
            key={link.title}
            title={link.title}
            subtitle={link.detail}
            icon={link.icon}
            onPress={() => router.push(link.href)}
          />
        ))}
      </ListGroup>
    </Section>
  );
}

function KeyFacts({ tournament }: { tournament: TournamentDetailContract }) {
  const gender = GENDER_LABELS[tournament.gender] ?? tournament.gender;
  const region = REGION_LABELS[tournament.region] ?? tournament.region;
  const formats = [
    ...new Set(
      tournament.divisions.map(
        (division) => DIVISION_FORMAT_LABELS[division.format] ?? division.format
      )
    ),
  ].join(" · ");
  const deadline = tournament.registrationAvailability.deadline;
  const mapsQuery = [tournament.location, tournament.address]
    .filter(Boolean)
    .join(", ");

  return (
    <ListGroup>
      <FactRow
        icon="calendar-outline"
        label={formatCalendarDate(tournament.date)}
        detail={deadline ? `Registration closes ${formatDeadline(deadline)}` : null}
      />
      <FactRow
        icon="location-outline"
        label={tournament.location}
        detail={tournament.address}
        accessibilityLabel={`Open ${tournament.location} in Maps`}
        onPress={() => void openInMaps(mapsQuery)}
      />
      <FactRow
        icon="people-outline"
        label={`${gender} · ${region}`}
        detail={formats || null}
      />
      <FactRow
        icon="business-outline"
        label={
          tournament.hostSchool
            ? `Hosted by ${tournament.hostSchool.name}`
            : `Organized by ${tournament.organizerName}`
        }
        detail={
          tournament.hostSchool ? `Organized by ${tournament.organizerName}` : null
        }
      />
    </ListGroup>
  );
}

function FactRow({
  icon,
  label,
  detail,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label: string;
  detail?: string | null;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  const body = (
    <>
      <Icon name={icon} size={20} tone="muted" />
      <View style={styles.factText}>
        <AppText variant="callout" weight="500">
          {label}
        </AppText>
        {detail ? (
          <AppText variant="footnote" tone="muted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {onPress ? (
        <Icon name="chevron-forward" size={18} color={colors.mutedForeground} />
      ) : null}
    </>
  );

  if (!onPress) return <View style={styles.fact}>{body}</View>;
  return (
    <Tappable
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={styles.fact}
    >
      {body}
    </Tappable>
  );
}

function Availability({ tournament }: { tournament: TournamentDetailContract }) {
  const availability = tournament.registrationAvailability;
  const spotsLeft =
    availability.capacity === null
      ? null
      : Math.max(0, availability.capacity - availability.registeredCount);

  const stats: { label: string; value: number }[] = [
    { label: "Registered", value: availability.registeredCount },
  ];
  if (spotsLeft !== null) stats.push({ label: "Spots left", value: spotsLeft });
  if (availability.waitlistCount > 0) {
    stats.push({ label: "Waitlist", value: availability.waitlistCount });
  }

  return (
    <Card style={styles.stats}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={styles.stat}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}`}
        >
          <AppText variant="title" style={styles.tabular}>
            {stat.value}
          </AppText>
          <AppText variant="footnote" tone="muted">
            {stat.label}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xxl },
  header: { gap: space.sm },
  fact: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: HIT_TARGET,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  factText: { flex: 1, gap: space.xxs },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.xl },
  stat: { minWidth: 72, gap: space.xxs },
  tabular: { fontVariant: ["tabular-nums"] },
});
