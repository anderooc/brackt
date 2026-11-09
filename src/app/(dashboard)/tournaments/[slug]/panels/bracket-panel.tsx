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

import { Trophy } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import { asc, eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { divisions, tournaments, courts, teams, registrations } from "@/lib/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  resolveIsTournamentOrganizer,
  type UserForPermissions,
} from "@/lib/tournaments/permissions";
import {
  ensureDivisionBracketSkeleton,
  ensureTournamentCombinedBrackets,
  repairBracketWinnerAdvances,
  tournamentCombinedBracketsRegenerateState,
  tryFillBracketFromDivisionSeeds,
  tryFillTournamentCombinedBrackets,
} from "@/lib/tournaments/bracket-structure";
import {
  bracketHasStaleAdvance,
  bracketHasTeams,
  bracketHasUnseededTree,
  poolPlayFinished,
} from "@/lib/tournaments/bracket-health";
import { getDivisionPlayData, type DivisionPlayData } from "../brackets/data";
import { BracketView } from "../brackets/bracket-view";
import { BracketMatchAdmin } from "../brackets/bracket-match-admin";
import { BracketSeedingTable } from "../brackets/bracket-seeding-table";
import { BracketSettingsPanel } from "../brackets/bracket-settings-panel";
import { buildBracketSeedingReport } from "@/lib/tournaments/combined-bracket-standings";
import { bracketScheduleLabel } from "@/lib/tournaments/bracket-tiers";
import { ScheduleMatchTimesSection } from "../matches/schedule-match-times-section";
import { scheduleGroupsFromPlayData } from "@/lib/utils/schedule-times-groups";

/**
 * Bracket shells, seeding, and winner advancement are written when divisions,
 * seeds, settings, or match results change. This only repairs data that is
 * visibly out of step (legacy tournaments, interrupted writes), so a healthy
 * bracket renders without any writes. Returns true when anything ran.
 */
async function repairBracketsIfNeeded({
  tournamentId,
  isOrganizer,
  playData,
  poolDivisionIds,
  otherDivisions,
}: {
  tournamentId: string;
  isOrganizer: boolean;
  playData: DivisionPlayData[];
  poolDivisionIds: string[];
  otherDivisions: { id: string; format: string }[];
}): Promise<boolean> {
  const byId = new Map(playData.map((d) => [d.id, d]));
  let repaired = false;

  if (isOrganizer && poolDivisionIds.length > 0) {
    const [ownerId, ...nonOwnerIds] = poolDivisionIds;
    const ownerBrackets = byId.get(ownerId)?.brackets ?? [];
    const needsShells =
      ownerBrackets.length === 0 ||
      ownerBrackets.some((b) => bracketHasUnseededTree(b.matches)) ||
      nonOwnerIds.some((id) =>
        (byId.get(id)?.brackets ?? []).some((b) => !bracketHasTeams(b.matches))
      );
    if (needsShells) {
      await ensureTournamentCombinedBrackets(tournamentId);
      repaired = true;
    }

    const seeded = ownerBrackets.some((b) => bracketHasTeams(b.matches));
    const poolsDone = poolDivisionIds.every((id) =>
      poolPlayFinished(byId.get(id)?.pools ?? [])
    );
    if (!seeded && poolsDone) {
      await tryFillTournamentCombinedBrackets(tournamentId);
      repaired = true;
    }
  }

  if (isOrganizer) {
    for (const div of otherDivisions) {
      const data = byId.get(div.id);
      const divBrackets = data?.brackets ?? [];
      if (
        divBrackets.length === 0 ||
        divBrackets.some((b) => bracketHasUnseededTree(b.matches))
      ) {
        await ensureDivisionBracketSkeleton(div.id, div.format);
        repaired = true;
      }
      const teamCount =
        data?.pools.reduce((n, p) => n + p.teams.length, 0) ?? 0;
      if (
        div.format === "single_elimination" &&
        teamCount >= 2 &&
        !divBrackets.some((b) => bracketHasTeams(b.matches))
      ) {
        await tryFillBracketFromDivisionSeeds(div.id);
        repaired = true;
      }
    }
  }

  for (const div of playData) {
    for (const bracket of div.brackets) {
      if (bracketHasStaleAdvance(bracket.matches)) {
        await repairBracketWinnerAdvances(bracket.id);
        repaired = true;
      }
    }
  }

  return repaired;
}

