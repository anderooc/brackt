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

import * as Sentry from "@sentry/react-native";
import * as Updates from "expo-updates";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

/**
 * Crash and error reporting for release builds. Off without a DSN and in
 * development. Errors only: no tracing, session replay, or personal data, so
 * the privacy disclosures stay to crash and diagnostic data.
 */
export function initMonitoring() {
  if (!DSN || __DEV__) return;

  Sentry.init({
    dsn: DSN,
    environment: Updates.channel ?? "unknown",
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });

  // Tie each error to the over-the-air update the device was running.
  const scope = Sentry.getGlobalScope();
  scope.setTag("expo-update-id", Updates.updateId ?? "none");
  scope.setTag("expo-is-embedded-update", String(Updates.isEmbeddedLaunch));
  scope.setTag("expo-runtime-version", Updates.runtimeVersion ?? "unknown");
}

export const wrapRoot = Sentry.wrap;
