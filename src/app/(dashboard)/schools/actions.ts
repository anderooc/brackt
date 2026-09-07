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
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  schoolJoinRequests,
  schoolMembers,
  schools,
  teams,
  users,
} from "@/lib/db/schema";
import { requireUser } from "@/lib/auth";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { parseVolleyballPositionInput } from "@/lib/profile/volleyball-position";
import {
  bulkImportSchoolRosterInternal,
  type BulkImportRowInput,
} from "@/lib/api/queries/roster-bulk-import";
import {
  addSchoolMemberSchema,
  createSchoolSchema,
  updateSchoolSchema,
} from "@/lib/validators";
import {
  canManageSchool,
  canManageSchoolRoster,
  canTransferPresidency,
  emailMatchesSchoolDomain,
  type CurrentSchoolMembership,
} from "@/lib/schools/permissions";
import type { SchoolMemberRole } from "@/types";
import {
  notifyRequesterOfJoinUpdate,
  notifySchoolOfficersOfJoinRequest,
} from "@/lib/notifications/school-events";
import { z } from "zod";
import { TEAM_GENDERS, TEAM_REGIONS } from "@/lib/constants/team";
import {
  hasSchoolSearchCriteria,
  searchSchools,
  type SchoolSearchItem,
} from "@/lib/schools/search";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import {
  currentActorCanDeleteSchool,
  deleteSchoolWithEligibilityLocks,
} from "@/lib/schools/school-deletion";
import { releaseJerseyIfSchoolConflict } from "@/lib/profile/jersey-number-store";
import { createSchoolMemberInvite } from "@/lib/invites/member-invites";
import {
  submitSchoolVerificationForViewer,
  updateSchoolForViewer,
} from "@/lib/api/queries/school-update";

const schoolSearchSchema = z.object({
  query: z.string().max(200).optional().default(""),
  genders: z.array(z.enum(TEAM_GENDERS)).optional().default([]),
  regions: z.array(z.enum(TEAM_REGIONS)).optional().default([]),
  verificationStatuses: z
    .array(z.enum(["pending", "verified", "rejected"]))
    .optional()
    .default([]),
  offset: z.number().int().min(0).optional().default(0),
});

export type SchoolSearchResult =
  | { error: string }
  | {
      success: true;
      schools: SchoolSearchItem[];
      total: number;
      limit: number;
      offset: number;
    };

export async function searchSchoolsForDiscovery(
  input: z.input<typeof schoolSearchSchema>
): Promise<SchoolSearchResult> {
  await requireUser();

  const parsed = schoolSearchSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid search." };
  }

  const { query, genders, regions, verificationStatuses, offset } =
    parsed.data;

  if (
    !hasSchoolSearchCriteria({
      query,
      genders,
      regions,
      verificationStatuses,
    })
  ) {
    return { error: "Enter a search term or choose at least one filter." };
  }

  const result = await searchSchools({
    query,
    genders,
    regions,
    verificationStatuses,
    offset,
  });

  return { success: true, ...result };
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

async function loadSchool(schoolId: string) {
  const [row] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  return row ?? null;
}

/** A user can only belong to one school at a time. Returns the existing
 * school's slug if they're already a member, otherwise null. */
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

export async function createSchool(formData: FormData) {
  const user = await requireUser();

  // One school per user — bounce them to their existing school instead.
  const existingSlug = await findExistingSchoolSlugForUser(user.id);
  if (existingSlug) {
    return {
      error: `You're already part of a school. Leave it before creating a new one.`,
    };
  }

  const parsed = createSchoolSchema.safeParse({
    name: formData.get("name"),
    university: formData.get("university"),
    gender: formData.get("gender"),
    region: formData.get("region"),
    description: formData.get("description"),
    websiteUrl: formData.get("websiteUrl"),
    domainHint: formData.get("domainHint"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "school.name", text: parsed.data.name },
    { area: "school.university", text: parsed.data.university },
    { area: "school.description", text: parsed.data.description ?? null },
  ]);
  if (contentError) return { error: contentError };

  const base = slugify(
    `${parsed.data.name} ${parsed.data.university}`,
    "school"
  );
  const existingSlugs = await db.select({ slug: schools.slug }).from(schools);
  const slug = uniqueSlug(
    base,
    existingSlugs.map((s) => s.slug)
  );

  const result = await db.transaction(async (tx) => {
    const [school] = await tx
      .insert(schools)
      .values({
        name: parsed.data.name,
        slug,
        university: parsed.data.university,
        gender: parsed.data.gender,
        region: parsed.data.region,
        description: parsed.data.description ?? null,
        websiteUrl: parsed.data.websiteUrl,
        domainHint: parsed.data.domainHint,
      })
      .returning();

    await tx.insert(schoolMembers).values({
      schoolId: school.id,
      userId: user.id,
      role: "president",
    });

    return school;
  });

  revalidatePath("/schools");
  redirect(`/schools/${result.slug}`);
}

