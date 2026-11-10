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

import { asc, eq } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";
import { getUserSchoolSummary } from "@/lib/schools/navigation";
import {
  getDashboardActivity,
  getDashboardTournaments,
} from "@/lib/tournaments/dashboard";
import { describeAttentionItem } from "@/lib/tournaments/dashboard-attention";
import type { DashboardContract } from "../contracts/dashboard";

const PAST_LIMIT = 8;

export async function loadDashboardForViewer(
  user: AppUser
): Promise<DashboardContract> {
  // Wrapped so the query runs once even though two consumers await it.
  const userTeamsPromise = Promise.resolve(
    db
      .select({
        teamId: teams.id,
        slug: teams.slug,
        name: teams.name,
        university: teams.university,
        gender: teams.gender,
        region: teams.region,
        role: teamMembers.role,
        jerseyNumber: teamMembers.jerseyNumber,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id))
      .orderBy(asc(teams.name))
  );

  const [userTeams, school, { allMyTournaments, activity }] = await Promise.all([
    userTeamsPromise,
    getUserSchoolSummary(user.id),
    Promise.all([getDashboardTournaments(user.id), userTeamsPromise]).then(
      async ([allMyTournaments, memberships]) => ({
        allMyTournaments,
        activity: await getDashboardActivity(
          user.id,
          allMyTournaments,
          memberships.map((m) => ({ teamId: m.teamId, role: m.role }))
        ),
      })
    ),
  ]);

  const upcoming = allMyTournaments.filter((t) => t.relation !== "past");
  const past = allMyTournaments.filter((t) => t.relation === "past");

  return {
    firstName: user.fullName.split(" ")[0] ?? user.fullName,
    school,
    stats: {
      teamCount: userTeams.length,
      upcomingCount: upcoming.length,
      pendingCount: upcoming.filter((t) => t.relation === "pending").length,
      pastCount: past.length,
    },
    teams: userTeams.map((team) => ({
      slug: team.slug,
      name: team.name,
      university: team.university,
      gender: team.gender,
      region: team.region,
      role: team.role,
      jerseyNumber: team.jerseyNumber,
    })),
    tournaments: [...upcoming, ...past.slice(0, PAST_LIMIT)].map((t) => ({
      slug: t.slug,
      name: t.name,
      date: t.date,
      location: t.location,
      status: t.status,
      relation: t.relation,
      teamName: t.teamName,
      divisionName: t.divisionName,
      registrationStatus: t.registrationStatus,
      isOrganizer: t.isOrganizer,
    })),
    attention: activity.attention.map((item) => {
      const copy = describeAttentionItem(item);
      return {
        key: item.key,
        kind: item.kind,
        target: copy.target,
        title: copy.title,
        detail: copy.detail,
        cta: copy.cta,
        tournament: {
          slug: item.tournament.slug,
          name: item.tournament.name,
          date: item.tournament.date,
        },
      };
    }),
    hosting: upcoming
      .filter((t) => t.isOrganizer)
      .map((t) => {
        const stats = activity.hosting.get(t.id);
        return {
          slug: t.slug,
          name: t.name,
          date: t.date,
          status: t.status,
          teamCount: stats?.teamCount ?? 0,
          pendingCount: stats?.pendingCount ?? 0,
          capacity: stats?.capacity ?? null,
          deadline: stats?.deadline?.toISOString() ?? null,
          deadlinePassed: stats?.deadlinePassed ?? false,
        };
      }),
  };
}
