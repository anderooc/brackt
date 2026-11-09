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

import { db } from "@/lib/db";
import { tournaments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { pageTitle } from "@/lib/metadata";
import {
  DEFAULT_TOURNAMENT_TAB,
  isTournamentTabId,
  TOURNAMENT_TAB_LABELS,
  type TournamentTabId,
} from "@/app/(dashboard)/tournaments/[slug]/constants";

export async function getTournamentNameBySlug(
  slug: string
): Promise<string | null> {
  const [row] = await db
    .select({ name: tournaments.name })
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);

  return row?.name ?? null;
}

/** Fields needed to title the detail page for the current viewer's role. */
export async function getTournamentTitleContextBySlug(slug: string) {
  const [row] = await db
    .select({
      id: tournaments.id,
      name: tournaments.name,
      organizerId: tournaments.organizerId,
      hostSchoolId: tournaments.hostSchoolId,
    })
    .from(tournaments)
    .where(eq(tournaments.slug, slug))
    .limit(1);

  return row ?? null;
}

/** Views that teams and fans see under a different name than hosts do. */
const PARTICIPANT_TAB_LABELS: Partial<Record<TournamentTabId, string>> = {
  setup: "Event info",
  pending: "Your application",
};

export function tournamentDetailTitle(
  tournamentName: string,
  tab?: string | null,
  options?: { isOrganizer?: boolean }
): string {
  const normalizedTab = tab === "messages" ? "email" : (tab ?? undefined);
  let tabId: TournamentTabId = DEFAULT_TOURNAMENT_TAB;
  if (isTournamentTabId(normalizedTab)) {
    tabId = normalizedTab;
  }

  if (tabId === DEFAULT_TOURNAMENT_TAB) {
    return tournamentName;
  }

  const label =
    (options?.isOrganizer ? undefined : PARTICIPANT_TAB_LABELS[tabId]) ??
    TOURNAMENT_TAB_LABELS[tabId];
  return pageTitle(label, tournamentName);
}
