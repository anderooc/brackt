/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { randomBytes } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { memberInvites, schools, teams, users } from "@/lib/db/schema";
import { sendMemberInviteEmail } from "@/lib/email/invite-email";
import {
  assignUserJerseyNumber,
  jerseyTakenOnTeam,
} from "@/lib/profile/jersey-number-store";

const INVITE_TTL_DAYS = 14;

function inviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function expiresAt(): Date {
  const date = new Date();
  date.setDate(date.getDate() + INVITE_TTL_DAYS);
  return date;
}

export async function createSchoolMemberInvite(input: {
  schoolId: string;
  email: string;
  role: string;
  title?: string | null;
  invitedByUserId: string;
  schoolName: string;
  inviterName: string;
}): Promise<{ ok: true } | { error: string }> {
  const email = normalizeEmail(input.email);
  const token = inviteToken();

  try {
    await db.insert(memberInvites).values({
      email,
      schoolId: input.schoolId,
      role: input.role,
      title: input.title ?? null,
      invitedByUserId: input.invitedByUserId,
      token,
      expiresAt: expiresAt(),
    });
  } catch {
    return { error: "An invite is already pending for this email." };
  }

  try {
    await sendMemberInviteEmail({
      to: email,
      token,
      inviterName: input.inviterName,
      targetName: input.schoolName,
      targetKind: "school",
    });
  } catch {
    await db
      .delete(memberInvites)
      .where(eq(memberInvites.token, token));
    return { error: "Could not send the invite email. Try again later." };
  }

  return { ok: true };
}

export async function createTeamMemberInvite(input: {
  teamId: string;
  email: string;
  jerseyNumber?: number | null;
  invitedByUserId: string;
  teamName: string;
  inviterName: string;
}): Promise<{ ok: true } | { error: string }> {
  const email = normalizeEmail(input.email);
  const token = inviteToken();

  try {
    await db.insert(memberInvites).values({
      email,
      teamId: input.teamId,
      role: "player",
      jerseyNumber: input.jerseyNumber ?? null,
      invitedByUserId: input.invitedByUserId,
      token,
      expiresAt: expiresAt(),
    });
  } catch {
    return { error: "An invite is already pending for this email." };
  }

  try {
    await sendMemberInviteEmail({
      to: email,
      token,
      inviterName: input.inviterName,
      targetName: input.teamName,
      targetKind: "team",
    });
  } catch {
    await db
      .delete(memberInvites)
      .where(eq(memberInvites.token, token));
    return { error: "Could not send the invite email. Try again later." };
  }

  return { ok: true };
}

export type MemberInviteDetails = {
  id: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  schoolId: string | null;
  teamId: string | null;
  schoolName: string | null;
  teamName: string | null;
  role: string;
  title: string | null;
  jerseyNumber: number | null;
  expiresAt: Date;
  isExpired: boolean;
};

export async function loadMemberInviteByToken(
  token: string
): Promise<MemberInviteDetails | null> {
  const [row] = await db
    .select({
      id: memberInvites.id,
      email: memberInvites.email,
      token: memberInvites.token,
      status: memberInvites.status,
      schoolId: memberInvites.schoolId,
      teamId: memberInvites.teamId,
      schoolName: schools.name,
      teamName: teams.name,
      role: memberInvites.role,
      title: memberInvites.title,
      jerseyNumber: memberInvites.jerseyNumber,
      expiresAt: memberInvites.expiresAt,
    })
    .from(memberInvites)
    .leftJoin(schools, eq(memberInvites.schoolId, schools.id))
    .leftJoin(teams, eq(memberInvites.teamId, teams.id))
    .where(eq(memberInvites.token, token))
    .limit(1);

  if (!row) return null;
  const isExpired =
    row.status !== "pending" || row.expiresAt.getTime() < Date.now();
  return { ...row, isExpired };
}

