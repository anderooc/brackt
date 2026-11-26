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

import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { teamMembers, teams } from "@/lib/db/schema";

/** Accepts the root db client or a transaction handle. */
type DbExecutor = Pick<typeof db, "select" | "delete" | "update">;

/**
 * School roster is the source of truth for school-linked teams. When a user
 * leaves or is removed from a school, drop them from every team under that
 * school so they cannot keep tournament seats without school membership.
 *
 * If they were the sole captain on a team that still has players, promote the
 * longest-tenured remaining player to captain before removing them.
 */
export async function removeUserFromSchoolTeams(
  schoolId: string,
  userId: string,
  database: DbExecutor = db
): Promise<string[]> {
  const schoolTeams = await database
    .select({ id: teams.id, slug: teams.slug })
    .from(teams)
    .where(eq(teams.schoolId, schoolId));

  if (schoolTeams.length === 0) return [];

  const teamIds = schoolTeams.map((t) => t.id);

  const captaincies = await database
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.role, "captain"),
        inArray(teamMembers.teamId, teamIds)
      )
    );

  for (const { teamId } of captaincies) {
    await promoteReplacementCaptain(database, teamId, userId);
  }

  await database
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.userId, userId), inArray(teamMembers.teamId, teamIds))
    );

  return schoolTeams.map((t) => t.slug);
}

async function promoteReplacementCaptain(
  database: DbExecutor,
  teamId: string,
  departingUserId: string
): Promise<void> {
  const otherCaptains = await database
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.role, "captain"),
        ne(teamMembers.userId, departingUserId)
      )
    )
    .limit(1);

  if (otherCaptains.length > 0) return;

  const [replacement] = await database
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        ne(teamMembers.userId, departingUserId)
      )
    )
    .orderBy(asc(teamMembers.createdAt))
    .limit(1);

  if (!replacement) return;

  await database
    .update(teamMembers)
    .set({ role: "captain" })
    .where(eq(teamMembers.id, replacement.id));
}
