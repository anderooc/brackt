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

import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiSuccessBody,
} from "@/lib/api/contracts/envelope";
import { supabase } from "~/auth/supabase";
import { API_BASE_URL } from "./config";

/** Mirrors the server's error envelope; carries the code the UI branches on. */
export class ApiClientError extends Error {
  readonly code: ApiErrorCode | "network_error" | "malformed_response";
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(
    code: ApiClientError["code"],
    message: string,
    status: number,
    details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when signing the user out is the correct response. */
  get isAuthFailure(): boolean {
    return this.code === "unauthorized" || this.code === "forbidden";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Send the access token. Public endpoints can skip it. */
  authenticated?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorBody).error?.code === "string"
  );
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A proxy, captive portal, or crash page can return HTML with any status.
    throw new ApiClientError(
      "malformed_response",
      "The server returned an unreadable response.",
      response.status
    );
  }
}

async function performRequest(
  path: string,
  options: RequestOptions
): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.authenticated !== false) {
    const token = await accessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    // Gyms have famously bad reception; this is the common case, not an edge.
    throw new ApiClientError(
      "network_error",
      "Can't reach brackt. Check your connection and try again.",
      0
    );
  }
}

/**
 * Called after the server rejects our token. Returns true when a refreshed
 * token is available to retry with. If the session can't be refreshed it is
 * dropped locally, so the app shows its signed-out state instead of a string of
 * permission errors.
 */
async function recoverFromRejectedSession(): Promise<boolean> {
  if (!(await accessToken())) return false;
  const { data, error } = await supabase.auth.refreshSession();
  if (!error && data.session) return true;
  // Only an explicit auth rejection ends the session; a network blip must not.
  if (error && error.status !== undefined && error.status >= 400 && error.status < 500) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
  return false;
}

/**
 * Issues a request and unwraps the response envelope.
 *
 * A 401 triggers one forced refresh and a single retry.
 * Supabase refreshes on its own timer, but that timer is paused while the app
 * is backgrounded, so the first request after resuming can legitimately race a
 * expiring token.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  let response = await performRequest(path, options);
  let body = await parseBody(response);

  if (response.status === 401 && options.authenticated !== false) {
    if (await recoverFromRejectedSession()) {
      response = await performRequest(path, options);
      body = await parseBody(response);
    }
  }

  if (!response.ok) {
    if (isErrorBody(body)) {
      throw new ApiClientError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.details
      );
    }
    throw new ApiClientError(
      "malformed_response",
      `Request failed with status ${response.status}.`,
      response.status
    );
  }

  const success = body as ApiSuccessBody<T> | null;
  if (!success || !("data" in success)) {
    throw new ApiClientError(
      "malformed_response",
      "The server response was missing its payload.",
      response.status
    );
  }

  return success.data;
}

/**
 * Authenticated binary download (PDF). These routes intentionally skip the
 * JSON envelope so native clients can hand the bytes to the share sheet.
 */
export async function apiDownload(
  path: string,
  options: { signal?: AbortSignal } = {}
): Promise<{ bytes: ArrayBuffer; contentType: string; filename: string | null }> {
  let response = await performRequest(path, {
    authenticated: true,
    signal: options.signal,
  });

  if (response.status === 401) {
    if (await recoverFromRejectedSession()) {
      response = await performRequest(path, {
        authenticated: true,
        signal: options.signal,
      });
    }
  }

  if (!response.ok) {
    // Some download routes answer errors with plain text rather than the envelope.
    const text = await response.text().catch(() => "");
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      if (text && text.length < 300 && !text.trimStart().startsWith("<")) {
        throw new ApiClientError(
          response.status === 403 ? "forbidden" : "malformed_response",
          text,
          response.status
        );
      }
    }
    if (isErrorBody(body)) {
      throw new ApiClientError(
        body.error.code,
        body.error.message,
        response.status,
        body.error.details
      );
    }
    throw new ApiClientError(
      "malformed_response",
      `Download failed with status ${response.status}.`,
      response.status
    );
  }

  const disposition = response.headers.get("Content-Disposition");
  const filenameMatch = disposition?.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  const filename = filenameMatch
    ? decodeURIComponent(filenameMatch[1].replace(/"/g, ""))
    : null;

  return {
    bytes: await response.arrayBuffer(),
    contentType: response.headers.get("Content-Type") ?? "application/octet-stream",
    filename,
  };
}
