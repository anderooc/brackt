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

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError } from "~/api/client";

export function messageFor(cause: unknown, fallback: string): string {
  if (cause instanceof ApiClientError && cause.code === "not_found") {
    return "This page is not posted, or the link is out of date.";
  }
  if (cause instanceof ApiClientError) return cause.message;
  return fallback;
}

export function usePublicLoader<T>(
  load: (signal?: AbortSignal) => Promise<T>,
  fallback: string
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const reload = useCallback(
    async (
      signal?: AbortSignal,
      mode: "initial" | "refresh" | "silent" = "initial"
    ) => {
      if (mode === "refresh") setIsRefreshing(true);
      try {
        if (mode !== "silent") setError(null);
        setData(await load(signal));
        setError(null);
      } catch (cause) {
        if (signal?.aborted) return;
        if (mode === "silent") return;
        setError(messageFor(cause, fallback));
        if (mode === "initial") setData(null);
      } finally {
        if (mode === "refresh") setIsRefreshing(false);
      }
    },
    [load, fallback]
  );

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  const refresh = useCallback(() => reload(undefined, "refresh"), [reload]);
  const poll = useCallback(() => reload(undefined, "silent"), [reload]);

  // Coming back to a screen (after registering, editing settings, etc.) should
  // show current data. The first focus is covered by the mount effect above.
  const focusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!focusedOnce.current) {
        focusedOnce.current = true;
        return;
      }
      void poll();
    }, [poll])
  );
  const clearError = useCallback(() => setError(null), []);

  /** Error from a refresh while earlier data is still on screen; show inline, not full-screen. */
  const refreshError = data !== null ? error : null;

  return { data, error, refreshError, isRefreshing, reload, refresh, poll, clearError };
}
