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

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  if (!showUpdate || !waitingWorker) {
    return null;
  }

  function handleUpdate() {
    waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    setShowUpdate(false);
  }

  return (
    <aside
      aria-label="App update available"
      className="fixed top-4 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-primary/30 bg-card/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-4"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight text-foreground">
          Update available
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          A new version of brackt is ready.
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          size="sm"
          onClick={handleUpdate}
          className="h-7 text-xs px-2.5"
        >
          Reload
        </Button>
        <button
          type="button"
          onClick={() => setShowUpdate(false)}
          className="rounded p-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Dismiss update notification"
        >
          ×
        </button>
      </div>
    </aside>
  );
}