export async function acceptMemberInvite(input: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ ok: true; redirectTo: string } | { error: string }> {
  const invite = await loadMemberInviteByToken(input.token);
  if (!invite) return { error: "This invite link is invalid." };
  if (invite.status !== "pending") {
    return { error: "This invite has already been used or revoked." };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    await db
      .update(memberInvites)
      .set({ status: "expired" })
      .where(eq(memberInvites.id, invite.id));
    return { error: "This invite has expired. Ask for a new one." };
  }

  const email = normalizeEmail(input.userEmail);
  if (email !== normalizeEmail(invite.email)) {
    return {
      error: `Sign in as ${invite.email} to accept this invite.`,
    };
  }

  if (invite.schoolId) {
    const { schoolMembers } = await import("@/lib/db/schema");
    const [existing] = await db
      .select({ id: schoolMembers.id })
      .from(schoolMembers)
      .where(
        and(
          eq(schoolMembers.schoolId, invite.schoolId),
          eq(schoolMembers.userId, input.userId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(schoolMembers).values({
        schoolId: invite.schoolId,
        userId: input.userId,
        role: invite.role as "president" | "officer" | "member",
        title: invite.title,
      });
    }

    const [school] = await db
      .select({ slug: schools.slug })
      .from(schools)
      .where(eq(schools.id, invite.schoolId))
      .limit(1);

    await db
      .update(memberInvites)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
      })
      .where(eq(memberInvites.id, invite.id));

    return { ok: true, redirectTo: `/schools/${school?.slug ?? ""}` };
  }

  if (invite.teamId) {
    const { schoolMembers, teamMembers } = await import("@/lib/db/schema");
    const [team] = await db
      .select({
        id: teams.id,
        slug: teams.slug,
        schoolId: teams.schoolId,
      })
      .from(teams)
      .where(eq(teams.id, invite.teamId))
      .limit(1);

    if (!team) return { error: "This team no longer exists." };

    if (team.schoolId) {
      const [onSchool] = await db
        .select({ id: schoolMembers.id })
        .from(schoolMembers)
        .where(
          and(
            eq(schoolMembers.schoolId, team.schoolId),
            eq(schoolMembers.userId, input.userId)
          )
        )
        .limit(1);
      if (!onSchool) {
        return {
          error:
            "You must join the school roster before joining this team.",
        };
      }
    }

    const [existing] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, invite.teamId),
          eq(teamMembers.userId, input.userId)
        )
      )
      .limit(1);

    if (!existing) {
      // A number taken since the invite was sent is dropped rather than
      // blocking the join; the captain can set another one from the roster.
      let jerseyNumber: number | null = null;
      if (invite.jerseyNumber !== null) {
        const assigned = await assignUserJerseyNumber(db, {
          userId: input.userId,
          jerseyNumber: invite.jerseyNumber,
          extraTeamId: invite.teamId,
        });
        if (!("error" in assigned)) jerseyNumber = invite.jerseyNumber;
      } else {
        const [profile] = await db
          .select({ jerseyNumber: users.jerseyNumber })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        const preferred = profile?.jerseyNumber ?? null;
        if (
          preferred !== null &&
          !(await jerseyTakenOnTeam(db, invite.teamId, preferred, input.userId))
        ) {
          jerseyNumber = preferred;
        }
      }

      await db.insert(teamMembers).values({
        teamId: invite.teamId,
        userId: input.userId,
        role: "player",
        jerseyNumber,
      });
    }

    await db
      .update(memberInvites)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.userId,
      })
      .where(eq(memberInvites.id, invite.id));

    return { ok: true, redirectTo: `/teams/${team.slug}` };
  }

  return { error: "This invite is invalid." };
}

export async function expireStaleInvites(): Promise<void> {
  await db
    .update(memberInvites)
    .set({ status: "expired" })
    .where(
      and(
        eq(memberInvites.status, "pending"),
        lt(memberInvites.expiresAt, new Date())
      )
    );
}
