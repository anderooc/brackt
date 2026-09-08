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

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  matches,
  sets,
  teams,
  courts,
} from "@/lib/db/schema";
import { asc, inArray } from "drizzle-orm";
import { BackLink } from "@/components/layout/back-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Radio, Clock, CheckCircle2, ExternalLink } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScoringCard } from "./scoring-card";
import { LiveScoreViewer } from "./live-score-viewer";
import { ShareScoreboardDialog } from "@/components/tournament-public/share-scoreboard-dialog";
import { setStartingScoreForMatch } from "@/lib/tournaments/match-format";
import { getTournamentBySlugIfVisible } from "@/lib/tournaments/access";
import { cn } from "@/lib/utils";
import {
  canScoreMatches,
  resolveIsTournamentOrganizer,
} from "@/lib/tournaments/permissions";
import { getTournamentMatchIds } from "@/lib/tournaments/match-query";
import {
  getMatchDivisionIdMap,
  getUnreleasedDivisionIds,
} from "@/lib/tournaments/unreleased-divisions";
import type { Metadata } from "next";
import { getTournamentNameBySlug } from "@/lib/tournaments/metadata";
import { pageMetadata, pageTitle } from "@/lib/metadata";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const name = await getTournamentNameBySlug(slug);
  if (!name) return pageMetadata("Live scoring");
  return pageMetadata(pageTitle("Live scoring", name));
}

export default async function ScoringPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/explore/tournaments/${slug}/scores`);
  }

  const tournament = await getTournamentBySlugIfVisible(slug, user);
  if (!tournament) notFound();

  const id = tournament.id;
  const canScore = await canScoreMatches(tournament, user);
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);

  const matchIds = await getTournamentMatchIds(id);

  let allMatches =
    matchIds.length === 0
      ? []
      : await db
          .select()
          .from(matches)
          .where(inArray(matches.id, matchIds))
          .orderBy(asc(matches.scheduledTime));

  if (!isOrganizer && allMatches.length > 0) {
    const [unreleasedDivisionIds, matchDivisionId] = await Promise.all([
      getUnreleasedDivisionIds(id),
      getMatchDivisionIdMap(id),
    ]);
    if (unreleasedDivisionIds.size > 0) {
      allMatches = allMatches.filter((match) => {
        const divisionId = matchDivisionId.get(match.id);
        if (!divisionId) return true;
        return !unreleasedDivisionIds.has(divisionId);
      });
    }
  }

  const visibleMatchIds = allMatches.map((match) => match.id);
  const teamIds = [
    ...new Set(
      allMatches.flatMap((match) =>
        [match.teamAId, match.teamBId, match.refTeamId].filter(
          (teamId): teamId is string => teamId !== null
        )
      )
    ),
  ];
  const courtIds = [
    ...new Set(
      allMatches
        .map((match) => match.courtId)
        .filter((courtId): courtId is string => courtId !== null)
    ),
  ];

  const [teamRows, courtRows, setRows] = await Promise.all([
    teamIds.length === 0
      ? []
      : db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, teamIds)),
    courtIds.length === 0
      ? []
      : db
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(inArray(courts.id, courtIds)),
    visibleMatchIds.length === 0
      ? []
      : db
          .select()
          .from(sets)
          .where(inArray(sets.matchId, visibleMatchIds))
          .orderBy(asc(sets.matchId), asc(sets.setNumber)),
  ]);

  const teamById = new Map(teamRows.map((team) => [team.id, team]));
  const courtById = new Map(courtRows.map((court) => [court.id, court]));
  const setsByMatchId = new Map<string, typeof setRows>();
  for (const set of setRows) {
    const matchSets = setsByMatchId.get(set.matchId) ?? [];
    matchSets.push(set);
    setsByMatchId.set(set.matchId, matchSets);
  }

  const enrichedMatches = allMatches.map((match) => ({
    ...match,
    teamA: match.teamAId ? (teamById.get(match.teamAId) ?? null) : null,
    teamB: match.teamBId ? (teamById.get(match.teamBId) ?? null) : null,
    courtName: match.courtId
      ? (courtById.get(match.courtId)?.name ?? null)
      : null,
    refTeamName: match.refTeamId
      ? (teamById.get(match.refTeamId)?.name ?? null)
      : null,
    sets: setsByMatchId.get(match.id) ?? [],
  }));

  const inProgress = enrichedMatches.filter((m) => m.status === "in_progress");
  const upcoming = enrichedMatches.filter((m) => m.status === "upcoming");
  const completed = enrichedMatches.filter((m) => m.status === "completed");

  return (
    <div className="space-y-6">
      <BackLink href={`/tournaments/${slug}`}>Back to tournament</BackLink>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Scoring</h1>
          <p className="text-muted-foreground">{tournament.name}</p>
          {isOrganizer && !canScore && (
            <p className="mt-2 text-sm text-muted-foreground">
              Set the tournament status to In progress to enter scores.
            </p>
          )}
          {!isOrganizer && !canScore && (
            <p className="mt-2 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded inline-block">
              Viewing as spectator. Score entry is reserved for assigned referees and tournament organizers.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ShareScoreboardDialog slug={slug} tournamentName={tournament.name} />
          <Link
            href={`/explore/tournaments/${slug}/scores`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs gap-1.5")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Fan scoreboard</span>
          </Link>
        </div>
      </div>

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">
            Live ({inProgress.length})
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completed.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          {inProgress.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No matches in progress"
              description="Start an upcoming match to begin tracking sets and scores live."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {inProgress.map((match) => (
                <ScoringCard
                  key={match.id}
                  match={match}
                  canScore={canScore}
                  matchFormat={tournament.matchFormat}
                  setStartingScore={setStartingScoreForMatch(tournament, match)}
                  setTargetScore={tournament.setTargetScore}
                  tiebreakTargetScore={tournament.tiebreakTargetScore}
                  warmupFormat={tournament.warmupFormat}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No upcoming matches"
              description="Generate pools or brackets and schedule matches to see them here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcoming.map((match) => (
                <ScoringCard
                  key={match.id}
                  match={match}
                  canScore={canScore}
                  matchFormat={tournament.matchFormat}
                  setStartingScore={setStartingScoreForMatch(tournament, match)}
                  setTargetScore={tournament.setTargetScore}
                  tiebreakTargetScore={tournament.tiebreakTargetScore}
                  warmupFormat={tournament.warmupFormat}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completed.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="No completed matches yet"
              description="Finalized matches and their set scores will appear here."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {completed.map((match) => (
                <ScoringCard
                  key={match.id}
                  match={match}
                  canScore={canScore}
                  matchFormat={tournament.matchFormat}
                  setStartingScore={setStartingScoreForMatch(tournament, match)}
                  setTargetScore={tournament.setTargetScore}
                  tiebreakTargetScore={tournament.tiebreakTargetScore}
                  warmupFormat={tournament.warmupFormat}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <LiveScoreViewer tournamentId={id} matchIds={visibleMatchIds} />
    </div>
  );
}
