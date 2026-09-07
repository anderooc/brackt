"use server";

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

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  schoolMembers,
  schools,
  teams,
  teamMembers,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser, isAdmin } from "@/lib/auth";
import { createTeamSchema } from "@/lib/validators";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { isSchoolOfficerOrAbove } from "@/lib/schools/permissions";
import { parseVolleyballPositionInput } from "@/lib/profile/volleyball-position";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import {
  deleteTeamWithTournamentLocks,
  type TeamDeletionTeam,
} from "@/lib/teams/team-deletion";
import {
  bulkImportTeamRosterInternal,
  type BulkImportRowInput,
} from "@/lib/api/queries/roster-bulk-import";
import {
  JERSEY_NUMBER_RANGE_ERROR,
  jerseyCollisionError,
  parseJerseyNumber,
} from "@/lib/profile/jersey-number";
import { createTeamMemberInvite } from "@/lib/invites/member-invites";
import {
  assignUserJerseyNumber,
  jerseyTakenOnTeam,
  revalidateJerseyPaths,
} from "@/lib/profile/jersey-number-store";
import type { SchoolMemberRole } from "@/types";

/**
 * Returns the user's school role, or null if not a member. Used to gate
 * captain-equivalent actions on teams attached to a school.
 */
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

export async function createTeam(formData: FormData) {
  const user = await requireUser();

  const rawSchoolId = formData.get("schoolId");
  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    gender: formData.get("gender"),
    region: formData.get("region"),
    schoolId:
      typeof rawSchoolId === "string" && rawSchoolId.length > 0
        ? rawSchoolId
        : undefined,
    university: (formData.get("university") as string) || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  let teamGender = parsed.data.gender;
  let teamRegion = parsed.data.region;
  let teamUniversity: string | null = null;

  if (parsed.data.schoolId) {
    const role = await getSchoolRole(parsed.data.schoolId, user.id);
    const allowed =
      isAdmin(user) || role === "president" || role === "officer";
    if (!allowed) {
      return {
        error:
          "Only school presidents or officers can create teams under a school.",
      };
    }

    const [parentSchool] = await db
      .select({
        gender: schools.gender,
        region: schools.region,
        university: schools.university,
      })
      .from(schools)
      .where(eq(schools.id, parsed.data.schoolId))
      .limit(1);
    if (!parentSchool) {
      return { error: "Selected school no longer exists." };
    }
    teamGender = parentSchool.gender;
    teamRegion = parentSchool.region;
    teamUniversity = parentSchool.university;
  } else {
    teamUniversity = parsed.data.university?.trim() ?? "";
    if (!teamUniversity) {
      return { error: "University is required for standalone teams." };
    }
  }

  const teamContentError = await flagBlockedContent(user.id, [
    { area: "team.name", text: parsed.data.name },
    { area: "team.university", text: teamUniversity },
  ]);
  if (teamContentError) return { error: teamContentError };

  const [existing] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(
      and(
        eq(teams.name, parsed.data.name),
        eq(teams.university, teamUniversity),
        eq(teams.gender, teamGender)
      )
    )
    .limit(1);

  if (existing) {
    return {
      error:
        "A team with this name, university, and gender already exists",
    };
  }

  const base = slugify(`${parsed.data.name} ${teamUniversity}`, "team");
  const existingSlugs = await db.select({ slug: teams.slug }).from(teams);
  const slug = uniqueSlug(
    base,
    existingSlugs.map((t) => t.slug)
  );

  const [team] = await db
    .insert(teams)
    .values({
      name: parsed.data.name,
      slug,
      university: teamUniversity,
      gender: teamGender,
      region: teamRegion,
      schoolId: parsed.data.schoolId ?? null,
      verificationStatus: parsed.data.schoolId ? "verified" : "pending",
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: user.id,
    role: "captain",
    jerseyNumber: user.jerseyNumber,
  });

  // Promote user to captain role if currently player
  if (user.role === "player") {
    await db
      .update(users)
      .set({ role: "captain" })
      .where(eq(users.id, user.id));
  }

  redirect(`/teams/${team.slug}`);
}

