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
import { loadSchoolListForViewer } from "@/lib/api/queries/schools";
import { createSchoolForViewer } from "@/lib/api/queries/school-create";
import { jsonSuccess } from "@/lib/api/response";
import { TEAM_REGIONS } from "@/lib/constants/team";
import { createSchoolSchema } from "@/lib/validators";
import type { SchoolVerificationStatus } from "@/types";

function parseListParam<T extends string>(
  value: string | null,
  allowed: readonly T[]
): T[] | undefined {
  if (!value?.trim()) return undefined;
  const set = new Set(allowed);
  const items = value
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is T => set.has(part as T));
  return items.length > 0 ? items : undefined;
}

export const GET = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const params = new URL(request.url).searchParams;
  const limitRaw = Number.parseInt(params.get("limit") ?? "24", 10);
  const offsetRaw = Number.parseInt(params.get("offset") ?? "0", 10);

  return jsonSuccess(
    await loadSchoolListForViewer(user, {
      query: params.get("q") ?? undefined,
      genders: parseListParam(params.get("gender"), ["mens", "womens"] as const),
      regions: parseListParam(params.get("region"), TEAM_REGIONS),
      verificationStatuses: parseListParam(params.get("verification"), [
        "pending",
        "verified",
        "rejected",
      ] as const satisfies readonly SchoolVerificationStatus[]),
      limit: Number.isFinite(limitRaw) ? limitRaw : 24,
      offset: Number.isFinite(offsetRaw) ? offsetRaw : 0,
    })
  );
});

export const POST = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) throw badRequest("Request body is required.");

  const parsed = createSchoolSchema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0].message);
  }

  return jsonSuccess(await createSchoolForViewer(user, parsed.data));
});
