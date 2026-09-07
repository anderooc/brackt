"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { useCallback, useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import type {
  PublicMatchStatus,
  TournamentMatchContract,
} from "@/lib/api/contracts/tournament";
import {
  getTournamentSnapshot,
  saveTournamentSnapshot,
} from "@/lib/offline/offline-storage";
import { PublicMatchRow } from "./public-match-row";
import { cn } from "@/lib/utils";

type BoardTab = PublicMatchStatus;

const TABS: { id: BoardTab; label: string }[] = [
  { id: "in_progress", label: "Live" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Final" },
];

export function PublicScoresBoard({
  slug,
  initialMatches,
}: {
  slug: string;
  initialMatches: TournamentMatchContract[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [tab, setTab] = useState<BoardTab>("in_progress");
  const [isOfflineSnapshot, setIsOfflineSnapshot] = useState(false);

  useEffect(() => {
    if (initialMatches && initialMatches.length > 0) {
      saveTournamentSnapshot(slug, { matches: initialMatches });
    } else {
      const cached = getTournamentSnapshot<{ matches: TournamentMatchContract[] }>(slug);
      if (cached?.data?.matches && cached.data.matches.length > 0) {
        setMatches(cached.data.matches);
        setIsOfflineSnapshot(true);
      }
    }
  }, [slug, initialMatches]);

  const refresh = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setIsOfflineSnapshot(true);
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
        setIsOfflineSnapshot(false);
        saveTournamentSnapshot(slug, { matches: payload.data.matches });
      }
    } catch {
      setIsOfflineSnapshot(true);
    }
  }, [slug]);

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const grouped: Record<BoardTab, TournamentMatchContract[]> = {
    in_progress: matches.filter((match) => match.status === "in_progress"),
    upcoming: matches.filter((match) => match.status === "upcoming"),
    completed: matches.filter((match) => match.status === "completed"),
  };

  const visible = grouped[tab];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border">
        <div
          role="tablist"
          aria-label="Scoreboard"
          className="flex gap-1"
        >
          {TABS.map((item) => {
            const selected = tab === item.id;
            const count = grouped[item.id].length;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label} ({count})
              </button>
            );
          })}
        </div>

        {isOfflineSnapshot && (
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
            <WifiOff className="h-3 w-3" />
            <span className="font-medium">Offline cache</span>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {TABS.find((t) => t.id === tab)?.label.toLowerCase()} matches right
          now.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((match) => (
            <PublicMatchRow
              key={match.slug}
              match={match}
              tournamentSlug={slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
