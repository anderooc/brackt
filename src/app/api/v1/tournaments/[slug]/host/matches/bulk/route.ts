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
import { badRequest } from "@/lib/api/errors";
import { apiHandler } from "@/lib/api/handler";
import { executeBulkMatchOps } from "@/lib/api/queries/tournament-host-bulk-match-ops";
import { loadTournamentHostSchedule } from "@/lib/api/queries/tournament-host-schedule";
import { jsonSuccess } from "@/lib/api/response";
import type {
  TournamentHostBulkMatchAction,
  TournamentHostBulkMatchesRequestContract,
} from "@/lib/api/contracts/tournament-host";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

async function handleBulkMatches(request: Request, context: RouteContext) {
  const { user } = await requireViewer(request);
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) throw badRequest("Invalid request body.");

  const action = body.action as TournamentHostBulkMatchAction | undefined;
  if (!action) {
    throw badRequest("Provide action (reassign_court, shift_time, reassign_ref, or clear_schedule).");
  }

  const payload: TournamentHostBulkMatchesRequestContract = {
    action,
    matchIds: Array.isArray(body.matchIds)
      ? body.matchIds.filter((id): id is string => typeof id === "string")
      : undefined,
    courtId:
      body.courtId === null
        ? null
        : typeof body.courtId === "string"
          ? body.courtId
          : undefined,
    minutes: typeof body.minutes === "number" ? body.minutes : undefined,
    afterIso:
      body.afterIso === null
        ? null
        : typeof body.afterIso === "string"
          ? body.afterIso
          : undefined,
    refTeamId:
      body.refTeamId === null
        ? null
        : typeof body.refTeamId === "string"
          ? body.refTeamId
          : undefined,
    clearTime: typeof body.clearTime === "boolean" ? body.clearTime : undefined,
    clearCourt: typeof body.clearCourt === "boolean" ? body.clearCourt : undefined,
  };

  const result = await executeBulkMatchOps(slug, user, payload);
  const schedule = await loadTournamentHostSchedule(slug, user);

  return jsonSuccess({
    ...result,
    schedule,
  });
}

export const PATCH = apiHandler(handleBulkMatches);
export const POST = apiHandler(handleBulkMatches);