export async function updateSchool(
  schoolId: string,
  formData: FormData
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const parsed = updateSchoolSchema.safeParse({
    name: formData.get("name") ?? undefined,
    university: formData.get("university") ?? undefined,
    gender: formData.get("gender") ?? undefined,
    region: formData.get("region") ?? undefined,
    description: formData.get("description") ?? undefined,
    websiteUrl: formData.get("websiteUrl") ?? undefined,
    domainHint: formData.get("domainHint") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const result = await updateSchoolForViewer(user, school.slug, parsed.data).catch(
    (cause: unknown) => ({
      error: cause instanceof Error ? cause.message : "Could not update school.",
    })
  );
  if ("error" in result) return result;

  revalidatePath("/schools");
  revalidatePath(`/schools/${school.slug}`);
  if (result.slug !== school.slug) {
    revalidatePath(`/schools/${result.slug}`);
  }
  return { success: true as const, slug: result.slug };
}

export async function deleteSchool(schoolId: string) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchool(membership, user)) {
    return { error: "Only the school president can delete this school." };
  }

  let result: Awaited<ReturnType<typeof deleteSchoolWithEligibilityLocks>>;
  try {
    result = await deleteSchoolWithEligibilityLocks({
      schoolId,
      authorize: async (tx) => await currentActorCanDeleteSchool(
        tx,
        schoolId,
        user.id
      ) ? null : "Only the school president can delete this school.",
      afterCommit: async (parents) => {
        await invalidatePublicTournamentCachesByIds(
          parents.map((parent) => parent.id),
          { listing: true }
        );
      },
    });
  } catch {
    return { error: "Could not delete school. Try again." };
  }
  if (!result.ok) return { error: result.error };

  revalidatePath("/schools");
  revalidatePath("/teams");
  return { success: true as const };
}

export async function addSchoolMember(
  schoolId: string,
  formData: FormData
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can add roster members." };
  }

  const parsed = addSchoolMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    title: formData.get("title"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase().trim()))
    .limit(1);

  if (!target) {
    const invite = await createSchoolMemberInvite({
      schoolId,
      email: parsed.data.email,
      role: parsed.data.role,
      title: parsed.data.title,
      invitedByUserId: user.id,
      schoolName: school.name,
      inviterName: user.fullName,
    });
    if ("error" in invite) return { error: invite.error };
    revalidatePath(`/schools/${school.slug}`);
    return { success: true, invited: true };
  }

  const [existing] = await db
    .select({ id: schoolMembers.id })
    .from(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, target.id)
      )
    )
    .limit(1);

  if (existing) {
    return { error: "User is already a member of this school." };
  }

  // One school per user.
  const otherSchoolSlug = await findExistingSchoolSlugForUser(target.id);
  if (otherSchoolSlug) {
    return {
      error: "That user is already part of another school.",
    };
  }

  await releaseJerseyIfSchoolConflict(db, schoolId, target.id);

  await db.insert(schoolMembers).values({
    schoolId,
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
        eq(schoolJoinRequests.schoolId, schoolId),
        eq(schoolJoinRequests.userId, target.id),
        eq(schoolJoinRequests.status, "pending")
      )
    );

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/notifications");
  return { success: true as const };
}

