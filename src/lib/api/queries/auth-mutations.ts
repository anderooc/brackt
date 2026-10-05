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

import "server-only";

import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { AppUser } from "@/lib/auth";
import { badRequest } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/errors";
import { checkAuthRateLimit } from "@/lib/rate-limit/auth";
import { checkContentFilter } from "@/lib/utils/content-filter";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validators";

function statelessAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );
}

const AUTH_UNAVAILABLE =
  "Authentication service is unavailable or blocked from this network. Try again in a few minutes or switch networks.";

export async function signUpAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ success: true }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid sign-up details.");
  }

  const signupContentError = checkContentFilter(parsed.data.fullName);
  if (signupContentError) throw badRequest(signupContentError);

  const rateLimit = await checkAuthRateLimit("signup", parsed.data.email);
  if (!rateLimit.allowed) throw badRequest(rateLimit.message);

  const supabase = statelessAuthClient();
  let authUser: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          full_name: parsed.data.fullName,
        },
      },
    });
    if (error) throw badRequest(error.message);
    authUser = data.user;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw badRequest(AUTH_UNAVAILABLE);
  }

  if (authUser) {
    try {
      await db.insert(users).values({
        authId: authUser.id,
        email: parsed.data.email.toLowerCase(),
        fullName: parsed.data.fullName,
        displayEmail: parsed.data.email,
        role: "player",
      });
    } catch {
      // User row may already exist from a trigger or a prior partial signup.
    }
  }

  return { success: true };
}

export async function requestPasswordResetEmail(input: {
  email: string;
  redirectTo: string;
}): Promise<{ success: true; message: string }> {
  const parsed = forgotPasswordSchema.safeParse({ email: input.email });
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Enter a valid email.");
  }

  const rateLimit = await checkAuthRateLimit(
    "password-reset",
    parsed.data.email
  );
  if (!rateLimit.allowed) throw badRequest(rateLimit.message);

  const supabase = statelessAuthClient();
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: input.redirectTo }
    );
    if (error) throw badRequest(error.message);
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw badRequest(AUTH_UNAVAILABLE);
  }

  return {
    success: true,
    message:
      "If an account exists for that email, we sent a link to reset your password.",
  };
}

export async function confirmPasswordResetForViewer(
  user: AppUser,
  input: { password: string; confirmPassword: string }
): Promise<{ success: true }> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid password.");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.authId, {
    password: parsed.data.password,
  });
  if (error) throw badRequest(error.message);

  return { success: true };
}
