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
import { updateTournamentHostListing } from "@/lib/api/queries/tournament-host-admin";
import { jsonSuccess } from "@/lib/api/response";

interface RouteContext {
  params: Promise<{ slug: string }>;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export const PATCH = apiHandler(async (request: Request, context: RouteContext) => {
  const { user } = await requireViewer(request);
  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body.location !== "string") {
    throw badRequest("location is required.");
  }
  if (body.name !== undefined && typeof body.name !== "string") {
    throw badRequest("name must be a string.");
  }

  return jsonSuccess(
    await updateTournamentHostListing(slug, user, {
      name: body.name as string | undefined,
      description: optionalString(body.description),
      location: body.location,
      address: optionalString(body.address),
    })
  );
});
