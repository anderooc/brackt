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

import { useEffect } from "react";
import { OfflineIndicator } from "./offline-indicator";
import { PwaInstallBanner } from "./pwa-install-banner";
import { PwaUpdatePrompt } from "./pwa-update-prompt";

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          // Periodically check for updates every 30 minutes if tab is active
          const interval = setInterval(() => {
            registration.update().catch(() => {});
          }, 1000 * 60 * 30);

          return () => clearInterval(interval);
        })
        .catch((error) => {
          // Do not crash the app if service worker registration fails
          if (process.env.NODE_ENV === "development") {
            console.debug("PWA service worker registration skipped/failed:", error);
          }
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker, { once: true });
    }
  }, []);

  return (
    <>
      {children}
      <OfflineIndicator />
      <PwaInstallBanner />
      <PwaUpdatePrompt />
    </>
  );
}
