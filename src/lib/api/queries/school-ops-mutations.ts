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
import { db } from "@/lib/db";
import {
  schoolJoinRequests,
  schoolMembers,
  schools,
  users,
} from "@/lib/db/schema";
import {
  notifyRequesterOfJoinUpdate,
} from "@/lib/notifications/school-events";
import {
  assignUserJerseyNumber,
  releaseJerseyIfSchoolConflict,
} from "@/lib/profile/jersey-number-store";
import { JERSEY_NUMBER_RANGE_ERROR } from "@/lib/profile/jersey-number";
import { parseVolleyballPositionInput } from "@/lib/profile/volleyball-position";
import {
  canManageSchoolRoster,
  canTransferPresidency,
  type CurrentSchoolMembership,
} from "@/lib/schools/permissions";
import { addSchoolMemberSchema } from "@/lib/validators";
import type { SchoolMemberRole } from "@/types";
import type { SchoolMutationResultContract } from "../contracts/school";
import { badRequest, forbidden, notFound } from "../errors";

async function loadSchoolBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(schools)
    .where(eq(schools.slug, slug))
    .limit(1);
  return row ?? null;
}

async function loadMembership(
  schoolId: string,
  userId: string
): Promise<CurrentSchoolMembership> {
  const [row] = await db
    .select({
      schoolId: schoolMembers.schoolId,
      userId: schoolMembers.userId,
      role: schoolMembers.role,
    })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, userId)
      )
    )
    .limit(1);
  return row ?? null;
}

async function findExistingSchoolSlugForUser(
  userId: string
): Promise<string | null> {
  const [row] = await db
    .select({ slug: schools.slug })
    .from(schoolMembers)
    .innerJoin(schools, eq(schools.id, schoolMembers.schoolId))
    .where(eq(schoolMembers.userId, userId))
    .limit(1);
  return row?.slug ?? null;
}

async function requireRosterManager(slug: string, user: AppUser) {
  const school = await loadSchoolBySlug(slug);
  if (!school) throw notFound("School not found.");
  const membership = await loadMembership(school.id, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    throw forbidden("Only school officers can manage this roster.");
  }
  return { school, membership };
}

