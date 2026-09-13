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
import {
  subscribeWebPushForViewer,
  unsubscribeWebPushForViewer,
} from "@/lib/api/queries/web-push";
import { jsonSuccess } from "@/lib/api/response";

type SubscribeBody = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  p256dh?: unknown;
  auth?: unknown;
  userAgent?: unknown;
};

function parseSubscribeBody(body: SubscribeBody | null) {
  if (!body) throw badRequest("Provide subscription payload.");

  const p256dh = body.keys?.p256dh ?? body.p256dh;
  const auth = body.keys?.auth ?? body.auth;

  return {
    endpoint: body.endpoint,
    p256dh,
    auth,
    userAgent: body.userAgent,
  };
}

export const POST = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const body = (await request.json().catch(() => null)) as SubscribeBody | null;

  return jsonSuccess(
    await subscribeWebPushForViewer(user, parseSubscribeBody(body))
  );
});

export const DELETE = apiHandler(async (request: Request) => {
  const { user } = await requireViewer(request);
  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;
  if (!body) throw badRequest("Provide endpoint.");

  return jsonSuccess(await unsubscribeWebPushForViewer(user, body.endpoint));
});
