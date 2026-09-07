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

import { useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { isOnline, reconnected, checkConnection } = useOnlineStatus();
  const [isChecking, startChecking] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  // If online and not recently reconnected, don't show anything
  if (isOnline && !reconnected) {
    return null;
  }

  if (dismissed && !reconnected) {
    return null;
  }

  return (
    <aside
      aria-label="Network connection status"
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[92vw] max-w-md rounded-xl p-3 shadow-xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
        isOnline
          ? "border border-success/40 bg-success/90 text-success-foreground"
          : "border border-warning/40 bg-zinc-900/95 text-zinc-100 shadow-amber-950/20"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isOnline ? "bg-white/20 text-white" : "bg-warning/20 text-warning"
            )}
          >
            {isOnline ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold leading-tight truncate">
              {isOnline ? "Back online" : "Gym Mode (Offline)"}
            </p>
            <p className="text-[11px] text-zinc-300 leading-tight truncate">
              {isOnline
                ? "Live scores & brackets resynced"
                : "Showing cached schedules & scores"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!isOnline && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                startChecking(async () => {
                  await checkConnection();
                });
              }}
              disabled={isChecking}
              className="h-7 border-zinc-700 bg-zinc-800 text-[11px] text-zinc-200 hover:bg-zinc-700 hover:text-white px-2.5"
            >
              <RefreshCw
                className={cn("mr-1 h-3 w-3", isChecking && "animate-spin")}
              />
              {isChecking ? "Checking..." : "Retry"}
            </Button>
          )}

          {!isOnline && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="text-zinc-400 hover:text-zinc-200 p-1 text-xs"
              aria-label="Dismiss offline banner"
            >
              ×
            </button>
          )}

          {isOnline && (
            <CheckCircle2 className="h-4 w-4 text-emerald-300 mr-1" />
          )}
        </div>
      </div>
    </aside>
  );
}
