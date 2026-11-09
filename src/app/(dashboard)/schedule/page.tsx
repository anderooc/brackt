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

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { matches, tournaments } from "@/lib/db/schema";
import { eq, isNotNull, asc } from "drizzle-orm";
import { PageHeader } from "@/components/layout/page-header";
import { redirect } from "next/navigation";
import { ScheduleControls } from "./schedule-controls";
import {
  ScheduleMatchList,
  type ScheduleMatchListItem,
} from "./schedule-match-list";
import { enrichScheduledMatches } from "@/lib/schedule/enrich-scheduled-matches";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("All matches");

export default async function SchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [scheduledMatches, userTournaments] = await Promise.all([
    db
      .select()
      .from(matches)
      .where(isNotNull(matches.scheduledTime))
      .orderBy(asc(matches.scheduledTime)),
    db
      .select({ id: tournaments.id, name: tournaments.name })
      .from(tournaments)
      .where(eq(tournaments.organizerId, user.id)),
  ]);

  const enrichedMatches = await enrichScheduledMatches(scheduledMatches);

  const listItems: ScheduleMatchListItem[] = enrichedMatches.map((match) => ({
    id: match.id,
    status: match.status,
    scheduledTime: match.scheduledTime?.toISOString() ?? null,
    warmupStart: match.warmupStart?.toISOString() ?? null,
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    courtName: match.courtName,
    refTeamName: match.refTeamName,
    contextLabel: match.contextLabel,
    gender: match.gender,
    region: match.region,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="All matches"
        description="View all scheduled matches across tournaments."
      />

      {userTournaments.length > 0 ? (
        <ScheduleControls tournaments={userTournaments} />
      ) : null}

      <ScheduleMatchList matches={listItems} />
    </div>
  );
}
