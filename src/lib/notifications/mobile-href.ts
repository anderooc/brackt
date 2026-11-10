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

import { safeInternalHref } from "./display";

/** Map dashboard web paths to Expo Router paths for deep links. */
export function mapNotificationHrefForMobile(
  href: string | null | undefined
): string | null {
  const safe = safeInternalHref(href);
  if (!safe) return null;

  const tournamentMatch = /^\/tournaments\/([^/?]+)(?:\?(.*))?$/.exec(safe);
  if (tournamentMatch) {
    const slug = tournamentMatch[1];
    const query = tournamentMatch[2] ?? "";
    const tab = new URLSearchParams(query).get("tab");
    switch (tab) {
      case "chat":
      case "packet":
      case "waiver":
      case "payment":
      case "email":
        return `/tournament/${slug}/${tab}`;
      case "pool-play":
        return `/tournament/${slug}/pools`;
      case "bracket":
        return `/tournament/${slug}/bracket`;
      case "teams":
        return `/tournament/${slug}?tab=teams`;
      // Older app builds only know `matches`; newer ones open it as Play.
      case "matches":
        return `/tournament/${slug}?tab=matches`;
      case "my-matches":
        return `/tournament/${slug}?tab=play&view=mine`;
      default:
        return `/tournament/${slug}`;
    }
  }

  if (safe === "/dashboard" || safe.startsWith("/dashboard#")) return "/";

  const schoolMatch = /^\/schools\/([^/?]+)/.exec(safe);
  if (schoolMatch) return `/schools/${schoolMatch[1]}`;

  return null;
}