export async function addTeamMember(teamId: string, formData: FormData) {
  const user = await requireUser();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  if (!email) return { error: "Email is required" };

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return { error: "Team not found" };

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id))
    );

  const isCaptain = membership?.role === "captain";
  let canManage: boolean = isAdmin(user) || isCaptain;

  // School officers/presidents can manage rosters of teams under their school
  // even if they're not a team captain themselves.
  if (!canManage && team.schoolId) {
    const role = await getSchoolRole(team.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: team.schoolId, userId: user.id, role } : null
    );
  }

  if (!canManage) {
    return { error: "Only captains or school officers can add members" };
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser) {
    const invite = await createTeamMemberInvite({
      teamId,
      email,
      invitedByUserId: user.id,
      teamName: team.name,
      inviterName: user.fullName,
    });
    if ("error" in invite) return { error: invite.error };
    revalidatePath(`/teams/${team.slug}`);
    return { success: true, invited: true };
  }

  // When the team belongs to a school, the new player must already be on the
  // school's master roster. This keeps the school as the source of truth.
  let schoolSlug: string | null = null;
  if (team.schoolId) {
    const [schoolRow] = await db
      .select({ slug: schools.slug })
      .from(schools)
      .where(eq(schools.id, team.schoolId))
      .limit(1);
    schoolSlug = schoolRow?.slug ?? null;

    const targetRole = await getSchoolRole(team.schoolId, targetUser.id);
    if (!targetRole) {
      return {
        error: schoolSlug
          ? `Add this user to the school roster first at /schools/${schoolSlug}`
          : "User must be on the school roster first.",
      };
    }
  }

  const [existing] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        eq(teamMembers.userId, targetUser.id)
      )
    );

  if (existing) {
    return { error: "User is already on this team" };
  }

  const jerseyRaw = formData.get("jerseyNumber");
  const parsedJersey = parseJerseyNumber(
    typeof jerseyRaw === "string" ? jerseyRaw : ""
  );
  if (parsedJersey === "invalid") {
    return { error: JERSEY_NUMBER_RANGE_ERROR };
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
      extraTeamId: teamId,
    });
    if ("error" in assigned) return { error: assigned.error };
    revalidateJerseyPaths(assigned);
  } else if (jerseyNumber !== null) {
    const taken = await jerseyTakenOnTeam(
      db,
      teamId,
      jerseyNumber,
      targetUser.id
    );
    if (taken) {
      return { error: jerseyCollisionError("team", jerseyNumber) };
    }
  }

  try {
    await db.insert(teamMembers).values({
      teamId,
      userId: targetUser.id,
      role: "player",
      jerseyNumber,
    });
  } catch {
    return { error: "Could not add this player to the roster. Try again." };
  }

  revalidatePath(`/teams/${team.slug}`);
  if (schoolSlug) revalidatePath(`/schools/${schoolSlug}`);
  return { success: true };
}

export async function removeTeamMember(teamId: string, memberId: string) {
  const user = await requireUser();

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return { error: "Team not found" };

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, user.id))
    );

  let canManage: boolean =
    isAdmin(user) || membership?.role === "captain";

  if (!canManage && team.schoolId) {
    const role = await getSchoolRole(team.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: team.schoolId, userId: user.id, role } : null
    );
  }

  if (!canManage) {
    return { error: "Only captains or school officers can remove members" };
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  revalidatePath("/teams/[slug]", "page");
  return { success: true };
}

async function currentActorCanDeleteTeam(
  tx: typeof db,
  team: TeamDeletionTeam,
  actorId: string
): Promise<boolean> {
  const [actor] = await tx.select({ role: users.role, disabledAt: users.disabledAt })
    .from(users).where(eq(users.id, actorId)).for("share").limit(1);
  if (!actor || actor.disabledAt) return false;
  if (actor.role === "admin") return true;
  const [membership] = await tx.select({ role: teamMembers.role })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, actorId)))
    .for("share").limit(1);
  if (membership?.role === "captain") return true;
  if (!team.schoolId) return false;
  const [schoolRole] = await tx.select({ role: schoolMembers.role })
    .from(schoolMembers)
    .where(and(
      eq(schoolMembers.schoolId, team.schoolId),
      eq(schoolMembers.userId, actorId)
    )).for("share").limit(1);
  return schoolRole?.role === "president" || schoolRole?.role === "officer";
}

