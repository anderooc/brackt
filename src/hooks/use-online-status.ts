"use client";

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

import { useCallback, useEffect, useState } from "react";

export interface OnlineStatusState {
  isOnline: boolean;
  wasOffline: boolean;
  reconnected: boolean;
  checkConnection: () => Promise<boolean>;
}

export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [reconnected, setReconnected] = useState<boolean>(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return true;

    if (!navigator.onLine) {
      setIsOnline(false);
      setWasOffline(true);
      return false;
    }

    try {
      // Lightweight verification ping with cache busting
      const response = await fetch(`/api/v1/schedule?_ping=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
      });
      const online = response.ok || response.status < 500;
      setIsOnline(online);
      if (!online) {
        setWasOffline(true);
      }
      return online;
    } catch {
      setIsOnline(false);
      setWasOffline(true);
      return false;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setReconnected(true);
      // Auto-clear reconnected banner after 4 seconds
      const timer = setTimeout(() => {
        setReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setIsOnline(false);
      setWasOffline(true);
      setReconnected(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    reconnected,
    checkConnection,
  };
}
