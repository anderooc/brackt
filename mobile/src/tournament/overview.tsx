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

import type { TournamentDetailContract } from "@/lib/api/contracts/tournament";
import type { TournamentParticipationContract } from "@/lib/api/contracts/tournament-ops";
import { useRouter, type Href } from "expo-router";
import { Linking, StyleSheet, View } from "react-native";
import {
  DIVISION_FORMAT_LABELS,
  formatCalendarDate,
  formatDeadline,
  GENDER_LABELS,
  REGION_LABELS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import {
  AppText,
  Badge,
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Section,
  StatusBadge,
  Tappable,
  HIT_TARGET,
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
}: {
  tournament: TournamentDetailContract;
  participation: TournamentParticipationContract | null;
}) {
  const router = useRouter();
  const slug = tournament.slug;

  const alreadyEntered = (participation?.myTeams.length ?? 0) > 0;
  const showRegister =
    tournament.registrationOpen &&
    !alreadyEntered &&
    (participation == null || participation.canRegister);

  const playLinks: LinkItem[] = [
    {
      href: `/tournament/${slug}/pools`,
      title: "Pools",
      detail: "Standings and pool matches",
      icon: "grid-outline",
    },
    {
      href: `/tournament/${slug}/bracket`,
      title: "Bracket",
      detail: "Elimination rounds",
      icon: "git-network-outline",
    },
    {
      href: `/tournament/${slug}/scoring`,
      title: "Live scores",
      detail: "What's on court now",
      icon: "pulse-outline",
    },
  ];

  const hostLinks: LinkItem[] = participation?.isOrganizer
    ? [
        {
          href: `/tournament/${slug}/host`,
          title: "Host dashboard",
          detail: "Status, checklist, and tournament ops",
          icon: "construct-outline",
        },
        {
          href: `/tournament/${slug}/settings/pool`,
          title: "Pool settings",
          detail: "Match format, scoring, and tie-breaks",
          icon: "settings-outline",
        },
        {
          href: `/tournament/${slug}/settings/bracket`,
          title: "Bracket settings",
          detail: "Gold / silver / bronze structure",
          icon: "settings-outline",
        },
      ]
    : [];

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
        access.email
          ? {
              href: `/tournament/${slug}/email` as Href,
              title: "Email captains",
              detail: "Message registered team captains",
              icon: "mail-outline" as const,
            }
          : null,
      ] as (LinkItem | null)[]).filter((link): link is LinkItem => link !== null)
    : [];

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

      {showRegister ? (
        <Button
          label="Register a team"
          icon="add-circle-outline"
          fullWidth
          onPress={() => router.push(`/tournament/${slug}/register`)}
        />
      ) : null}

      {alreadyEntered ? (
        <Section title="Your teams">
          <ListGroup>
            {participation!.myTeams.map((team) => (
              <ListRow
                key={team.slug}
                title={team.name}
                icon="people-outline"
                trailing={<StatusBadge kind="registration" status={team.status} />}
              />
            ))}
          </ListGroup>
        </Section>
      ) : null}

      <KeyFacts tournament={tournament} />

      <Availability tournament={tournament} />

      <LinkSection title="Follow play" links={playLinks} />
      <LinkSection title="Host tools" links={hostLinks} />
      <LinkSection title="Team tools" links={teamLinks} />

      {tournament.description ? (
        <Section title="About">
          <AppText variant="body">{tournament.description}</AppText>
        </Section>
      ) : null}

      <Formats tournament={tournament} />
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
        onPress={() =>
          void Linking.openURL(
            `https://maps.apple.com/?q=${encodeURIComponent(mapsQuery)}`
          )
        }
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

function Formats({ tournament }: { tournament: TournamentDetailContract }) {
  return (
    <Section title="Pools and brackets">
      {tournament.divisions.length === 0 ? (
        <AppText variant="subhead" tone="muted">
          Not posted yet. Check back closer to the event.
        </AppText>
      ) : (
        <ListGroup>
          {tournament.divisions.map((division) => (
            <ListRow
              key={division.name}
              title={division.name}
              subtitle={DIVISION_FORMAT_LABELS[division.format] ?? division.format}
              trailing={
                <Badge
                  label={division.poolsReleased ? "Posted" : "Not posted"}
                  tone={division.poolsReleased ? "success" : "neutral"}
                />
              }
            />
          ))}
        </ListGroup>
      )}
    </Section>
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
