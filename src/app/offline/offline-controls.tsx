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

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Compass,
  HelpCircle,
  RefreshCw,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function OfflineControls() {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : false
  );
  const [isChecking, startChecking] = useTransition();
  const [lastCheckMessage, setLastCheckMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setLastCheckMessage("Connection restored! You can reload now.");
    }
    function handleOffline() {
      setIsOnline(false);
      setLastCheckMessage("Still offline. Check your gym connection.");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  function handleCheckConnection() {
    startChecking(async () => {
      try {
        // Fast ping to verify actual internet connectivity
        const res = await fetch("/api/v1/schedule", {
          method: "HEAD",
          cache: "no-store",
        });
        if (res.ok || res.status < 500) {
          setIsOnline(true);
          setLastCheckMessage("Connected! Reloading page...");
          window.location.reload();
          return;
        }
      } catch {
        // Network error -> still offline
      }

      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        setLastCheckMessage("Connected to local network. Reloading...");
        window.location.reload();
      } else {
        setLastCheckMessage("Still offline. Try moving closer to gym exits or host Wi-Fi.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Live connectivity status badge */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Badge
          variant="outline"
          className={cn(
            "px-3 py-1 text-xs font-medium transition-colors",
            isOnline
              ? "border-success/40 bg-success/10 text-success"
              : "border-warning/40 bg-warning/10 text-warning"
          )}
        >
          {isOnline ? (
            <>
              <Wifi className="mr-1.5 h-3.5 w-3.5" />
              Connection detected
            </>
          ) : (
            <>
              <WifiOff className="mr-1.5 h-3.5 w-3.5" />
              Offline mode (gym connection lost)
            </>
          )}
        </Badge>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCheckConnection}
          disabled={isChecking}
          className="h-7 text-xs font-medium"
        >
          <RefreshCw
            className={cn("mr-1.5 h-3 w-3", isChecking && "animate-spin")}
          />
          {isChecking ? "Checking..." : "Retry connection"}
        </Button>
      </div>

      {lastCheckMessage && (
        <p className="text-center text-xs font-medium text-muted-foreground animate-in fade-in duration-200">
          {lastCheckMessage}
        </p>
      )}

      {/* Quick offline navigation cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border bg-card/60 transition-colors hover:border-primary/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Trophy className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">Live Scores & Pools</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              View recently cached tournament scores, pool standings, and bracket paths.
            </p>
            <Link
              href="/explore"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs h-8 mt-1")}
            >
              <Compass className="mr-1.5 h-3.5 w-3.5" />
              Explore saved tournaments
            </Link>
          </CardContent>
        </Card>

        <Card className="border bg-card/60 transition-colors hover:border-primary/40">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">My Match Schedule</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Review saved referee assignments, upcoming game times, and court numbers.
            </p>
            <Link
              href="/my-schedule"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full text-xs h-8 mt-1")}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              Open my schedule
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Gym mode tips callout */}
      <div className="rounded-xl border border-muted bg-muted/20 p-4 text-xs space-y-2.5">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <HelpCircle className="h-4 w-4 text-primary shrink-0" />
          <span>Why does connection drop at volleyball tournaments?</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          High school fieldhouses, convention centers, and university gyms are often surrounded by reinforced concrete and steel, which blocks cellular signals.
        </p>
        <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
          <li>Pages you have already visited remain cached on your device.</li>
          <li>Scores and match cards will automatically update once you step near a window or reconnect.</li>
          <li>For hosts and referees, offline score sheets can be synced as soon as network returns.</li>
        </ul>
      </div>

      {/* Return button */}
      <div className="flex justify-center pt-2">
        <Button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              router.back();
            } else {
              router.push("/explore");
            }
          }}
          className="text-xs"
        >
          Return to previous page
        </Button>
      </div>
    </div>
  );
}
