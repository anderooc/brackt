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

/// <reference types="node" />
import { existsSync } from "node:fs";
import type { ConfigContext, ExpoConfig } from "expo/config";

const LOCAL_GOOGLE_SERVICES = "./google-services.json";

/**
 * Layers build-time secrets over app.json:
 * - EXPO_PUBLIC_EAS_PROJECT_ID: from `eas init`; required for Expo push tokens.
 * - GOOGLE_SERVICES_JSON: path to google-services.json (an EAS file
 *   environment variable on EAS builds; falls back to a local, gitignored
 *   ./google-services.json). Android push (FCM) can't issue tokens without it.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() || undefined;
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON?.trim() ||
    (existsSync(LOCAL_GOOGLE_SERVICES) ? LOCAL_GOOGLE_SERVICES : undefined);

  return {
    ...config,
    name: config.name ?? "brackt",
    slug: config.slug ?? "brackt",
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
