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

import { and, eq, inArray } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  schoolJoinRequests,
  schoolMembers,
  schools,
  teamMembers,
  teams,
  users,
} from "@/lib/db/schema";
import {
  canManageSchoolRoster,
  isSchoolOfficerOrAbove,
} from "@/lib/schools/permissions";
import {
  createSchoolMemberInvite,
  createTeamMemberInvite,
} from "@/lib/invites/member-invites";
import {
  assignUserJerseyNumber,
  releaseJerseyIfSchoolConflict,
} from "@/lib/profile/jersey-number-store";
import { isValidEmail } from "@/lib/roster/bulk-import-parser";
import type { SchoolMemberRole, VolleyballPosition } from "@/types";

export type BulkImportRowInput = {
  email: string;
  fullName?: string | null;
  jerseyNumber?: number | null;
  volleyballPosition?: VolleyballPosition | null;
  role?: string;
  title?: string | null;
};

export type BulkImportRowStatus = "added" | "invited" | "skipped" | "failed";

export type BulkImportRowResult = {
  email: string;
  fullName?: string | null;
  status: BulkImportRowStatus;
  message: string;
  jerseyAssigned?: number | null;
};

export type BulkImportSummaryResult = {
  success: boolean;
  targetSlug: string;
  totalCount: number;
  addedCount: number;
  invitedCount: number;
  skippedCount: number;
  failedCount: number;
  results: BulkImportRowResult[];
  error?: string;
};

async function findExistingSchoolSlugForUser(
  userId: string
): Promise<string | null> {
  const [existing] = await db
    .select({ slug: schools.slug })
    .from(schoolMembers)
    .innerJoin(schools, eq(schoolMembers.schoolId, schools.id))
    .where(eq(schoolMembers.userId, userId))
    .limit(1);

  return existing?.slug ?? null;
}

/**
 * Bulk import multiple roster members into a school's master roster.
 * Adds existing users directly or sends invites to users not yet on brackt.
 */
export async function bulkImportSchoolRosterInternal(
  schoolId: string,
  actor: AppUser,
  rows: BulkImportRowInput[]
): Promise<BulkImportSummaryResult> {
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);

  if (!school) {
    return {
      success: false,
      targetSlug: "",
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: "School not found.",
    };
  }

  const [actorMembership] = await db
    .select({
      schoolId: schoolMembers.schoolId,
      userId: schoolMembers.userId,
      role: schoolMembers.role,
    })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, actor.id)
      )
    )
    .limit(1);

  const canManage = canManageSchoolRoster(actorMembership ?? null, actor);
  if (!canManage) {
    return {
      success: false,
      targetSlug: school.slug,
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: "Only school officers or admins can manage the school roster.",
    };
  }

  // Deduplicate input rows by email preserving first occurrence
  const uniqueRows: BulkImportRowInput[] = [];
  const seenEmails = new Set<string>();

  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    uniqueRows.push({ ...r, email });
  }

  if (uniqueRows.length === 0) {
    return {
      success: true,
      targetSlug: school.slug,
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const emails = uniqueRows.map((r) => r.email);

  // Load existing users matching these emails
  const matchedUsers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      jerseyNumber: users.jerseyNumber,
      volleyballPosition: users.volleyballPosition,
    })
    .from(users)
    .where(inArray(users.email, emails));

  const userByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u]));

  // Load existing school members
  const existingMembers = await db
    .select({ userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(eq(schoolMembers.schoolId, schoolId));

  const existingMemberIds = new Set(existingMembers.map((m) => m.userId));

  const results: BulkImportRowResult[] = [];
  let addedCount = 0;
  let invitedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of uniqueRows) {
    const targetUser = userByEmail.get(row.email);

    if (!targetUser) {
      // User is not on brackt yet -> send school invite email
      const inviteRole =
        row.role === "officer" ? "officer" : "member";

      const inviteResult = await createSchoolMemberInvite({
        schoolId,
        email: row.email,
        role: inviteRole,
        title: row.title ?? null,
        invitedByUserId: actor.id,
        schoolName: school.name,
        inviterName: actor.fullName,
      });

      if ("error" in inviteResult) {
        skippedCount++;
        results.push({
          email: row.email,
          fullName: row.fullName ?? null,
          status: "skipped",
          message: inviteResult.error,
        });
      } else {
        invitedCount++;
        results.push({
          email: row.email,
          fullName: row.fullName ?? null,
          status: "invited",
          message: "Invite email sent",
        });
      }
      continue;
    }

    // User exists on brackt
    if (existingMemberIds.has(targetUser.id)) {
      skippedCount++;
      results.push({
        email: row.email,
        fullName: targetUser.fullName || row.fullName || null,
        status: "skipped",
        message: "Already on this school roster",
      });
      continue;
    }

    // Check if user belongs to another school
    const otherSchoolSlug = await findExistingSchoolSlugForUser(targetUser.id);
    if (otherSchoolSlug && otherSchoolSlug !== school.slug) {
      failedCount++;
      results.push({
        email: row.email,
        fullName: targetUser.fullName || row.fullName || null,
        status: "failed",
        message: `Already a member of /schools/${otherSchoolSlug}`,
      });
      continue;
    }

    // Release any previous jersey conflict
    await releaseJerseyIfSchoolConflict(db, schoolId, targetUser.id);

    // Insert into schoolMembers
    const memberRole: SchoolMemberRole =
      row.role === "officer" ? "officer" : "member";

    try {
      await db.insert(schoolMembers).values({
        schoolId,
        userId: targetUser.id,
        role: memberRole,
        title: row.title ?? null,
      });

      existingMemberIds.add(targetUser.id);
    } catch {
      failedCount++;
      results.push({
        email: row.email,
        fullName: targetUser.fullName,
        status: "failed",
        message: "Could not add to school members table",
      });
      continue;
    }

    // Update volleyball position if provided and user does not have one
    if (row.volleyballPosition && !targetUser.volleyballPosition) {
      await db
        .update(users)
        .set({
          volleyballPosition: row.volleyballPosition,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));
    }

    // Assign jersey number if provided
    let jerseyAssigned: number | null = targetUser.jerseyNumber;
    if (row.jerseyNumber !== undefined && row.jerseyNumber !== null) {
      const assigned = await assignUserJerseyNumber(db, {
        userId: targetUser.id,
        jerseyNumber: row.jerseyNumber,
      });
      if ("ok" in assigned && assigned.ok) {
        jerseyAssigned = row.jerseyNumber;
      }
    }

    // Resolve any pending join requests for this school & user
    await db
      .update(schoolJoinRequests)
      .set({
        status: "approved",
        resolvedAt: new Date(),
        resolvedByUserId: actor.id,
      })
      .where(
        and(
          eq(schoolJoinRequests.schoolId, schoolId),
          eq(schoolJoinRequests.userId, targetUser.id),
          eq(schoolJoinRequests.status, "pending")
        )
      );

    addedCount++;
    results.push({
      email: row.email,
      fullName: targetUser.fullName,
      status: "added",
      message: "Added to school roster",
      jerseyAssigned,
    });
  }

  return {
    success: true,
    targetSlug: school.slug,
    totalCount: uniqueRows.length,
    addedCount,
    invitedCount,
    skippedCount,
    failedCount,
    results,
  };
}

