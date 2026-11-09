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

import { LayoutGrid, Users } from "lucide-react";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { divisions, registrations, tournaments } from "@/lib/db/schema";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  canAssignTeamsToPools,
  resolveIsTournamentOrganizer,
  poolAssignmentBlockedMessage,
  type UserForPermissions,
} from "@/lib/tournaments/permissions";
import { ensureDivisionBracketSkeleton } from "@/lib/tournaments/bracket-structure";
import { getDivisionPlayData } from "../brackets/data";
import { DivisionPoolRelease } from "../brackets/division-pool-release";
import { PoolMatchFormatPanel } from "../brackets/pool-match-format-panel";
import { PoolSeedingPanel } from "../brackets/pool-seeding-panel";
import { PoolView } from "../brackets/pool-view";
import { ScrollToPool } from "./scroll-to-pool";
import { ScheduleMatchTimesSection } from "../matches/schedule-match-times-section";
import { scheduleGroupsFromPlayData } from "@/lib/utils/schedule-times-groups";

export async function TournamentPoolPlayPanel({
  tournament,
  user,
  initialDivisionId = null,
  focusPoolId = null,
}: {
  tournament: InferSelectModel<typeof tournaments>;
  user: UserForPermissions;
  /** Division tab to open when deep-linking from a match. */
  initialDivisionId?: string | null;
  /** Pool section to scroll into view when deep-linking from a match. */
  focusPoolId?: string | null;
}) {
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);

  const [divisionPlayData, pendingCountRow, tournamentDivisions] =
    await Promise.all([
      getDivisionPlayData(tournament.id, { forOrganizer: isOrganizer }),
      db
        .select({ value: count() })
        .from(registrations)
        .where(
          and(
            eq(registrations.tournamentId, tournament.id),
            eq(registrations.status, "pending")
          )
        ),
      isOrganizer
        ? db
            .select({
              id: divisions.id,
              format: divisions.format,
            })
            .from(divisions)
            .where(eq(divisions.tournamentId, tournament.id))
            .orderBy(asc(divisions.createdAt), asc(divisions.id))
        : Promise.resolve([]),
    ]);

  const pendingCount = pendingCountRow[0]?.value ?? 0;
  const canAssignPools = await canAssignTeamsToPools(
    tournament,
    user,
    pendingCount
  );
  const poolAssignmentBlocked = poolAssignmentBlockedMessage(pendingCount);

  if (isOrganizer && tournamentDivisions.length > 0) {
    const divsWithBracket = new Set(
      divisionPlayData.filter((d) => d.brackets.length > 0).map((d) => d.id)
    );
    // Pool-to-bracket divisions share one set of brackets owned by the first
    // of them, so the others are expected to have none.
    const poolBracketOwnerId = tournamentDivisions.find(
      (d) => d.format === "pool_to_bracket"
    )?.id;
    for (const div of tournamentDivisions) {
      if (divsWithBracket.has(div.id)) continue;
      if (div.format === "pool_to_bracket" && div.id !== poolBracketOwnerId) {
        continue;
      }
      await ensureDivisionBracketSkeleton(div.id, div.format);
    }
  }

  const poolMatchesStartedByPoolId = new Map<string, boolean>();
  if (isOrganizer) {
    for (const div of divisionPlayData) {
      for (const pool of div.pools) {
        poolMatchesStartedByPoolId.set(
          pool.id,
          pool.matches.some((m) => m.status !== "upcoming")
        );
      }
    }
  }

  const eligibleDivisions = divisionPlayData.filter((d) => {
    if (d.format !== "pool_to_bracket") {
      return isOrganizer && d.pools.some((p) => p.matches.length > 0);
    }
    if (!isOrganizer && !d.poolsReleasedAt) return false;
    return isOrganizer || d.pools.some((p) => p.matches.length > 0);
  });

  const defaultDivisionId =
    (initialDivisionId &&
      eligibleDivisions.some((d) => d.id === initialDivisionId) &&
      initialDivisionId) ||
    eligibleDivisions[0]?.id;

  const scheduleGroups = isOrganizer
    ? scheduleGroupsFromPlayData(eligibleDivisions, "pools")
    : [];

  return (
    <div className="space-y-6">
      {focusPoolId ? <ScrollToPool poolId={focusPoolId} /> : null}
      {isOrganizer && (
        <div
          className={
            scheduleGroups.length > 0 ? "grid gap-3 lg:grid-cols-2" : undefined
          }
        >
          <PoolMatchFormatPanel
            tournamentId={tournament.id}
            matchFormat={tournament.matchFormat}
            setStartingScore={tournament.setStartingScore}
            setTargetScore={tournament.setTargetScore}
            tiebreakTargetScore={tournament.tiebreakTargetScore}
            warmupFormat={tournament.warmupFormat}
            poolTiebreakCriteria={tournament.poolTiebreakCriteria}
          />
          {scheduleGroups.length > 0 && (
            <ScheduleMatchTimesSection
              tournamentId={tournament.id}
              tournamentDate={tournament.date}
              groups={scheduleGroups}
            />
          )}
        </div>
      )}
      {isOrganizer && poolAssignmentBlocked && (
        <p className="text-sm text-muted-foreground">{poolAssignmentBlocked}</p>
      )}
      {eligibleDivisions.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={isOrganizer ? "No pool play yet" : "Pools not released yet"}
          description={
            isOrganizer
              ? "Add pools in Settings › General. Play format was set when you created the tournament."
              : "The host hasn’t released pools for this tournament. Check back once they’re published."
          }
        />
      ) : (
        <Tabs defaultValue={defaultDivisionId} className="w-full gap-4">
          {eligibleDivisions.length > 1 && (
            <TabsList variant="line" className="max-w-full shrink-0">
              {eligibleDivisions.map((div) => (
                <TabsTrigger key={div.id} value={div.id}>
                  {div.name}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {eligibleDivisions.map((div) => (
            <TabsContent
              key={div.id}
              value={div.id}
              className="mt-0 space-y-4"
            >
              {isOrganizer && (
                <DivisionPoolRelease
                  tournamentId={tournament.id}
                  divisionId={div.id}
                  divisionName={div.name}
                  poolsReleasedAt={div.poolsReleasedAt}
                  matchCount={div.pools.reduce(
                    (n, p) => n + p.matches.length,
                    0
                  )}
                  completedMatchCount={div.pools.reduce(
                    (n, p) =>
                      n +
                      p.matches.filter((m) => m.status === "completed").length,
                    0
                  )}
                />
              )}
              {div.pools.length === 0 ||
              div.pools.every((p) => p.teams.length === 0) ? (
                <EmptyState
                  icon={Users}
                  title="No teams in this pool yet"
                  description={
                    isOrganizer
                      ? "Assign confirmed teams to this pool from Teams."
                      : "Teams will appear here once the host assigns them."
                  }
                />
              ) : (
                <div className="space-y-4">
                  {div.pools.map((pool) => (
                    <div
                      key={pool.id}
                      id={`pool-${pool.id}`}
                      className="scroll-mt-4 space-y-4"
                    >
                      {isOrganizer && div.format === "pool_to_bracket" && (
                        <PoolSeedingPanel
                          key={`${pool.id}-${pool.teams.map((t) => t.id).join(",")}`}
                          tournamentId={tournament.id}
                          poolId={pool.id}
                          poolName={pool.name}
                          teams={pool.teams}
                          canEdit={canAssignPools}
                          matchesStarted={
                            poolMatchesStartedByPoolId.get(pool.id) ?? false
                          }
                        />
                      )}
                      {pool.matches.length > 0 ? (
                        <PoolView
                          tournamentId={tournament.id}
                          slug={tournament.slug}
                          tournamentDate={tournament.date}
                          pool={pool}
                          canEditRefs={isOrganizer}
                          canEditSchedule={isOrganizer}
                          tiebreakCriteria={tournament.poolTiebreakCriteria}
                        />
                      ) : isOrganizer && div.format === "pool_to_bracket" ? (
                        <p className="text-sm text-muted-foreground">
                          Save seeding to create pool matches.
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
