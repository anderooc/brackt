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
import { badRequest } from "@/lib/api/errors";
import {
  updateWaiverPlayerForViewer,
  type WaiverPlayerAction,
} from "@/lib/api/queries/tournament-ops-mutations";
import { jsonSuccess } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

const ACTIONS: readonly WaiverPlayerAction[] = ["attest", "waive", "clear"];

export const POST = apiHandler(async (request: Request, context: RouteContext) => {
  const { user } = await requireViewer(request);
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    teamSlug?: string;
    userId?: string;
    action?: string;
  } | null;
  if (!body?.teamSlug || !body.userId || !body.action) {
    throw badRequest("teamSlug, userId, and action are required.");
  }
  if (!ACTIONS.includes(body.action as WaiverPlayerAction)) {
    throw badRequest("action must be attest, waive, or clear.");
  }
  return jsonSuccess(
    await updateWaiverPlayerForViewer(slug, user, {
      teamSlug: body.teamSlug,
      userId: body.userId,
      action: body.action as WaiverPlayerAction,
    })
  );
});