export async function deleteTeam(teamId: string, confirmationName: string) {
  const user = await requireUser();
  let result: Awaited<ReturnType<typeof deleteTeamWithTournamentLocks>>;
  try {
    result = await deleteTeamWithTournamentLocks({
      teamId,
      confirmationName,
      authorize: async (tx, team) => await currentActorCanDeleteTeam(
        tx,
        team,
        user.id
      ) ? null : "Only team captains or school officers can delete this team",
      afterCommit: async (parents) => {
        await invalidatePublicTournamentCachesByIds(
          parents.map((parent) => parent.id),
          { listing: true }
        );
      },
    });
  } catch {
    return { error: "Could not delete team. Try again." };
  }
  if (!result.ok) return { error: result.error };
  revalidatePath("/teams");
  revalidatePath("/admin");
  return { success: true as const };
}

export async function updateJerseyNumber(
  memberId: string,
  jerseyNumber: number | null
) {
  const user = await requireUser();
  if (
    jerseyNumber !== null &&
    (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)
  ) {
    return { error: JERSEY_NUMBER_RANGE_ERROR };
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
    .where(eq(teamMembers.id, memberId))
    .limit(1);
  if (!row) return { error: "Member not found" };

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, user.id))
    );
  let canManage: boolean = isAdmin(user) || membership?.role === "captain";
  if (!canManage && row.schoolId) {
    const role = await getSchoolRole(row.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: row.schoolId, userId: user.id, role } : null
    );
  }
  if (!canManage) {
    return { error: "Only captains or school officers can edit jersey numbers" };
  }

  const assigned = await assignUserJerseyNumber(db, {
    userId: row.userId,
    jerseyNumber,
  });
  if ("error" in assigned) return { error: assigned.error };
  revalidateJerseyPaths(assigned);
  return { success: true };
}

export async function updateUserJerseyNumber(
  userId: string,
  jerseyNumber: number | null
) {
  const actor = await requireUser();
  if (
    jerseyNumber !== null &&
    (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)
  ) {
    return { error: JERSEY_NUMBER_RANGE_ERROR };
  }

  const [targetSchool] = await db
    .select({
      schoolId: schoolMembers.schoolId,
    })
    .from(schoolMembers)
    .where(eq(schoolMembers.userId, userId))
    .limit(1);
  if (!targetSchool) {
    return { error: "Member not found" };
  }

  let canManage = isAdmin(actor);
  if (!canManage) {
    const role = await getSchoolRole(targetSchool.schoolId, actor.id);
    canManage = isSchoolOfficerOrAbove(
      role
        ? { schoolId: targetSchool.schoolId, userId: actor.id, role }
        : null
    );
  }
  if (!canManage) {
    return { error: "Only captains or school officers can edit jersey numbers" };
  }

  const assigned = await assignUserJerseyNumber(db, {
    userId,
    jerseyNumber,
  });
  if ("error" in assigned) return { error: assigned.error };
  revalidateJerseyPaths(assigned);
  return { success: true };
}

export async function updateTeamMemberVolleyballPosition(
  memberId: string,
  volleyballPosition: string | null
) {
  const user = await requireUser();
  const parsed = parseVolleyballPositionInput(volleyballPosition);
  if (parsed === "invalid") {
    return { error: "Invalid volleyball position." };
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
    .where(eq(teamMembers.id, memberId))
    .limit(1);
  if (!row) return { error: "Member not found" };

  const [membership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, row.teamId), eq(teamMembers.userId, user.id))
    );
  let canManage: boolean = isAdmin(user) || membership?.role === "captain";
  if (!canManage && row.schoolId) {
    const role = await getSchoolRole(row.schoolId, user.id);
    canManage = isSchoolOfficerOrAbove(
      role ? { schoolId: row.schoolId, userId: user.id, role } : null
    );
  }
  if (!canManage) {
    return {
      error: "Only captains or school officers can edit volleyball positions",
    };
  }

  await db
    .update(users)
    .set({ volleyballPosition: parsed, updatedAt: new Date() })
    .where(eq(users.id, row.userId));

  revalidatePath(`/teams/${row.slug}`);
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  if (row.schoolId) {
    const [schoolRow] = await db
      .select({ slug: schools.slug })
      .from(schools)
      .where(eq(schools.id, row.schoolId))
      .limit(1);
    if (schoolRow) revalidatePath(`/schools/${schoolRow.slug}`);
  }
  return { success: true };
}

export async function bulkImportTeamRosterAction(
  teamId: string,
  rows: BulkImportRowInput[]
) {
  const user = await requireUser();
  const result = await bulkImportTeamRosterInternal(teamId, user, rows);
  if (result.success && result.targetSlug) {
    revalidatePath(`/teams/${result.targetSlug}`);
    revalidatePath("/notifications");
  }
  return result;
}

