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

import { revalidatePath } from "next/cache";
import { eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  brackets,
  contentFlags,
  courts,
  divisions,
  matches,
  pools,
  schools,
  teams,
  tournaments,
  users,
} from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth";
import { slugify, uniqueSlug } from "@/lib/utils/slug";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import {
  currentActorIsAdmin,
  deleteSchoolWithEligibilityLocks,
} from "@/lib/schools/school-deletion";
import { deleteTeamWithTournamentLocks } from "@/lib/teams/team-deletion";
import type { UserRole, TournamentStatus } from "@/types";

const VALID_ROLES: UserRole[] = ["player", "captain", "organizer", "admin"];

export async function setUserRole(userId: string, role: UserRole) {
  const admin = await requireAdmin();
  if (!VALID_ROLES.includes(role)) {
    return { error: "Invalid role" };
  }

  // Don't allow the only admin to demote themselves and lock everyone out.
  if (userId === admin.id && role !== "admin") {
    const otherAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(2);
    if (otherAdmins.length <= 1) {
      return { error: "You can't demote the only remaining admin." };
    }
  }

  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));

  revalidatePath("/admin");
  return { success: true as const };
}

export async function adminDeleteUser(userId: string) {
  const admin = await requireAdmin();

  if (userId === admin.id) {
    return { error: "You can't delete your own account from the admin panel." };
  }

  try {
    await db.delete(users).where(eq(users.id, userId));
  } catch {
    return {
      error:
        "Could not delete user — they may still own tournaments. Reassign or delete those first.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin");
  return { success: true as const };
}

export async function adminRenameTournament(
  tournamentId: string,
  rawName: string
) {
  const admin = await requireAdmin();
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) return { error: "Tournament name is required" };
  if (trimmed.length > 120) return { error: "Tournament name is too long" };

  const contentError = await flagBlockedContent(admin.id, [
    { area: "tournament.name", text: trimmed },
  ]);
  if (contentError) return { error: contentError };

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);
  if (!tournament) return { error: "Tournament not found" };

  if (trimmed === tournament.name.trim()) {
    return { success: true as const, slug: tournament.slug };
  }

  const base = slugify(trimmed, "tournament");
  const otherSlugs = await db
    .select({ slug: tournaments.slug })
    .from(tournaments)
    .where(ne(tournaments.id, tournamentId));
  const newSlug = uniqueSlug(
    base,
    otherSlugs.map((r) => r.slug)
  );

  await db
    .update(tournaments)
    .set({ name: trimmed, slug: newSlug, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath("/admin");
  revalidatePath("/tournaments");
  revalidatePath("/explore");
  revalidatePath("/tournaments/[slug]", "page");

  return { success: true as const, slug: newSlug };
}

export async function adminUpdateTournamentStatus(
  tournamentId: string,
  status: TournamentStatus
) {
  await requireAdmin();
  const allowed: TournamentStatus[] = [
    "draft",
    "registration_open",
    "registration_closed",
    "in_progress",
    "completed",
  ];
  if (!allowed.includes(status)) return { error: "Invalid status" };

  await db
    .update(tournaments)
    .set({ status, updatedAt: new Date() })
    .where(eq(tournaments.id, tournamentId));

  revalidatePath("/admin");
  revalidatePath("/tournaments/[slug]", "page");
  return { success: true as const };
}

export async function adminDeleteTournament(tournamentId: string) {
  await requireAdmin();

  try {
    await db.transaction(async (tx) => {
      const poolRows = await tx
        .select({ id: pools.id })
        .from(pools)
        .innerJoin(divisions, eq(pools.divisionId, divisions.id))
        .where(eq(divisions.tournamentId, tournamentId));

      const bracketRows = await tx
        .select({ id: brackets.id })
        .from(brackets)
        .innerJoin(divisions, eq(brackets.divisionId, divisions.id))
        .where(eq(divisions.tournamentId, tournamentId));

      const courtRows = await tx
        .select({ id: courts.id })
        .from(courts)
        .where(eq(courts.tournamentId, tournamentId));

      const poolIds = poolRows.map((r) => r.id);
      const bracketIds = bracketRows.map((r) => r.id);
      const courtIds = courtRows.map((r) => r.id);

      const matchPredicates = [];
      if (poolIds.length > 0)
        matchPredicates.push(inArray(matches.poolId, poolIds));
      if (bracketIds.length > 0)
        matchPredicates.push(inArray(matches.bracketId, bracketIds));
      if (courtIds.length > 0)
        matchPredicates.push(inArray(matches.courtId, courtIds));

      if (matchPredicates.length === 1) {
        await tx.delete(matches).where(matchPredicates[0]);
      } else if (matchPredicates.length > 1) {
        await tx.delete(matches).where(or(...matchPredicates));
      }

      await tx.delete(tournaments).where(eq(tournaments.id, tournamentId));
    });
  } catch {
    return { error: "Could not delete tournament. Try again." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin");
  revalidatePath("/tournaments");
  revalidatePath("/explore");
  return { success: true as const };
}

export async function adminRenameTeam(teamId: string, rawName: string) {
  const admin = await requireAdmin();
  const trimmed = (rawName ?? "").trim();
  if (!trimmed) return { error: "Team name is required" };
  if (trimmed.length > 120) return { error: "Team name is too long" };

  const contentError = await flagBlockedContent(admin.id, [
    { area: "team.name", text: trimmed },
  ]);
  if (contentError) return { error: contentError };

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) return { error: "Team not found" };

  if (trimmed === team.name.trim()) {
    return { success: true as const, slug: team.slug };
  }

  const base = slugify(`${trimmed} ${team.university}`, "team");
  const otherSlugs = await db
    .select({ slug: teams.slug })
    .from(teams)
    .where(ne(teams.id, teamId));
  const newSlug = uniqueSlug(
    base,
    otherSlugs.map((r) => r.slug)
  );

  await db
    .update(teams)
    .set({ name: trimmed, slug: newSlug, updatedAt: new Date() })
    .where(eq(teams.id, teamId));

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/teams/${newSlug}`);
  if (team.slug !== newSlug) revalidatePath(`/teams/${team.slug}`);
  return { success: true as const, slug: newSlug };
}

export async function adminDeleteTeam(teamId: string, confirmationName: string) {
  const admin = await requireAdmin();
  let result: Awaited<ReturnType<typeof deleteTeamWithTournamentLocks>>;
  try {
    result = await deleteTeamWithTournamentLocks({
      teamId,
      confirmationName,
      authorize: async (tx) => {
        const [actor] = await tx.select({
          role: users.role,
          disabledAt: users.disabledAt,
        }).from(users).where(eq(users.id, admin.id)).for("share").limit(1);
        return actor && !actor.disabledAt && actor.role === "admin"
          ? null
          : "Administrator access is required";
      },
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
  revalidatePath("/admin");
  revalidatePath("/teams");
  return { success: true as const };
}

export async function adminResolveFlag(flagId: string) {
  await requireAdmin();
  await db
    .update(contentFlags)
    .set({ resolvedAt: new Date() })
    .where(eq(contentFlags.id, flagId));
  revalidatePath("/admin");
  return { success: true as const };
}

export async function adminDeleteFlag(flagId: string) {
  await requireAdmin();
  await db.delete(contentFlags).where(eq(contentFlags.id, flagId));
  revalidatePath("/admin");
  return { success: true as const };
}

export async function adminApproveSchool(schoolId: string) {
  const admin = await requireAdmin();

  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school) return { error: "School not found" };

  await db
    .update(schools)
    .set({
      verificationStatus: "verified",
      verifiedAt: new Date(),
      verifiedByUserId: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  revalidatePath("/admin");
  revalidatePath("/schools");
  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function adminRejectSchool(schoolId: string) {
  const admin = await requireAdmin();

  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school) return { error: "School not found" };

  await db
    .update(schools)
    .set({
      verificationStatus: "rejected",
      verifiedAt: null,
      verifiedByUserId: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  revalidatePath("/admin");
  revalidatePath("/schools");
  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

export async function adminResetSchoolToPending(schoolId: string) {
  await requireAdmin();
  const [school] = await db
    .select()
    .from(schools)
    .where(eq(schools.id, schoolId))
    .limit(1);
  if (!school) return { error: "School not found" };

  await db
    .update(schools)
    .set({
      verificationStatus: "pending",
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(schools.id, schoolId));

  revalidatePath("/admin");
  revalidatePath("/schools");
  revalidatePath(`/schools/${school.slug}`);
  return { success: true as const };
}

async function requireStandaloneTeam(teamId: string) {
  const [team] = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      schoolId: teams.schoolId,
    })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);

  if (!team) return { error: "Team not found" as const };
  if (team.schoolId) {
    return {
      error:
        "School-linked teams are approved through their school, not team review.",
    };
  }
  return { team };
}

export async function adminApproveStandaloneTeam(teamId: string) {
  const admin = await requireAdmin();
  const gate = await requireStandaloneTeam(teamId);
  if ("error" in gate) return gate;

  await db
    .update(teams)
    .set({
      verificationStatus: "verified",
      verifiedAt: new Date(),
      verifiedByUserId: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/teams/${gate.team.slug}`);
  return { success: true as const };
}

export async function adminRejectStandaloneTeam(teamId: string) {
  const admin = await requireAdmin();
  const gate = await requireStandaloneTeam(teamId);
  if ("error" in gate) return gate;

  await db
    .update(teams)
    .set({
      verificationStatus: "rejected",
      verifiedAt: null,
      verifiedByUserId: admin.id,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/teams/${gate.team.slug}`);
  return { success: true as const };
}

export async function adminResetStandaloneTeamToPending(teamId: string) {
  await requireAdmin();
  const gate = await requireStandaloneTeam(teamId);
  if ("error" in gate) return gate;

  await db
    .update(teams)
    .set({
      verificationStatus: "pending",
      verifiedAt: null,
      verifiedByUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));

  revalidatePath("/admin");
  revalidatePath("/teams");
  revalidatePath(`/teams/${gate.team.slug}`);
  return { success: true as const };
}

export async function adminDeleteSchool(schoolId: string) {
  const admin = await requireAdmin();
  let result: Awaited<ReturnType<typeof deleteSchoolWithEligibilityLocks>>;
  try {
    result = await deleteSchoolWithEligibilityLocks({
      schoolId,
      authorize: async (tx) => await currentActorIsAdmin(tx, admin.id)
        ? null
        : "Administrator access is required",
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
  revalidatePath("/admin");
  revalidatePath("/admin");
  revalidatePath("/schools");
  return { success: true as const };
}
