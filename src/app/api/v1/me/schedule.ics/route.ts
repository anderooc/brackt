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

import { requireViewer } from "@/lib/api/auth";
import { apiHandler } from "@/lib/api/handler";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { buildPersonalScheduleIcs } from "@/lib/calendar/ics";
import { contentDispositionHeader } from "@/lib/security/content-disposition";

const ICS_FILENAME = "brackt-my-schedule.ics";

export const GET = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const url = new URL(request.url);
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const schedule = await loadPersonalScheduleForViewer(user, {
    includeCompleted,
    limit: 200,
  });

  const body = buildPersonalScheduleIcs(schedule.matches);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": contentDispositionHeader(ICS_FILENAME, {
        fallback: ICS_FILENAME,
      }),
      "Cache-Control": "no-store",
    },
  });
});
