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

import { useSyncExternalStore } from "react";

export const MOBILE_PASSWORD_RESET_REDIRECT = "brackt://reset-password";

function linkParams(url: string): URLSearchParams | null {
  const hashIndex = url.indexOf("#");
  const queryIndex = url.indexOf("?");
  const paramString =
    hashIndex >= 0
      ? url.slice(hashIndex + 1)
      : queryIndex >= 0
        ? url.slice(queryIndex + 1)
        : "";
  return paramString ? new URLSearchParams(paramString) : null;
}

export function parseAuthRecoveryUrl(
  url: string
): { accessToken: string; refreshToken: string } | null {
  const params = linkParams(url);
  if (!params) return null;
  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

/** Supabase reports expired / reused links as `#error=...&error_code=otp_expired`. */
export function parseAuthRecoveryError(url: string): string | null {
  const params = linkParams(url);
  if (!params?.get("error") && !params?.get("error_code")) return null;
  if (params.get("error_code") === "otp_expired") {
    return "This reset link has expired or was already used. Request a new one below.";
  }
  return (
    params.get("error_description")?.replace(/\+/g, " ") ??
    "This reset link is no longer valid. Request a new one below."
  );
}

export function isPasswordRecoveryUrl(url: string): boolean {
  return (
    url.includes("reset-password") ||
    (url.includes("type=recovery") && url.includes("access_token"))
  );
}

export type RecoveryState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "failed"; message: string };

let recoveryState: RecoveryState = { status: "idle" };
const listeners = new Set<() => void>();

export function setRecoveryState(next: RecoveryState): void {
  recoveryState = next;
  listeners.forEach((listener) => listener());
}

export function useRecoveryState(): RecoveryState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => recoveryState
  );
}