export async function addSchoolMemberForViewer(
  slug: string,
  user: AppUser,
  input: { email: string; role: "officer" | "member"; title?: string | null }
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  const parsed = addSchoolMemberSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid member.");
  }

  const [target] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${parsed.data.email.toLowerCase().trim()}`)
    .limit(1);

  if (!target) {
    throw badRequest("No user found with that email. They must sign up first.");
  }

  const [existing] = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, school.id),
        eq(schoolMembers.userId, target.id)
      )
    )
    .limit(1);
  if (existing) {
    throw badRequest("User is already a member of this school.");
  }

  const otherSchoolSlug = await findExistingSchoolSlugForUser(target.id);
  if (otherSchoolSlug) {
    throw badRequest("That user is already part of another school.");
  }

  await releaseJerseyIfSchoolConflict(db, school.id, target.id);

  await db.insert(schoolMembers).values({
    schoolId: school.id,
    userId: target.id,
    role: parsed.data.role,
    title: parsed.data.title,
  });

  await db
    .update(schoolJoinRequests)
    .set({
      status: "approved",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
    })
    .where(
      and(
        eq(schoolJoinRequests.schoolId, school.id),
        eq(schoolJoinRequests.userId, target.id),
        eq(schoolJoinRequests.status, "pending")
      )
    );

  return { success: true };
}

export async function removeSchoolMemberForViewer(
  slug: string,
  membershipId: string,
  user: AppUser
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  const [target] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== school.id) {
    throw notFound("Member not found.");
  }
  if (target.role === "president") {
    throw badRequest(
      "Transfer presidency to another member before removing the current president."
    );
  }

  await db.delete(schoolMembers).where(eq(schoolMembers.id, membershipId));
  return { success: true };
}

export async function updateSchoolMemberRoleForViewer(
  slug: string,
  membershipId: string,
  user: AppUser,
  role: SchoolMemberRole
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  if (role === "president") {
    throw badRequest("Use transfer presidency to make someone president.");
  }
  if (role !== "officer" && role !== "member") {
    throw badRequest("Choose officer or member.");
  }

  const [target] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== school.id) {
    throw notFound("Member not found.");
  }
  if (target.role === "president") {
    throw badRequest("Transfer presidency before changing the president's role.");
  }

  await db
    .update(schoolMembers)
    .set({ role, title: role === "member" ? null : target.title })
    .where(eq(schoolMembers.id, membershipId));

  return { success: true };
}

export async function updateSchoolMemberVolleyballPositionForViewer(
  slug: string,
  membershipId: string,
  user: AppUser,
  volleyballPosition: string | null
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  const parsed = parseVolleyballPositionInput(volleyballPosition);
  if (parsed === "invalid") {
    throw badRequest("Invalid volleyball position.");
  }

  const [target] = await db
    .select({ schoolId: schoolMembers.schoolId, userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== school.id) {
    throw notFound("Member not found.");
  }

  await db
    .update(users)
    .set({ volleyballPosition: parsed, updatedAt: new Date() })
    .where(eq(users.id, target.userId));

  return { success: true };
}

export async function updateSchoolMemberJerseyForViewer(
  slug: string,
  membershipId: string,
  user: AppUser,
  jerseyNumber: number | null
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  if (
    jerseyNumber !== null &&
    (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 99)
  ) {
    throw badRequest(JERSEY_NUMBER_RANGE_ERROR);
  }

  const [target] = await db
    .select({ schoolId: schoolMembers.schoolId, userId: schoolMembers.userId })
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== school.id) {
    throw notFound("Member not found.");
  }

  const assigned = await assignUserJerseyNumber(db, {
    userId: target.userId,
    jerseyNumber,
  });
  if ("error" in assigned) throw badRequest(assigned.error);

  return { success: true };
}

export async function transferSchoolPresidencyForViewer(
  slug: string,
  membershipId: string,
  user: AppUser
): Promise<SchoolMutationResultContract> {
  const school = await loadSchoolBySlug(slug);
  if (!school) throw notFound("School not found.");

  const membership = await loadMembership(school.id, user.id);
  if (!canTransferPresidency(membership, user)) {
    throw forbidden("Only the current president can transfer presidency.");
  }

  const [next] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!next || next.schoolId !== school.id) {
    throw notFound("Member not found.");
  }
  if (next.role === "president") {
    throw badRequest("That member is already the president.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schoolMembers)
      .set({ role: "officer" })
      .where(
        and(
          eq(schoolMembers.schoolId, school.id),
          eq(schoolMembers.role, "president")
        )
      );

    await tx
      .update(schoolMembers)
      .set({ role: "president" })
      .where(eq(schoolMembers.id, membershipId));
  });

  return { success: true };
}

export async function leaveSchoolForViewer(
  slug: string,
  user: AppUser
): Promise<SchoolMutationResultContract> {
  const school = await loadSchoolBySlug(slug);
  if (!school) throw notFound("School not found.");

  const membership = await loadMembership(school.id, user.id);
  if (!membership) {
    throw badRequest("You are not a member of this school.");
  }
  if (membership.role === "president") {
    throw badRequest(
      "Presidents must transfer presidency or delete the school before leaving."
    );
  }

  await db
    .delete(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, school.id),
        eq(schoolMembers.userId, user.id)
      )
    );

  return { success: true };
}

export async function approveSchoolJoinRequestForViewer(
  slug: string,
  requestId: string,
  user: AppUser
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  const [request] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending" || request.schoolId !== school.id) {
    throw badRequest("Request is no longer pending.");
  }

  const otherSchoolSlug = await findExistingSchoolSlugForUser(request.userId);
  if (otherSchoolSlug) {
    await db
      .update(schoolJoinRequests)
      .set({
        status: "cancelled",
        resolvedAt: new Date(),
        resolvedByUserId: user.id,
      })
      .where(eq(schoolJoinRequests.id, request.id));
    throw badRequest("That user already joined another school.");
  }

  try {
    await releaseJerseyIfSchoolConflict(db, school.id, request.userId);
    await db.transaction(async (tx) => {
      await tx.insert(schoolMembers).values({
        schoolId: school.id,
        userId: request.userId,
        role: "member",
      });
      await tx
        .update(schoolJoinRequests)
        .set({
          status: "approved",
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
        })
        .where(eq(schoolJoinRequests.id, request.id));
    });
  } catch {
    throw badRequest("Could not add this person to the roster. Try again.");
  }

  try {
    await notifyRequesterOfJoinUpdate({
      userId: request.userId,
      schoolSlug: school.slug,
      schoolName: school.name,
      approved: true,
    });
  } catch {
    // Membership is saved; notification is best-effort.
  }

  return { success: true };
}

export async function rejectSchoolJoinRequestForViewer(
  slug: string,
  requestId: string,
  user: AppUser
): Promise<SchoolMutationResultContract> {
  const { school } = await requireRosterManager(slug, user);

  const [request] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending" || request.schoolId !== school.id) {
    throw badRequest("Request is no longer pending.");
  }

  await db
    .update(schoolJoinRequests)
    .set({
      status: "rejected",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
    })
    .where(eq(schoolJoinRequests.id, request.id));

  try {
    await notifyRequesterOfJoinUpdate({
      userId: request.userId,
      schoolSlug: school.slug,
      schoolName: school.name,
      approved: false,
    });
  } catch {
    // Decision is saved; notification is best-effort.
  }

  return { success: true };
}
