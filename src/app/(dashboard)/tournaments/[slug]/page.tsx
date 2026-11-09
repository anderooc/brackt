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

import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Radio } from "lucide-react";
import { and, count, eq, inArray } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  courts,
  divisions,
  registrations,
  teamMembers,
  users,
} from "@/lib/db/schema";
import { StatusBadge } from "@/components/ui/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { BackLink } from "@/components/layout/back-link";
import { TournamentSummaryLine } from "@/components/tournament-header-meta";
import { isTournamentArchived } from "@/lib/tournament-status";
import {
  canEditTournamentSetup,
  canManageTournamentStaff,
  canRegisterTeams,
  hostChecklistSteps,
  resolveIsTournamentOrganizer,
  tournamentPreparationLockedReason,
} from "@/lib/tournaments/permissions";
import {
  getTournamentPlaySignals,
} from "@/lib/tournaments/match-query";
import { getHostSchoolById } from "@/lib/tournaments/host-school";
import { getTournamentBySlugIfVisible } from "@/lib/tournaments/access";
import { userCanDownloadTournamentPacket } from "@/lib/tournaments/packet-access";
import { userCanAccessTournamentWaiver } from "@/lib/tournaments/waiver-access";
import { userCanAccessTournamentPayment } from "@/lib/tournaments/payment-access";
import {
  userCanViewTournamentChat,
} from "@/lib/tournaments/chat-access";
import {
  buildTournamentSections,
  DEFAULT_TOURNAMENT_TAB,
  parseTournamentTab,
  tournamentTabUrl,
  type TournamentTabId,
  type TournamentTabItem,
} from "./constants";
import { TournamentPageHeading } from "./tournament-page-heading";
import { TournamentTabs } from "./tournament-tabs";
import { TournamentPanelSkeleton } from "./panels/panel-skeleton";
import { TournamentChatNotifier } from "./tournament-chat-notifier";
import { TournamentActivePanel } from "./tournament-active-panel";
import {
  TournamentOverviewHostPanel,
  TournamentOverviewPublicPanel,
} from "./panels/overview-panel";
import type { Metadata } from "next";
import {
  getTournamentNameBySlug,
  tournamentDetailTitle,
} from "@/lib/tournaments/metadata";
import { pageMetadata } from "@/lib/metadata";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string; division?: string; pool?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: Pick<Props, "params" | "searchParams">): Promise<Metadata> {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const name = await getTournamentNameBySlug(slug);
  if (!name) return pageMetadata("Tournament");
  return pageMetadata(tournamentDetailTitle(name, sp.tab));
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Legacy tab id — keep old bookmarks working.
  if (sp.tab === "messages") {
    redirect(
      tournamentTabUrl(slug, "email", {
        division: sp.division,
        pool: sp.pool,
      })
    );
  }

  const [tournament, memberRows] = await Promise.all([
    getTournamentBySlugIfVisible(slug, user),
    db
      .select({ teamId: teamMembers.teamId, role: teamMembers.role })
      .from(teamMembers)
      .where(eq(teamMembers.userId, user.id)),
  ]);
  if (!tournament) notFound();

  const id = tournament.id;
  const myTeamIds = memberRows.map((r) => r.teamId);
  const myTeamIdsSet = new Set(myTeamIds);
  const canManageStaff = canManageTournamentStaff(tournament, user);
  const showRegisterLink = canRegisterTeams(tournament);
  const isOrganizerPromise = resolveIsTournamentOrganizer(tournament, user);

  // Shell queries only — tab panels load their own heavy data. Everything here
  // only needs the tournament row, so it runs in one parallel wave; the
  // organizer check is request-cached, so the access helpers share it.
  const [
    isOrganizer,
    canEditSetup,
    organizerRows,
    tournamentDivisions,
    courtCountRow,
    registrationCounts,
    hostSchool,
    playSignals,
    canDownloadPacket,
    canAccessWaiver,
    canAccessPayment,
    showChatTab,
    myPendingRow,
  ] = await Promise.all([
    isOrganizerPromise,
    canEditTournamentSetup(tournament, user),
    db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, tournament.organizerId))
      .limit(1),
    db
      .select({
        id: divisions.id,
        format: divisions.format,
        poolsReleasedAt: divisions.poolsReleasedAt,
      })
      .from(divisions)
      .where(eq(divisions.tournamentId, id)),
    db
      .select({ value: count() })
      .from(courts)
      .where(eq(courts.tournamentId, id)),
    db
      .select({
        status: registrations.status,
        value: count(),
      })
      .from(registrations)
      .where(eq(registrations.tournamentId, id))
      .groupBy(registrations.status),
    getHostSchoolById(tournament.hostSchoolId),
    isOrganizerPromise.then((forOrganizer) =>
      getTournamentPlaySignals(id, { forOrganizer })
    ),
    userCanDownloadTournamentPacket(tournament, user, myTeamIdsSet),
    userCanAccessTournamentWaiver(tournament, user, myTeamIdsSet),
    userCanAccessTournamentPayment(tournament, user, myTeamIdsSet),
    userCanViewTournamentChat(tournament, user, myTeamIds),
    myTeamIds.length > 0
      ? db
          .select({ value: count() })
          .from(registrations)
          .where(
            and(
              eq(registrations.tournamentId, id),
              eq(registrations.status, "pending"),
              inArray(registrations.teamId, myTeamIds)
            )
          )
          .then((rows) => rows[0])
      : Promise.resolve(undefined),
  ]);

  const preparationLockedReason = isOrganizer
    ? tournamentPreparationLockedReason(tournament)
    : null;

  const organizer = organizerRows[0] ?? null;
  const courtCount = courtCountRow[0]?.value ?? 0;
  const divisionCount = tournamentDivisions.length;

  let pendingCount = 0;
  let confirmedCount = 0;
  let registrationCount = 0;
  for (const row of registrationCounts) {
    registrationCount += row.value;
    if (row.status === "pending") pendingCount = row.value;
    if (row.status === "confirmed" || row.status === "checked_in") {
      confirmedCount += row.value;
    }
  }

  const hasScheduledMatches = playSignals.hasScheduledMatches;
  const myPendingCount = isOrganizer ? 0 : (myPendingRow?.value ?? 0);

  const hasPoolPlayFormat = tournamentDivisions.some(
    (d) => d.format === "pool_to_bracket"
  );
  const hasBracketFormat = tournamentDivisions.some(
    (d) =>
      d.format === "pool_to_bracket" ||
      d.format === "single_elimination" ||
      d.format === "double_elimination"
  );
  const hasReleasedPoolPlay = tournamentDivisions.some(
    (d) => d.poolsReleasedAt != null
  );

  const showTeamsTab = isOrganizer;
  const showPendingTab = isOrganizer || myPendingCount > 0;
  const showPoolPlayTab = isOrganizer
    ? playSignals.hasPoolMatches || hasPoolPlayFormat
    : hasReleasedPoolPlay;
  const showBracketTab = isOrganizer
    ? playSignals.hasBrackets || hasBracketFormat
    : playSignals.hasBrackets;
  const showMatchesTab = playSignals.hasVisibleMatches;

  const showPacketTab = isOrganizer || canDownloadPacket;
  const showWaiverTab =
    isOrganizer || (tournament.waiverEnabled && canAccessWaiver);
  const showPaymentTab =
    isOrganizer || (tournament.paymentEnabled && canAccessPayment);
  const captainTeamIds = new Set(
    memberRows.filter((r) => r.role === "captain").map((r) => r.teamId)
  );

  // Order within each section is the order of its view switcher.
  const views: TournamentTabItem[] = [{ id: "overview", label: "Overview" }];
  if (showTeamsTab) {
    views.push({ id: "teams", label: "Confirmed", count: confirmedCount });
  }
  if (showPendingTab) {
    views.push({
      id: "pending",
      label: isOrganizer ? "Pending" : "Your application",
      badge: isOrganizer ? pendingCount : myPendingCount,
    });
  }
  if (showPoolPlayTab) views.push({ id: "pool-play", label: "Pools" });
  if (showBracketTab) views.push({ id: "bracket", label: "Bracket" });
  if (showMatchesTab) views.push({ id: "matches", label: "Matches" });
  if (isOrganizer) views.push({ id: "email", label: "Email" });
  if (showChatTab) views.push({ id: "chat", label: "Chat" });
  views.push({
    id: "setup",
    label: isOrganizer ? "General" : "Pools & courts",
  });
  if (showPacketTab) views.push({ id: "packet", label: "Packet" });
  if (showWaiverTab) views.push({ id: "waiver", label: "Waiver" });
  if (showPaymentTab) views.push({ id: "payment", label: "Payment" });

  const allowedTabs = new Set<TournamentTabId>(views.map((v) => v.id));

  // With no explicit tab, land where this tournament's lifecycle needs you:
  // results once play starts, the application for a waiting captain, else
  // the overview.
  const playUnderway =
    tournament.status === "in_progress" || tournament.status === "completed";
  const playLanding: TournamentTabId | undefined = playUnderway
    ? playSignals.hasSeededBrackets && showBracketTab
      ? "bracket"
      : showPoolPlayTab
        ? "pool-play"
        : showBracketTab
          ? "bracket"
          : showMatchesTab
            ? "matches"
            : undefined
    : undefined;
  const fallbackTab: TournamentTabId =
    playLanding ??
    (!isOrganizer && myPendingCount > 0 && allowedTabs.has("pending")
      ? "pending"
      : DEFAULT_TOURNAMENT_TAB);

  const activeTab = parseTournamentTab(sp.tab, allowedTabs, fallbackTab);

  const sections = buildTournamentSections(views, {
    overview: "Overview",
    teams: "Teams",
    play: "Play",
    messages: "Messages",
    settings: isOrganizer ? "Settings" : "Event info",
  });

  const checklist = isOrganizer
    ? hostChecklistSteps({
        status: tournament.status,
        description: tournament.description,
        address: tournament.address,
        playFormat: tournament.playFormat ?? "pool_to_bracket",
        divisionCount,
        courtCount,
        registrationCount,
        pendingCount,
        matchFormat: tournament.matchFormat,
        setStartingScore: tournament.setStartingScore,
        setTargetScore: tournament.setTargetScore,
        tiebreakTargetScore: tournament.tiebreakTargetScore,
        warmupFormat: tournament.warmupFormat,
        poolTiebreakCriteria: tournament.poolTiebreakCriteria,
        poolSettingsSavedAt: tournament.poolSettingsSavedAt,
        bracketCount: tournament.bracketCount ?? 1,
        goldTeamCount: tournament.goldTeamCount,
        silverTeamCount: tournament.silverTeamCount,
        bracketSettingsSavedAt: tournament.bracketSettingsSavedAt,
        hasPools: playSignals.hasPoolMatches,
        hasPoolsReleased: hasReleasedPoolPlay,
        hasSeededBrackets: playSignals.hasSeededBrackets,
        hasScheduledMatches,
      })
    : [];

  const organizerName = organizer?.fullName ?? "Unknown organizer";
  const overviewTournament = {
    id: tournament.id,
    slug: tournament.slug,
    status: tournament.status,
    description: tournament.description,
    location: tournament.location,
    address: tournament.address,
    date: tournament.date,
    gender: tournament.gender,
    region: tournament.region,
    registrationCapacity: tournament.registrationCapacity,
  };

  return (
    <div className="space-y-5 pb-6">
      <BackLink href="/tournaments">All tournaments</BackLink>

      {isOrganizer ? (
        <TournamentPageHeading
          tournamentId={tournament.id}
          initialSlug={tournament.slug}
          initialName={tournament.name}
          description={tournament.description}
          location={tournament.location}
          address={tournament.address}
          date={tournament.date}
          status={tournament.status}
          showRegisterLink={showRegisterLink}
        />
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="min-w-0 max-w-full text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                {tournament.name}
              </h1>
              <StatusBadge
                kind="tournament"
                status={tournament.status}
                date={tournament.date}
                className="shrink-0"
              />
            </div>
            <TournamentSummaryLine
              location={tournament.location}
              address={tournament.address}
              date={tournament.date}
            />
          </div>
          {showRegisterLink ? (
            <Link
              href={`/tournaments/${tournament.slug}/register`}
              className={buttonVariants({ className: "shrink-0" })}
            >
              Register a team
            </Link>
          ) : (
            <Link
              href={`/tournaments/${tournament.slug}/scoring`}
              className={buttonVariants({
                variant: "outline",
                className: "shrink-0",
              })}
            >
              <Radio className="size-4" aria-hidden />
              Live scoring
            </Link>
          )}
        </div>
      )}

      {isOrganizer && showChatTab && tournament.status === "in_progress" ? (
        <TournamentChatNotifier tournamentId={id} />
      ) : null}

      <TournamentTabs
        slug={tournament.slug}
        activeTab={activeTab}
        sections={sections}
      >
        {activeTab === "overview" ? (
          isOrganizer ? (
            <TournamentOverviewHostPanel
              tournament={overviewTournament}
              organizerName={organizerName}
              hostSchool={hostSchool}
              allowedTabs={allowedTabs}
              confirmedCount={confirmedCount}
              pendingCount={pendingCount}
              divisionCount={divisionCount}
              courtCount={courtCount}
              steps={checklist}
              archived={isTournamentArchived(tournament.date)}
            />
          ) : (
            <TournamentOverviewPublicPanel
              tournament={overviewTournament}
              organizerName={organizerName}
              hostSchool={hostSchool}
              allowedTabs={allowedTabs}
              confirmedCount={confirmedCount}
              myPendingCount={myPendingCount}
              canRegister={showRegisterLink}
              canDownloadPacket={canDownloadPacket}
            />
          )
        ) : (
          <Suspense key={activeTab} fallback={<TournamentPanelSkeleton />}>
            <TournamentActivePanel
              activeTab={activeTab}
              tournament={tournament}
              user={user}
              canEditSetup={canEditSetup}
              canManageStaff={canManageStaff}
              preparationLockedReason={preparationLockedReason}
              myTeamIds={myTeamIds}
              captainTeamIds={captainTeamIds}
              isOrganizer={isOrganizer}
              showPacketTab={showPacketTab}
              showWaiverTab={showWaiverTab}
              showPaymentTab={showPaymentTab}
              showChatTab={showChatTab}
              showTeamsTab={showTeamsTab}
              showPendingTab={showPendingTab}
              showPoolPlayTab={showPoolPlayTab}
              showBracketTab={showBracketTab}
              showMatchesTab={showMatchesTab}
              divisionId={sp.division ?? null}
              focusPoolId={sp.pool ?? null}
            />
          </Suspense>
        )}
      </TournamentTabs>
    </div>
  );
}
