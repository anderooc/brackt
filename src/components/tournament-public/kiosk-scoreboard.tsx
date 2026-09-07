"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { WifiOff } from "lucide-react";
import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { formatMatchTime, formatSetLine } from "@/lib/tournament-public/format";
import {
  getTournamentSnapshot,
  saveTournamentSnapshot,
} from "@/lib/offline/offline-storage";
import { cn } from "@/lib/utils";

const ROTATE_MS = 12_000;
const POLL_MS = 8_000;

export function KioskScoreboard({
  slug,
  tournamentName,
  initialMatches,
}: {
  slug: string;
  tournamentName: string;
  initialMatches: TournamentMatchContract[];
}) {
  const [matches, setMatches] = useState(initialMatches);
  const [page, setPage] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  const liveMatches = useMemo(
    () => matches.filter((match) => match.status === "in_progress"),
    [matches]
  );

  const displayMatches =
    liveMatches.length > 0
      ? liveMatches
      : matches.filter((match) => match.status === "upcoming").slice(0, 8);

  const pages = Math.max(1, Math.ceil(displayMatches.length / 4));
  const visible = displayMatches.slice(page * 4, page * 4 + 4);

  useEffect(() => {
    if (initialMatches && initialMatches.length > 0) {
      saveTournamentSnapshot(slug, {
        name: tournamentName,
        matches: initialMatches,
      });
    } else {
      const cached = getTournamentSnapshot<{
        matches: TournamentMatchContract[];
      }>(slug);
      if (cached?.data?.matches && cached.data.matches.length > 0) {
        setMatches(cached.data.matches);
        setIsOffline(true);
      }
    }
  }, [slug, tournamentName, initialMatches]);

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
        saveTournamentSnapshot(slug, {
          name: tournamentName,
          matches: payload.data.matches,
        });
      }
    } catch {
      setIsOffline(true);
    }
  }, [slug, tournamentName]);

  useEffect(() => {
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(poll);
  }, [refresh]);

  useEffect(() => {
    if (pages <= 1) return;
    const rotate = window.setInterval(() => {
      setPage((current) => (current + 1) % pages);
    }, ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [pages]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-primary">
            Live scores
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {tournamentName}
          </h1>
        </div>
        {isOffline && (
          <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-500">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Gym offline mode</span>
          </div>
        )}
      </header>

      <main className="flex flex-1 flex-col justify-center gap-4 p-6">
        {visible.length === 0 ? (
          <p className="text-center text-lg text-muted-foreground">
            No matches on court right now.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((match) => (
              <KioskMatchCard key={match.slug} match={match} />
            ))}
          </div>
        )}
      </main>

      {pages > 1 && (
        <footer className="flex justify-center gap-2 pb-6">
          {Array.from({ length: pages }, (_, index) => (
            <span
              key={index}
              className={cn(
                "size-2 rounded-full",
                index === page ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </footer>
      )}
    </div>
  );
}

function KioskMatchCard({ match }: { match: TournamentMatchContract }) {
  const setLine = formatSetLine(match.sets);
  const meta = [match.courtName, match.scheduledTime && formatMatchTime(match.scheduledTime)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={cn(
        "rounded-2xl border p-5",
        match.status === "in_progress"
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      {meta ? (
        <p className="mb-3 text-sm font-medium text-muted-foreground">{meta}</p>
      ) : null}
      <ScoreLine
        name={match.teamA?.name ?? "TBD"}
        won={match.winnerSlug === match.teamA?.slug}
        live={match.status === "in_progress"}
      />
      <ScoreLine
        name={match.teamB?.name ?? "TBD"}
        won={match.winnerSlug === match.teamB?.slug}
        live={match.status === "in_progress"}
      />
      {setLine ? (
        <p className="mt-3 text-sm tabular-nums text-muted-foreground">
          {setLine}
        </p>
      ) : null}
    </article>
  );
}

function ScoreLine({
  name,
  won,
  live,
}: {
  name: string;
  won: boolean;
  live: boolean;
}) {
  return (
    <p
      className={cn(
        "truncate text-xl leading-tight sm:text-2xl",
        won && "font-bold",
        live && !won && "text-foreground/80"
      )}
    >
      {name}
    </p>
  );
}
