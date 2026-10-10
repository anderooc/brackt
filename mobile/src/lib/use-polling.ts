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

import { useIsFocused } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

/**
 * Repeats `tick` while the screen is focused and the app is in the foreground.
 * A tick that returns a promise is never overlapped by the next one, so slow
 * networks don't pile up requests.
 */
export function usePolling(
  tick: () => void | Promise<unknown>,
  intervalMs: number,
  enabled: boolean
): void {
  const isFocused = useIsFocused();
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled || !isFocused) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let inFlight = false;

    const run = () => {
      if (inFlight) return;
      const result = tickRef.current();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        inFlight = true;
        void (result as Promise<unknown>).finally(() => {
          inFlight = false;
        });
      }
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(run, intervalMs);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === "active") start();

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        run();
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [intervalMs, enabled, isFocused]);
}
