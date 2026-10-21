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

import type { Metadata } from "next";

export const APP_NAME = "brackt";

export const COPYRIGHT_HOLDER = "Andrew Chang";
export const COPYRIGHT_YEAR = 2026;

export const APP_DEFAULT_DESCRIPTION =
  "Organize tournaments, manage teams, run pools and brackets, schedule courts, and track live scores for college club volleyball.";

/** Normalize env values like `brack-t.com` into absolute URLs. */
export function normalizeAppUrl(raw: string | undefined | null): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  // new URL() requires a scheme; env vars are sometimes set to a host only.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : trimmed.startsWith("localhost:") ||
        trimmed.startsWith("127.0.0.1:") ||
        trimmed === "localhost" ||
        trimmed === "127.0.0.1"
      ? `http://${trimmed}`
      : `https://${trimmed}`;

  return withScheme.replace(/\/+$/, "");
}

export function resolveAppBaseUrl(): string {
  const configured = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function appBaseUrl(): URL {
  return new URL(resolveAppBaseUrl());
}

/** Join title segments; root layout appends the app name via the title template. */
export function pageTitle(
  ...segments: (string | null | undefined | false)[]
): string {
  return segments
    .filter(
      (segment): segment is string =>
        typeof segment === "string" && segment.trim().length > 0
    )
    .join(" · ");
}

export function pageMetadata(
  title: string,
  description?: string,
  options?: {
    canonical?: string;
    noIndex?: boolean;
    /** Share image path; defaults to the site-wide social preview. */
    image?: string;
  }
): Metadata {
  const image = options?.image ?? "/opengraph-image";
  return {
    title,
    ...(description ? { description } : {}),
    ...(options?.canonical
      ? {
          alternates: { canonical: options.canonical },
          openGraph: {
            title,
            ...(description ? { description } : {}),
            url: options.canonical,
            siteName: APP_NAME,
            images: [{ url: image, width: 1200, height: 630 }],
          },
          twitter: {
            card: "summary_large_image",
            title,
            ...(description ? { description } : {}),
            images: [image],
          },
        }
      : {}),
    ...(options?.noIndex
      ? { robots: { index: false, follow: false, noarchive: true } }
      : {}),
  };
}
