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

import Constants from "expo-constants";
import { Platform } from "react-native";

function extra(name: string): string | undefined {
  const value = Constants.expoConfig?.extra?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

const API_PORT = 3000;

/**
 * `localhost` on an Android emulator refers to the emulator itself, so the host
 * machine has to be reached through its alias instead.
 */
function forLoopbackHost(url: string): string {
  if (Platform.OS === "android") {
    return url.replace(/\/\/(localhost|127\.0\.0\.1)/, "//10.0.2.2");
  }
  return url;
}

/**
 * In development the API runs on the same machine as the Expo dev server. On a
 * physical device the Expo host address is the right LAN target; simulators and
 * emulators should use loopback aliases instead (stale LAN IPs are common).
 */
function devServerBaseUrl(): string | undefined {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:${API_PORT}` : undefined;
}

function isIosSimulator(): boolean {
  return Platform.OS === "ios" && Constants.isDevice === false;
}

function isAndroidEmulator(): boolean {
  return Platform.OS === "android" && Constants.isDevice === false;
}

function developmentBaseUrl(): string {
  const configured = extra("apiBaseUrl");
  if (configured) return forLoopbackHost(configured);

  if (isIosSimulator()) {
    return `http://localhost:${API_PORT}`;
  }
  if (isAndroidEmulator()) {
    return `http://10.0.2.2:${API_PORT}`;
  }

  return devServerBaseUrl() ?? forLoopbackHost(`http://localhost:${API_PORT}`);
}

const PRODUCTION_BASE_URL = "https://brack-t.com";

/** `.env.example` ships `KEY=` lines, which inline as "" rather than undefined. */
function envUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

// A release build has no dev server to infer a host from, so falling back to
// localhost would make every request fail with "Can't reach brackt".
export const API_BASE_URL = (
  envUrl(process.env.EXPO_PUBLIC_API_BASE_URL) ??
  (__DEV__ ? developmentBaseUrl() : PRODUCTION_BASE_URL)
).replace(/\/+$/, "");

/** Public website (privacy, terms, share links). Defaults to the API host. */
export const WEB_BASE_URL = (
  envUrl(process.env.EXPO_PUBLIC_WEB_BASE_URL) ??
  (__DEV__ ? API_BASE_URL : PRODUCTION_BASE_URL)
).replace(/\/+$/, "");

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function assertSupabaseConfig(): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
        "Copy mobile/.env.example to mobile/.env.local and fill both in."
    );
  }
}