export async function requestToJoinSchool(schoolId: string) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  if (!school.domainHint) {
    return {
      error:
        "This school has no email domain on file. Ask a president or officer to add you by email.",
    };
  }

  if (!emailMatchesSchoolDomain(user.email, school.domainHint)) {
    return {
      error: `Your signup email must match @${school.domainHint} (or a subdomain) to request to join.`,
    };
  }

  const membership = await loadMembership(schoolId, user.id);
  if (membership) {
    return { error: "You are already on this school's roster." };
  }

  const existingSlug = await findExistingSchoolSlugForUser(user.id);
  if (existingSlug) {
    return {
      error: "You're already part of a school. Leave it before joining another.",
    };
  }

  const [pending] = await db
    .select({
      id: schoolJoinRequests.id,
      schoolId: schoolJoinRequests.schoolId,
    })
    .from(schoolJoinRequests)
    .where(
      and(
        eq(schoolJoinRequests.userId, user.id),
        eq(schoolJoinRequests.status, "pending")
      )
    )
    .limit(1);

  if (pending) {
    if (pending.schoolId === schoolId) {
      return { success: true as const, alreadyPending: true };
    }
    const [other] = await db
      .select({ name: schools.name })
      .from(schools)
      .where(eq(schools.id, pending.schoolId))
      .limit(1);
    return {
      error: `You already have a pending request to join ${other?.name ?? "another school"}. Cancel it first.`,
    };
  }

  try {
    await db.insert(schoolJoinRequests).values({
      schoolId,
      userId: user.id,
    });
  } catch {
    return { error: "Could not send join request. Try again." };
  }

  try {
    await notifySchoolOfficersOfJoinRequest({
      schoolId: school.id,
      schoolSlug: school.slug,
      schoolName: school.name,
      requesterName: user.fullName,
      excludeUserId: user.id,
    });
  } catch {
    // Request is saved; in-app copy is best-effort.
  }

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/notifications");
  return { success: true as const };
}

export async function cancelSchoolJoinRequest(schoolId: string) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const [pending] = await db
    .select({ id: schoolJoinRequests.id })
    .from(schoolJoinRequests)
    .where(
      and(
        eq(schoolJoinRequests.schoolId, schoolId),
        eq(schoolJoinRequests.userId, user.id),
        eq(schoolJoinRequests.status, "pending")
      )
    )
    .limit(1);

  if (!pending) {
    return { error: "No pending request to cancel." };
  }

  await db
    .update(schoolJoinRequests)
    .set({
      status: "cancelled",
      resolvedAt: new Date(),
      resolvedByUserId: user.id,
    })
    .where(eq(schoolJoinRequests.id, pending.id));

  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function approveSchoolJoinRequest(requestId: string) {
  const user = await requireUser();
  const [request] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending") {
    return { error: "Request is no longer pending." };
  }

  const school = await loadSchool(request.schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(school.id, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can approve join requests." };
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
    return { error: "That user already joined another school." };
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
    return { error: "Could not add this person to the roster. Try again." };
  }

  try {
    await notifyRequesterOfJoinUpdate({
      userId: request.userId,
      schoolSlug: school.slug,
      schoolName: school.name,
      approved: true,
    });
  } catch {
    // Membership is saved; in-app copy is best-effort.
  }

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/notifications");
  return { success: true as const };
}

