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
import Link from "next/link";
import { ArrowRight, Trophy, WifiOff } from "lucide-react";
import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { PublicMatchRow } from "./public-match-row";
import {
  getTournamentSnapshot,
  saveTournamentSnapshot,
} from "@/lib/offline/offline-storage";

interface OverviewLiveMatchesProps {
  slug: string;
  initialMatches: TournamentMatchContract[];
}

export function OverviewLiveMatches({
  slug,
  initialMatches,
}: OverviewLiveMatchesProps) {
  const [matches, setMatches] = useState(initialMatches);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (initialMatches && initialMatches.length > 0) {
      saveTournamentSnapshot(slug, { matches: initialMatches });
    } else {
      const cached = getTournamentSnapshot<{ matches: TournamentMatchContract[] }>(slug);
      if (cached?.data?.matches && cached.data.matches.length > 0) {
        setMatches(cached.data.matches);
        setIsOffline(true);
      }
    }
  }, [slug, initialMatches]);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOffline(true);
      return;
    }
    try {
      const response = await fetch(`/api/v1/tournaments/${slug}/matches`);
      if (!response.ok) return;
      const payload = (await response.json()) as {
        data?: { matches: TournamentMatchContract[] };
      };
      if (payload.data?.matches) {
        setMatches(payload.data.matches);
        setIsOffline(false);
        saveTournamentSnapshot(slug, { matches: payload.data.matches });
      }
    } catch {
      setIsOffline(true);
    }
  }, [slug]);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const inProgressMatches = matches.filter((m) => m.status === "in_progress");
  const completedMatches = matches.filter((m) => m.status === "completed");
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");

  // Show live in-progress matches first; if none, show recent completed or next upcoming
  const showcaseMatches =
    inProgressMatches.length > 0
      ? inProgressMatches.slice(0, 4)
      : completedMatches.length > 0
      ? completedMatches.slice(0, 3)
      : upcomingMatches.slice(0, 3);

  if (matches.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/80 bg-card/60 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {inProgressMatches.length > 0 ? (
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
          ) : (
            <Trophy className="h-4 w-4 text-primary" />
          )}
          <h2 className="text-sm font-semibold tracking-tight">
            {inProgressMatches.length > 0
              ? `Live on Court (${inProgressMatches.length})`
              : completedMatches.length > 0
              ? "Recent Match Results"
              : "Upcoming Match Schedule"}
          </h2>
          {isOffline && (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 font-medium">
              <WifiOff className="h-3 w-3" />
              Offline
            </span>
          )}
        </div>

        <Link
          href={`/explore/tournaments/${slug}/scores`}
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          View all {matches.length} matches
          <ArrowRight className="ml-1 h-3 w-3" />
        </Link>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {showcaseMatches.map((match) => (
          <PublicMatchRow
            key={match.slug}
            match={match}
            tournamentSlug={slug}
            compact
          />
        ))}
      </div>
    </section>
  );
}
