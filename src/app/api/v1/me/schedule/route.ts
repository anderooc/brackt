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
import { requireViewer } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/handler";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { jsonSuccess } from "@/lib/api/response";
import { db } from "@/lib/db";
import { tournaments } from "@/lib/db/schema";
import { todayISO } from "@/lib/tournament-status";

export const GET = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const limit =
    limitParam != null && /^\d+$/.test(limitParam)
      ? Math.min(Number(limitParam), 200)
      : undefined;
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";
  const upcomingOnly = url.searchParams.get("upcomingOnly") === "1";
  const tournamentSlug = url.searchParams.get("tournament");

  let tournamentId: string | undefined;
  if (tournamentSlug) {
    const [row] = await db
      .select({ id: tournaments.id })
      .from(tournaments)
      .where(eq(tournaments.slug, tournamentSlug))
      .limit(1);
    if (!row) return jsonSuccess({ matches: [] });
    tournamentId = row.id;
  }

  return jsonSuccess(
    await loadPersonalScheduleForViewer(user, {
      limit,
      includeCompleted,
      tournamentId,
      fromDate: upcomingOnly ? todayISO() : undefined,
    })
  );
});
