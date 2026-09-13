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

import type { InferSelectModel } from "drizzle-orm";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { courts, registrations, teams, tournaments } from "@/lib/db/schema";
import {
  resolveIsTournamentOrganizer,
  type UserForPermissions,
} from "@/lib/tournaments/permissions";
import { scheduleGroupsFromPlayData } from "@/lib/utils/schedule-times-groups";
import { getDivisionPlayData } from "../brackets/data";
import { MatchBoard } from "../match-board";
import { ScheduleMatchTimesSection } from "../matches/schedule-match-times-section";

export async function TournamentMatchesPanel({
  tournament,
  user,
}: {
  tournament: InferSelectModel<typeof tournaments>;
  user: UserForPermissions;
}) {
  const isOrganizer = await resolveIsTournamentOrganizer(tournament, user);
  const [divisionPlayData, courtRows, refTeamRows] = await Promise.all([
    getDivisionPlayData(tournament.id, {
      forOrganizer: isOrganizer,
    }),
    isOrganizer
      ? db
          .select({ id: courts.id, name: courts.name })
          .from(courts)
          .where(eq(courts.tournamentId, tournament.id))
          .orderBy(asc(courts.name))
      : Promise.resolve([]),
    isOrganizer
      ? db
          .select({ id: teams.id, name: teams.name })
          .from(registrations)
          .innerJoin(teams, eq(registrations.teamId, teams.id))
          .where(eq(registrations.tournamentId, tournament.id))
          .orderBy(asc(teams.name))
      : Promise.resolve([]),
  ]);

  const scheduleGroups = isOrganizer
    ? scheduleGroupsFromPlayData(divisionPlayData, "all")
    : [];

  return (
    <div className="space-y-6">
      {isOrganizer && scheduleGroups.length > 0 && (
        <ScheduleMatchTimesSection
          tournamentId={tournament.id}
          tournamentDate={tournament.date}
          groups={scheduleGroups}
        />
      )}
      <MatchBoard
        slug={tournament.slug}
        tournamentId={tournament.id}
        divisions={divisionPlayData}
        courts={courtRows}
        refTeams={refTeamRows}
        isOrganizer={isOrganizer}
        settings={{
          format: tournament.matchFormat,
          targetScore: tournament.setTargetScore,
          tiebreakTargetScore: tournament.tiebreakTargetScore,
        }}
      />
    </div>
  );
}