export async function rejectSchoolJoinRequest(requestId: string) {
  const user = await requireUser();
  const [request] = await db
    .select()
    .from(schoolJoinRequests)
    .where(eq(schoolJoinRequests.id, requestId))
    .limit(1);

  if (!request || request.status !== "pending") {
    return { error: "Request is no longer pending." };
  }

  const school = await loadSchool(request.schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(school.id, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can decline join requests." };
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
    // Decision is saved; in-app copy is best-effort.
  }

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/notifications");
  return { success: true as const };
}

export async function leaveSchool(schoolId: string) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!membership) {
    return { error: "You are not a member of this school." };
  }
  if (membership.role === "president") {
    return {
      error:
        "Presidents must transfer presidency or delete the school before leaving.",
    };
  }

  await db
    .delete(schoolMembers)
    .where(
      and(
        eq(schoolMembers.schoolId, schoolId),
        eq(schoolMembers.userId, user.id)
      )
    );

  revalidatePath("/schools");
  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function removeSchoolMember(
  schoolId: string,
  membershipId: string
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can remove roster members." };
  }

  const [target] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== schoolId) {
    return { error: "Member not found." };
  }

  if (target.role === "president") {
    return {
      error:
        "Transfer presidency to another member before removing the current president.",
    };
  }

  await db.delete(schoolMembers).where(eq(schoolMembers.id, membershipId));

  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function updateSchoolMemberRole(
  schoolId: string,
  membershipId: string,
  role: SchoolMemberRole
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can change roles." };
  }

  if (role === "president") {
    return {
      error: "Use 'Transfer presidency' to make someone president.",
    };
  }

  const [target] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== schoolId) {
    return { error: "Member not found." };
  }

  if (target.role === "president") {
    return {
      error: "Transfer presidency before changing the president's role.",
    };
  }

  await db
    .update(schoolMembers)
    .set({ role, title: role === "member" ? null : target.title })
    .where(eq(schoolMembers.id, membershipId));

  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function updateSchoolMemberVolleyballPosition(
  schoolId: string,
  membershipId: string,
  volleyballPosition: string | null
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can change volleyball positions." };
  }

  const parsed = parseVolleyballPositionInput(volleyballPosition);
  if (parsed === "invalid") {
    return { error: "Invalid volleyball position." };
  }

  const [target] = await db
    .select({
      schoolId: schoolMembers.schoolId,
      userId: schoolMembers.userId,
    })
    .from(schoolMembers)
    .where(eq(schoolMembers.id, membershipId))
    .limit(1);

  if (!target || target.schoolId !== schoolId) {
    return { error: "Member not found." };
  }

  await db
    .update(users)
    .set({ volleyballPosition: parsed, updatedAt: new Date() })
    .where(eq(users.id, target.userId));

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/teams/[slug]", "page");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function transferPresidency(
  schoolId: string,
  newPresidentMembershipId: string
) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canTransferPresidency(membership, user)) {
    return {
      error: "Only the current president can transfer presidency.",
    };
  }

  const [next] = await db
    .select()
    .from(schoolMembers)
    .where(eq(schoolMembers.id, newPresidentMembershipId))
    .limit(1);

  if (!next || next.schoolId !== schoolId) {
    return { error: "Member not found." };
  }
  if (next.role === "president") {
    return { error: "That member is already the president." };
  }

  await db.transaction(async (tx) => {
    // Swap to officer first (the partial unique index requires only one
    // president row at a time).
    await tx
      .update(schoolMembers)
      .set({ role: "officer" })
      .where(
        and(
          eq(schoolMembers.schoolId, schoolId),
          eq(schoolMembers.role, "president")
        )
      );

    await tx
      .update(schoolMembers)
      .set({ role: "president" })
      .where(eq(schoolMembers.id, newPresidentMembershipId));
  });

  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function submitForVerification(schoolId: string) {
  const user = await requireUser();
  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const result = await submitSchoolVerificationForViewer(
    user,
    school.slug
  ).catch((cause: unknown) => ({
    error:
      cause instanceof Error ? cause.message : "Could not submit for verification.",
  }));
  if ("error" in result) return result;

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath("/admin");
  return { success: true as const, domainMatched: result.domainMatched };
}

/**
 * Lists schools where the current user can create a team (officer or
 * president). Used to populate the "Part of a school" picker on the team
 * create form.
 */
export async function listManageableSchoolsForUser(userId: string) {
  return db
    .select({
      id: schools.id,
      name: schools.name,
      slug: schools.slug,
      university: schools.university,
      gender: schools.gender,
      region: schools.region,
      role: schoolMembers.role,
    })
    .from(schools)
    .innerJoin(schoolMembers, eq(schoolMembers.schoolId, schools.id))
    .where(
      and(
        eq(schoolMembers.userId, userId),
        // members cannot create teams under the school
        ne(schoolMembers.role, "member")
      )
    );
}

export async function attachTeamToSchool(teamId: string, schoolId: string) {
  const user = await requireUser();

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return { error: "Team not found" };

  const school = await loadSchool(schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can link teams to a school." };
  }

  await db
    .update(teams)
    .set({
      schoolId,
      verificationStatus: "verified",
      verifiedAt: new Date(),
      verifiedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath(`/teams/${team.slug}`);
  revalidatePath("/teams");
  return { success: true as const };
}

export async function detachTeamFromSchool(teamId: string) {
  const user = await requireUser();

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return { error: "Team not found" };
  if (!team.schoolId) {
    return { error: "Team is not part of a school." };
  }

  const school = await loadSchool(team.schoolId);
  if (!school) return { error: "School not found" };

  const membership = await loadMembership(team.schoolId, user.id);
  if (!canManageSchoolRoster(membership, user)) {
    return { error: "Only school officers can detach teams." };
  }

  await db
    .update(teams)
    .set({
      schoolId: null,
      verificationStatus: "pending",
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath(`/schools/${school.slug}`);
  revalidatePath(`/teams/${team.slug}`);
  revalidatePath("/teams");
  return { success: true as const };
}

export async function bulkImportSchoolRosterAction(
  schoolId: string,
  rows: BulkImportRowInput[]
) {
  const user = await requireUser();
  const result = await bulkImportSchoolRosterInternal(schoolId, user, rows);
  if (result.success && result.targetSlug) {
    revalidatePath(`/schools/${result.targetSlug}`);
    revalidatePath("/notifications");
  }
  return result;
}

