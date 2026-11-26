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

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  accountDeletionRequests,
  contentFlags,
  schoolMembers,
  teamMembers,
  tournamentChatMessages,
  tournamentChatReadCursors,
  users,
  waiverCompletions,
} from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  removeProfileAvatar,
  uploadProfileAvatar,
} from "@/lib/profile/avatar-storage";
import { updateProfileSchema, changePasswordSchema } from "@/lib/validators";
import { checkContentFilter } from "@/lib/utils/content-filter";
import { flagBlockedContent } from "@/lib/admin/content-flags";
import {
  assignUserJerseyNumber,
  revalidateJerseyPaths,
} from "@/lib/profile/jersey-number-store";
import {
  saveNotificationPreferences,
  type NotificationPreference,
} from "@/lib/notifications/preferences";
import type { UserNotificationKind } from "@/types";

export async function updateNotificationPreferences(
  prefs: Record<UserNotificationKind, NotificationPreference>
) {
  const user = await requireUser();
  await saveNotificationPreferences(user.id, prefs);
  revalidatePath("/profile");
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const user = await requireUser();

  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    playerGender: formData.get("playerGender"),
    volleyballPosition: formData.get("volleyballPosition"),
    jerseyNumber: formData.get("jerseyNumber"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const contentError = checkContentFilter(parsed.data.fullName);
  if (contentError) return { error: contentError };

  const moderationError = await flagBlockedContent(user.id, [
    { area: "profile.full_name", text: parsed.data.fullName },
  ]);
  if (moderationError) return { error: moderationError };

  let avatarStoragePath = user.avatarStoragePath;
  const removeAvatar = formData.get("removeAvatar") === "true";
  const avatarFile = formData.get("avatar");

  try {
    if (removeAvatar) {
      await removeProfileAvatar(avatarStoragePath);
      avatarStoragePath = null;
    } else if (avatarFile instanceof File && avatarFile.size > 0) {
      const bytes = new Uint8Array(await avatarFile.arrayBuffer());
      avatarStoragePath = await uploadProfileAvatar(
        user.id,
        bytes,
        avatarFile.type
      );
    }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not update profile photo.",
    };
  }

  const jerseyResult = await assignUserJerseyNumber(db, {
    userId: user.id,
    jerseyNumber: parsed.data.jerseyNumber,
  });
  if ("error" in jerseyResult) {
    return { error: jerseyResult.error };
  }

  const [updated] = await db
    .update(users)
    .set({
      fullName: parsed.data.fullName,
      playerGender: parsed.data.playerGender,
      volleyballPosition: parsed.data.volleyballPosition,
      avatarStoragePath,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) {
    return { error: "Could not save profile." };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.updateUser({
      data: { full_name: parsed.data.fullName },
    });
  } catch {
    // Profile saved in DB; auth metadata sync is best-effort.
  }

  revalidateJerseyPaths(jerseyResult);
  revalidatePath("/teams");
  revalidatePath("/schools");
  revalidatePath("/profile");
  revalidatePath("/dashboard");

  return { success: true as const };
}

export async function changePassword(formData: FormData) {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  try {
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: parsed.data.currentPassword,
    });
    if (verifyError) {
      return { error: "Current password is incorrect." };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return { error: error.message };
    }
  } catch {
    return {
      error:
        "Authentication service is unavailable or blocked from this network. Try again in a few minutes or switch networks.",
    };
  }

  return { success: true as const };
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  const password = formData.get("password");
  const confirmation = formData.get("confirmation");

  if (typeof password !== "string" || password.length === 0) {
    return { error: "Enter your password to continue." };
  }
  if (confirmation !== "DELETE") {
    return { error: "Type DELETE exactly to confirm." };
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) return { error: "Your password is incorrect." };
  } catch {
    return { error: "Could not verify your password. Try again later." };
  }

  let admin;
  try {
    admin = createAdminClient();
    await removeProfileAvatar(user.avatarStoragePath);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Account deletion is temporarily unavailable.",
    };
  }

  const requestId = await db.transaction(async (tx) => {
    const [request] = await tx
      .insert(accountDeletionRequests)
      .values({ authId: user.authId })
      .returning({ id: accountDeletionRequests.id });

    await tx
      .delete(tournamentChatReadCursors)
      .where(eq(tournamentChatReadCursors.userId, user.id));
    await tx
      .delete(tournamentChatMessages)
      .where(eq(tournamentChatMessages.authorUserId, user.id));
    await tx.delete(contentFlags).where(eq(contentFlags.userId, user.id));
    await tx.delete(teamMembers).where(eq(teamMembers.userId, user.id));
    await tx.delete(schoolMembers).where(eq(schoolMembers.userId, user.id));
    await tx
      .update(waiverCompletions)
      .set({ signedName: null })
      .where(eq(waiverCompletions.userId, user.id));
    await tx
      .update(users)
      .set({
        authId: `deleted:${request.id}`,
        email: `${request.id}@deleted.brackt.invalid`,
        fullName: "Deleted user",
        university: null,
        avatarStoragePath: null,
        playerGender: null,
        volleyballPosition: null,
        jerseyNumber: null,
        displayEmail: null,
        displaySchool: null,
        role: "player",
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return request.id;
  });

  const { error: deletionError } = await admin.auth.admin.deleteUser(user.authId);
  await db
    .update(accountDeletionRequests)
    .set(
      deletionError
        ? { lastError: deletionError.message }
        : { completedAt: new Date(), lastError: null }
    )
    .where(eq(accountDeletionRequests.id, requestId));

  await supabase.auth.signOut();
  redirect("/login?account=deleted");
}
