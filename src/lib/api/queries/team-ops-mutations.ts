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

import { and, eq, sql } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  schoolMembers,
  schools,
  teamMembers,
  teams,
  users,
} from "@/lib/db/schema";
import {
  JERSEY_NUMBER_RANGE_ERROR,
  jerseyCollisionError,
  parseJerseyNumber,
} from "@/lib/profile/jersey-number";
import {
  assignUserJerseyNumber,
  jerseyTakenOnTeam,
} from "@/lib/profile/jersey-number-store";
import { isSchoolOfficerOrAbove } from "@/lib/schools/permissions";
import { parseVolleyballPositionInput } from "@/lib/profile/volleyball-position";
import type { SchoolMemberRole } from "@/types";
import type { TeamMutationResultContract } from "../contracts/team";
import { badRequest, forbidden, notFound } from "../errors";

async function getSchoolRole(
  schoolId: string,
  userId: string
): Promise<SchoolMemberRole | null> {
  const [row] = await db
    .select({ role: schoolMembers.role })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId)
      )
    )
    .limit(1);
  return row?.role ?? null;
}

async function requireTeamManager(slug: string, user: AppUser) {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.slug, slug))
    .limit(1);
  if (!team) throw notFound("Team not found.");

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, user.id))
    )
    .limit(1);

  let canManage = isAdmin(user) || membership?.role === "captain";
  if (!canManage && team.schoolId) {
    const role = await getSchoolRole(team.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: team.schoolId, userId: user.id, role } : null
    );
  }

  if (!canManage) {
    throw forbidden("Only captains or school officers can manage this roster.");
  }

  return { team, membership };
}

export async function addTeamMemberForViewer(
  slug: string,
  user: AppUser,
  input: { email?: string; userId?: string; jerseyNumber?: string | null }
): Promise<TeamMutationResultContract> {
  const { team } = await requireTeamManager(slug, user);

  const email = input.email?.toLowerCase().trim() ?? "";
  const userId = input.userId?.trim() ?? "";

  if (!email && !userId) {
    throw badRequest("Provide an email or school roster member.");
  }
  if (email && userId) {
    throw badRequest("Provide either an email or a roster member, not both.");
  }

  const [targetUser] = email
    ? await db
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1)
    : await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

  if (!targetUser) {
    throw badRequest(
      email
        ? "No user found with that email"
        : "Selected school roster member was not found."
    );
  }

  if (team.schoolId) {
    const targetRole = await getSchoolRole(team.schoolId, targetUser.id);
    if (!targetRole) {
      const [schoolRow] = await db
        .select({ slug: schools.slug })
        .from(schools)
        .where(eq(schools.id, team.schoolId))
        .limit(1);
      throw badRequest(
        schoolRow
          ? `Add this user to the school roster first.`
          : "User must be on the school roster first."
      );
    }
  }

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, team.id),
        eq(teamMembers.userId, targetUser.id)
      )
    )
    .limit(1);
  if (existing) {
    throw badRequest("User is already on this team");
  }

  const jerseyRaw = input.jerseyNumber ?? "";
  const parsedJersey = parseJerseyNumber(
    typeof jerseyRaw === "string" ? jerseyRaw : ""
  );
  if (parsedJersey === "invalid") {
    throw badRequest(JERSEY_NUMBER_RANGE_ERROR);
  }

  const hasExplicitJersey =
    typeof jerseyRaw === "string" && jerseyRaw.trim() !== "";
  const jerseyNumber = hasExplicitJersey
    ? parsedJersey
    : targetUser.jerseyNumber;

  if (hasExplicitJersey) {
    const assigned = await assignUserJerseyNumber(db, {
      userId: targetUser.id,
      jerseyNumber: parsedJersey,
      extraTeamId: team.id,
    });
    if ("error" in assigned) throw badRequest(assigned.error);
  } else if (jerseyNumber !== null) {
    const taken = await jerseyTakenOnTeam(
      db,
      team.id,
      jerseyNumber,
      targetUser.id
    );
    if (taken) {
      throw badRequest(jerseyCollisionError("team", jerseyNumber));
    }
  }

  try {
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: targetUser.id,
      role: "player",
      jerseyNumber,
    });
  } catch {
    throw badRequest("Could not add this player to the roster. Try again.");
  }

  return { success: true };
}

export async function removeTeamMemberForViewer(
  slug: string,
  membershipId: string,
  user: AppUser
): Promise<TeamMutationResultContract> {
  const { team } = await requireTeamManager(slug, user);

  const [target] = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.id, membershipId))
    .limit(1);

  if (!target || target.teamId !== team.id) {
    throw notFound("Member not found.");
  }
  if (target.role === "captain") {
    throw badRequest("Captains cannot be removed from the roster.");
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, membershipId));
  return { success: true };
}

export async function updateTeamMemberJerseyForViewer(
  slug: string,
  membershipId: string,
  user: AppUser,
  jerseyNumber: number | null
): Promise<TeamMutationResultContract> {
  await requireTeamManager(slug, user);

  if (
    jerseyNumber !== null &&
    (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)
  ) {
    throw badRequest(JERSEY_NUMBER_RANGE_ERROR);
  }

  const [row] = await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      teamId: teams.id,
      slug: teams.slug,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.id, membershipId))
    .limit(1);

  if (!row || row.slug !== slug) {
    throw notFound("Member not found.");
  }

  const assigned = await assignUserJerseyNumber(db, {
    userId: row.userId,
    jerseyNumber,
  });
  if ("error" in assigned) throw badRequest(assigned.error);

  return { success: true };
}

export async function updateTeamMemberVolleyballPositionForViewer(
  slug: string,
  membershipId: string,
  user: AppUser,
  volleyballPosition: string | null
): Promise<TeamMutationResultContract> {
  const parsed = parseVolleyballPositionInput(volleyballPosition);
  if (parsed === "invalid") {
    throw badRequest("Invalid volleyball position.");
  }

  const [row] = await db
    .select({
      id: teamMembers.id,
      userId: teamMembers.userId,
      teamId: teams.id,
      slug: teams.slug,
      schoolId: teams.schoolId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.id, membershipId))
    .limit(1);

  if (!row || row.slug !== slug) {
    throw notFound("Member not found.");
  }

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, user.id))
    )
    .limit(1);

  let canManage = isAdmin(user) || membership?.role === "captain";
  if (!canManage && row.schoolId) {
    const role = await getSchoolRole(row.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: row.schoolId, userId: user.id, role } : null
    );
  }

  if (!canManage) {
    throw forbidden(
      "Only captains or school officers can edit volleyball positions."
    );
  }

  await db
    .update(users)
    .set({ volleyballPosition: parsed, updatedAt: new Date() })
    .where(eq(users.id, row.userId));

  return { success: true };
}