/**
 * Bulk import players into a team's roster.
 * If team belongs to a school and actor is an officer, players missing from
 * the school master roster can be auto-enrolled on the school roster.
 */
export async function bulkImportTeamRosterInternal(
  teamId: string,
  actor: AppUser,
  rows: BulkImportRowInput[]
): Promise<BulkImportSummaryResult> {
  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) {
    return {
      success: false,
      targetSlug: "",
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: "Team not found.",
    };
  }

  // Check team captaincy or admin
  const [myTeamMembership] = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, actor.id))
    )
    .limit(1);

  let canManage = myTeamMembership?.role === "captain" || isAdmin(actor);

  // Check school officer permission
  let actorCanManageSchool = false;
  let schoolSlug: string | null = null;

  if (team.schoolId) {
    const [schoolRow] = await db
      .select({ slug: schools.slug })
      .from(schools)
      .where(eq(schools.id, team.schoolId))
      .limit(1);
    schoolSlug = schoolRow?.slug ?? null;

    const [mySchoolRole] = await db
      .select({ role: schoolMembers.role })
      .from(schoolMembers)
      .where(
        and(
          eq(schoolMembers.schoolId, team.schoolId),
          eq(schoolMembers.userId, actor.id)
        )
      )
      .limit(1);

    actorCanManageSchool = isSchoolOfficerOrAbove(
      mySchoolRole
        ? { schoolId: team.schoolId, userId: actor.id, role: mySchoolRole.role }
        : null
    );

    if (actorCanManageSchool) {
      canManage = true;
    }
  }

  if (!canManage) {
    return {
      success: false,
      targetSlug: team.slug,
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
      error: "Only captains or school officers can manage this team roster.",
    };
  }

  // Deduplicate input rows by email
  const uniqueRows: BulkImportRowInput[] = [];
  const seenEmails = new Set<string>();

  for (const r of rows) {
    const email = r.email.trim().toLowerCase();
    if (!email || !isValidEmail(email)) continue;
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    uniqueRows.push({ ...r, email });
  }

  if (uniqueRows.length === 0) {
    return {
      success: true,
      targetSlug: team.slug,
      totalCount: 0,
      addedCount: 0,
      invitedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      results: [],
    };
  }

  const emails = uniqueRows.map((r) => r.email);

  // Match existing users
  const matchedUsers = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      jerseyNumber: users.jerseyNumber,
      volleyballPosition: users.volleyballPosition,
    })
    .from(users)
    .where(inArray(users.email, emails));

  const userByEmail = new Map(matchedUsers.map((u) => [u.email.toLowerCase(), u]));

  // Load current team members and occupied jerseys
  const currentTeamMembers = await db
    .select({
      userId: teamMembers.userId,
      jerseyNumber: teamMembers.jerseyNumber,
    })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));

  const teamMemberUserIds = new Set(currentTeamMembers.map((m) => m.userId));
  const occupiedTeamJerseys = new Set(
    currentTeamMembers
      .map((m) => m.jerseyNumber)
      .filter((n): n is number => n !== null)
  );

  // Load school members if team belongs to a school
  const schoolMemberUserIds = new Set<string>();
  if (team.schoolId) {
    const schoolMembersList = await db
      .select({ userId: schoolMembers.userId })
      .from(schoolMembers)
      .where(eq(schoolMembers.schoolId, team.schoolId));

    for (const sm of schoolMembersList) {
      schoolMemberUserIds.add(sm.userId);
    }
  }

  const results: BulkImportRowResult[] = [];
  let addedCount = 0;
  let invitedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of uniqueRows) {
    const targetUser = userByEmail.get(row.email);

    if (!targetUser) {
      // User is not on brackt -> send invite
      if (team.schoolId && !actorCanManageSchool) {
        failedCount++;
        results.push({
          email: row.email,
          fullName: row.fullName ?? null,
          status: "failed",
          message: schoolSlug
            ? `Player must join school roster first at /schools/${schoolSlug}`
            : "Player must be on the school roster first.",
        });
        continue;
      }

      // If team belongs to school and actor can manage school, create school invite too
      if (team.schoolId && actorCanManageSchool) {
        await createSchoolMemberInvite({
          schoolId: team.schoolId,
          email: row.email,
          role: "member",
          invitedByUserId: actor.id,
          schoolName: team.name,
          inviterName: actor.fullName,
        });
      }

      const inviteResult = await createTeamMemberInvite({
        teamId,
        email: row.email,
        invitedByUserId: actor.id,
        teamName: team.name,
        inviterName: actor.fullName,
      });

      if ("error" in inviteResult) {
        skippedCount++;
        results.push({
          email: row.email,
          fullName: row.fullName ?? null,
          status: "skipped",
          message: inviteResult.error,
        });
      } else {
        invitedCount++;
        results.push({
          email: row.email,
          fullName: row.fullName ?? null,
          status: "invited",
          message: "Team invite email sent",
        });
      }
      continue;
    }

    // User exists on brackt
    if (teamMemberUserIds.has(targetUser.id)) {
      skippedCount++;
      results.push({
        email: row.email,
        fullName: targetUser.fullName,
        status: "skipped",
        message: "Already on this team roster",
      });
      continue;
    }

    // If school team, verify / add to school master roster
    if (team.schoolId && !schoolMemberUserIds.has(targetUser.id)) {
      if (!actorCanManageSchool) {
        failedCount++;
        results.push({
          email: row.email,
          fullName: targetUser.fullName,
          status: "failed",
          message: schoolSlug
            ? `Player must join school roster first at /schools/${schoolSlug}`
            : "User must be on the school roster first.",
        });
        continue;
      }

      // Auto-enroll on school master roster
      const otherSchoolSlug = await findExistingSchoolSlugForUser(targetUser.id);
      if (otherSchoolSlug && otherSchoolSlug !== schoolSlug) {
        failedCount++;
        results.push({
          email: row.email,
          fullName: targetUser.fullName,
          status: "failed",
          message: `Already a member of /schools/${otherSchoolSlug}`,
        });
        continue;
      }

      await releaseJerseyIfSchoolConflict(db, team.schoolId, targetUser.id);
      await db.insert(schoolMembers).values({
        schoolId: team.schoolId,
        userId: targetUser.id,
        role: "member",
      });
      schoolMemberUserIds.add(targetUser.id);
    }

    // Resolve jersey number
    let jerseyToAssign =
      row.jerseyNumber !== undefined && row.jerseyNumber !== null
        ? row.jerseyNumber
        : targetUser.jerseyNumber;

    if (jerseyToAssign !== null && occupiedTeamJerseys.has(jerseyToAssign)) {
      jerseyToAssign = null;
    }

    const memberRole = row.role === "captain" ? "captain" : "player";

    try {
      await db.insert(teamMembers).values({
        teamId,
        userId: targetUser.id,
        role: memberRole,
        jerseyNumber: jerseyToAssign,
      });

      teamMemberUserIds.add(targetUser.id);
      if (jerseyToAssign !== null) {
        occupiedTeamJerseys.add(jerseyToAssign);
      }
    } catch {
      failedCount++;
      results.push({
        email: row.email,
        fullName: targetUser.fullName,
        status: "failed",
        message: "Could not add player to team roster",
      });
      continue;
    }

    // Update position if provided and user doesn't have one
    if (row.volleyballPosition && !targetUser.volleyballPosition) {
      await db
        .update(users)
        .set({
          volleyballPosition: row.volleyballPosition,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUser.id));
    }

    addedCount++;
    results.push({
      email: row.email,
      fullName: targetUser.fullName,
      status: "added",
      message:
        jerseyToAssign !== null
          ? `Added to roster (Jersey #${jerseyToAssign})`
          : "Added to roster",
      jerseyAssigned: jerseyToAssign,
    });
  }

  return {
    success: true,
    targetSlug: team.slug,
    totalCount: uniqueRows.length,
    addedCount,
    invitedCount,
    skippedCount,
    failedCount,
    results,
  };
}
