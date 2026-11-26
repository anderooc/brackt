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

import { and, eq, ne } from "drizzle-orm";
import type { AppUser } from "@/lib/auth";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { db } from "@/lib/db";
import { schoolMembers, schools, teams, users } from "@/lib/db/schema";
import {
  canManageSchool,
  canSubmitForVerification,
  emailMatchesDomain,
  getVerificationEligibility,
  type CurrentSchoolMembership,
} from "@/lib/schools/permissions";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { updateSchoolSchema, type UpdateSchoolInput } from "@/lib/validators";
import type {
  SchoolUpdateResultContract,
  SchoolVerificationSubmitResultContract,
} from "../contracts/school";
import { badRequest, notFound } from "../errors";

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

export async function updateSchoolForViewer(
  user: AppUser,
  slug: string,
  input: UpdateSchoolInput | Record<string, unknown>
): Promise<SchoolUpdateResultContract> {
  const school = await loadSchoolBySlug(slug);
  if (!school) throw notFound("School not found.");

  const membership = await loadMembership(school.id, user.id);
  if (!canManageSchool(membership, user)) {
    throw badRequest("Only the school president can edit details.");
  }

  const parsed = updateSchoolSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0].message);
  }

  const contentError = await flagBlockedContent(user.id, [
    { area: "school.name", text: parsed.data.name ?? null },
    { area: "school.university", text: parsed.data.university ?? null },
    { area: "school.description", text: parsed.data.description ?? null },
  ]);
  if (contentError) throw badRequest(contentError);

  let nextSlug = school.slug;
  const renaming =
    parsed.data.name !== undefined && parsed.data.name !== school.name;
  if (renaming) {
    const base = slugify(
      `${parsed.data.name} ${parsed.data.university ?? school.university}`,
      "school"
    );
    const otherSlugs = await db
      .select({ slug: schools.slug })
      .from(schools)
      .where(ne(schools.id, school.id));
    nextSlug = uniqueSlug(
      base,
      otherSlugs.map((row) => row.slug)
    );
  }

  const nextName = parsed.data.name ?? school.name;
  const nextGender = parsed.data.gender ?? school.gender;
  const nextRegion = parsed.data.region ?? school.region;
  const nextUniversity = parsed.data.university ?? school.university;
  const attributesChanged =
    nextGender !== school.gender ||
    nextRegion !== school.region ||
    nextUniversity !== school.university;

  await db.transaction(async (tx) => {
    await tx
      .update(schools)
      .set({
        name: nextName,
        slug: nextSlug,
        university: nextUniversity,
        gender: nextGender,
        region: nextRegion,
        description:
          parsed.data.description !== undefined
            ? parsed.data.description ?? null
            : school.description,
        websiteUrl:
          parsed.data.websiteUrl !== undefined
            ? parsed.data.websiteUrl
            : school.websiteUrl,
        domainHint:
          parsed.data.domainHint !== undefined
            ? parsed.data.domainHint
            : school.domainHint,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, school.id));

    // School-linked teams inherit school attributes at create time; keep them
    // aligned when the school program changes gender, region, or university.
    if (attributesChanged) {
      await tx
        .update(teams)
        .set({
          gender: nextGender,
          region: nextRegion,
          university: nextUniversity,
          updatedAt: new Date(),
        })
        .where(eq(teams.schoolId, school.id));
    }
  });

  return { success: true, slug: nextSlug, name: nextName };
}

export async function submitSchoolVerificationForViewer(
  user: AppUser,
  slug: string
): Promise<SchoolVerificationSubmitResultContract> {
  const school = await loadSchoolBySlug(slug);
  if (!school) throw notFound("School not found.");

  const membership = await loadMembership(school.id, user.id);

  const officerRows = await db
    .select({
      role: schoolMembers.role,
      email: users.email,
    })
    .from(schoolMembers)
    .innerJoin(users, eq(schoolMembers.userId, users.id))
    .where(eq(schoolMembers.schoolId, school.id));

  const presidentRow = officerRows.find((row) => row.role === "president");
  const officerCount = officerRows.filter((row) => row.role === "officer").length;

  const eligibility = getVerificationEligibility({
    status: school.verificationStatus,
    hasPresident: !!presidentRow,
    officerCount,
  });

  if (!canSubmitForVerification(membership, user, eligibility)) {
    throw badRequest(
      eligibility.reason ?? "Only the president can submit for verification."
    );
  }

  const domainMatched = officerRows.some(
    (row) =>
      (row.role === "president" || row.role === "officer") &&
      emailMatchesDomain(row.email, school.domainHint)
  );

  await db
    .update(schools)
    .set({
      domainMatched,
      verificationStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(schools.id, school.id));

  return { success: true, domainMatched };
}