export async function TournamentBracketPanel({
  tournament,
  user,
}: {
  tournament: InferSelectModel<typeof tournaments>;
  user: UserForPermissions;
}) {
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);

  // One parallel wave. Courts, team labels, and regenerate state only feed
  // organizer controls, so participants skip them.
  const [
    tournamentDivisions,
    tournamentCourts,
    registeredTeams,
    loadedPlayData,
    loadedRegenerateState,
  ] = await Promise.all([
    db
      .select({
        id: divisions.id,
        name: divisions.name,
        format: divisions.format,
        poolsReleasedAt: divisions.poolsReleasedAt,
      })
      .from(divisions)
      .where(eq(divisions.tournamentId, tournament.id))
      .orderBy(asc(divisions.createdAt), asc(divisions.id)),
    isOrganizer
      ? db
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(eq(courts.tournamentId, tournament.id))
          .orderBy(asc(courts.name), asc(courts.id))
      : Promise.resolve([]),
    isOrganizer
      ? db
          .select({
            id: teams.id,
            name: teams.name,
            university: teams.university,
          })
          .from(registrations)
          .innerJoin(teams, eq(registrations.teamId, teams.id))
          .where(
            and(
              eq(registrations.tournamentId, tournament.id),
              inArray(registrations.status, ["confirmed", "checked_in"])
            )
          )
          .orderBy(asc(teams.name))
      : Promise.resolve([]),
    getDivisionPlayData(tournament.id, { forOrganizer: isOrganizer }),
    isOrganizer
      ? tournamentCombinedBracketsRegenerateState(tournament.id)
      : Promise.resolve({ canRegenerate: false, reason: undefined }),
  ]);

  const poolDivisions = tournamentDivisions.filter(
    (d) => d.format === "pool_to_bracket"
  );
  const otherDivisions = tournamentDivisions.filter(
    (d) =>
      d.format === "single_elimination" || d.format === "double_elimination"
  );

  const repaired = await repairBracketsIfNeeded({
    tournamentId: tournament.id,
    isOrganizer,
    playData: loadedPlayData,
    poolDivisionIds: poolDivisions.map((d) => d.id),
    otherDivisions,
  });
  const [playData, regenerateState] = repaired
    ? await Promise.all([
        getDivisionPlayData(tournament.id, { forOrganizer: isOrganizer }),
        isOrganizer
          ? tournamentCombinedBracketsRegenerateState(tournament.id)
          : loadedRegenerateState,
      ])
    : [loadedPlayData, loadedRegenerateState];

  const teamLabels = registeredTeams.map((t) => ({
    id: t.id,
    label: `${t.name} (${t.university})`,
  }));

  const ownerId = poolDivisions[0]?.id;
  const combinedBrackets =
    ownerId != null
      ? (playData.find((d) => d.id === ownerId)?.brackets ?? [])
      : [];

  const combinedLocked = combinedBrackets.some((b) =>
    b.matches.some((m) => m.teamAId || m.teamBId)
  );

  const poolDivisionIds = new Set(poolDivisions.map((d) => d.id));
  const totalBracketTeams = [
    ...new Set(
      playData
        .filter((d) => poolDivisionIds.has(d.id))
        .flatMap((d) => d.pools.flatMap((p) => p.teams.map((t) => t.id)))
    ),
  ].length;

  const showCombined =
    poolDivisions.length > 0 &&
    (isOrganizer ||
      poolDivisions.some((d) => d.poolsReleasedAt != null));

  const otherEligible = playData.filter((d) => {
    const format = tournamentDivisions.find((x) => x.id === d.id)?.format;
    if (
      format !== "single_elimination" &&
      format !== "double_elimination"
    ) {
      return false;
    }
    if (!isOrganizer && !d.poolsReleasedAt) return false;
    return isOrganizer || d.brackets.length > 0;
  });

  const hasAnything =
    (showCombined && (isOrganizer || combinedBrackets.length > 0)) ||
    otherEligible.length > 0;

  const seedingReport =
    showCombined && poolDivisions.length > 0
      ? buildBracketSeedingReport({
          pools: playData
            .filter((d) => poolDivisionIds.has(d.id))
            .flatMap((d) =>
              d.pools.map((p) => ({
                poolName: p.name,
                divisionName: d.name,
                teams: p.teams,
                matches: p.matches,
              }))
            ),
          tiebreakCriteria: tournament.poolTiebreakCriteria,
          bracketCount: tournament.bracketCount ?? 1,
          goldTeamCount: tournament.goldTeamCount,
          silverTeamCount: tournament.silverTeamCount,
        })
      : null;

  const showBracketTiers = (tournament.bracketCount ?? 1) > 1;

  const scheduleGroups = isOrganizer
    ? scheduleGroupsFromPlayData(
        [
          ...(showCombined
            ? playData.filter((d) => poolDivisionIds.has(d.id))
            : []),
          ...otherEligible,
        ],
        "brackets"
      )
    : [];

  return (
    <div className="space-y-6">
      {isOrganizer && (poolDivisions.length > 0 || scheduleGroups.length > 0) && (
        <div
          className={
            poolDivisions.length > 0 && scheduleGroups.length > 0
              ? "grid gap-3 lg:grid-cols-2"
              : undefined
          }
        >
          {poolDivisions.length > 0 && (
            <BracketSettingsPanel
              tournamentId={tournament.id}
              bracketCount={tournament.bracketCount ?? 1}
              goldTeamCount={tournament.goldTeamCount ?? null}
              silverTeamCount={tournament.silverTeamCount ?? null}
              locked={combinedLocked}
              canRegenerate={regenerateState.canRegenerate}
              regenerateBlockedReason={regenerateState.reason}
              totalBracketTeams={totalBracketTeams}
            />
          )}
          {scheduleGroups.length > 0 && (
            <ScheduleMatchTimesSection
              tournamentId={tournament.id}
              tournamentDate={tournament.date}
              groups={scheduleGroups}
            />
          )}
        </div>
      )}

      {!hasAnything ? (
        <EmptyState
        illustration="results"
          icon={Trophy}
          title={isOrganizer ? "No brackets yet" : "Brackets not released yet"}
          description={
            isOrganizer
              ? "Add a pool-to-bracket division in Setup. All pools combine into gold / silver / bronze after pool play."
              : "The host hasn’t released brackets for this tournament. Check back once they’re published."
          }
        />
      ) : (
        <>
          {showCombined && (
            <div className="space-y-4">
              {seedingReport && seedingReport.rows.length > 0 && (
                <BracketSeedingTable
                  report={seedingReport}
                  showTiers={showBracketTiers}
                />
              )}
              {combinedBrackets.length === 0 ? (
                <EmptyState
        illustration="results"
                  icon={Trophy}
                  title="No brackets yet"
                  description="Finish pool play in every pool to seed gold / silver / bronze."
                />
              ) : (
                <div className="space-y-4">
                  {combinedBrackets.map((bracket) => (
                    <div key={bracket.id} className="space-y-4">
                      <BracketView bracket={bracket} slug={tournament.slug} />
                      {isOrganizer && (
                        <BracketMatchAdmin
                          tournamentId={tournament.id}
                          slug={tournament.slug}
                          tournamentDate={tournament.date}
                          bracketName={bracketScheduleLabel(bracket)}
                          matches={bracket.matches}
                          courts={tournamentCourts}
                          teamLabels={teamLabels}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {otherEligible.length > 0 && (
            <Tabs defaultValue={otherEligible[0].id}>
              {otherEligible.length > 1 && (
                <TabsList>
                  {otherEligible.map((div) => (
                    <TabsTrigger key={div.id} value={div.id}>
                      {div.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              )}
              {otherEligible.map((div) => (
                <TabsContent
                  key={div.id}
                  value={div.id}
                  className="mt-4 space-y-4"
                >
                  {div.brackets.length === 0 ? (
                    <EmptyState
        illustration="results"
                      icon={Trophy}
                      title="No bracket for this division yet"
                      description="Add the division again in Setup if this persists."
                    />
                  ) : (
                    <div className="space-y-4">
                      {div.brackets.map((bracket) => (
                        <div key={bracket.id} className="space-y-4">
                          <BracketView
                            bracket={bracket}
                            slug={tournament.slug}
                          />
                          {isOrganizer && (
                            <BracketMatchAdmin
                              tournamentId={tournament.id}
                              slug={tournament.slug}
                              tournamentDate={tournament.date}
                              bracketName={bracketScheduleLabel(bracket)}
                              matches={bracket.matches}
                              courts={tournamentCourts}
                              teamLabels={teamLabels}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}
