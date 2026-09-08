"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Maximize2,
  Minimize2,
  QrCode as QrIcon,
  Radio,
  Trophy,
  WifiOff,
} from "lucide-react";
import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { formatMatchTime, formatSetLine } from "@/lib/tournament-public/format";
import {
  getTournamentSnapshot,
  saveTournamentSnapshot,
} from "@/lib/offline/offline-storage";
import { QrCode } from "@/components/ui/qr-code";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROTATE_MS = 14_000;
const POLL_MS = 8_000;

type KioskViewFilter = "all" | "live" | "upcoming" | "completed";

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [viewFilter, setViewFilter] = useState<KioskViewFilter>("all");
  const [currentTime, setCurrentTime] = useState<string>("");

  // Clock in header for gym wall projector
  useEffect(() => {
    function updateClock() {
      setCurrentTime(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date())
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Distinct courts list
  const availableCourts = useMemo(() => {
    const set = new Set<string>();
    for (const match of matches) {
      if (match.courtName) set.add(match.courtName);
    }
    return Array.from(set).sort();
  }, [matches]);

  // Filter matches based on selected court and viewFilter
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (selectedCourt !== "all" && match.courtName !== selectedCourt) {
        return false;
      }
      if (viewFilter === "live") return match.status === "in_progress";
      if (viewFilter === "upcoming") return match.status === "upcoming";
      if (viewFilter === "completed") return match.status === "completed";
      return true; // 'all'
    });
  }, [matches, selectedCourt, viewFilter]);

  // Prioritize active live matches at the front when in "all" mode
  const orderedMatches = useMemo(() => {
    if (viewFilter !== "all") return filteredMatches;

    const live = filteredMatches.filter((m) => m.status === "in_progress");
    const upcoming = filteredMatches.filter((m) => m.status === "upcoming");
    const completed = filteredMatches.filter((m) => m.status === "completed");

    return [...live, ...upcoming, ...completed];
  }, [filteredMatches, viewFilter]);

  // Page chunks: 4 matches per page in projector view
  const pageSize = 4;
  const pages = Math.max(1, Math.ceil(orderedMatches.length / pageSize));
  const visible = orderedMatches.slice(page * pageSize, page * pageSize + pageSize);

  // Sync snapshot
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

  // Auto-rotate through pages
  useEffect(() => {
    if (pages <= 1) return;
    const rotate = window.setInterval(() => {
      setPage((current) => (current + 1) % pages);
    }, ROTATE_MS);
    return () => window.clearInterval(rotate);
  }, [pages]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [selectedCourt, viewFilter]);

  // Fullscreen toggle handler
  function toggleFullscreen() {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const fullShareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/explore/tournaments/${slug}/scores`
      : `https://brack-t.com/explore/tournaments/${slug}/scores`;

  const liveCount = matches.filter((m) => m.status === "in_progress").length;

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-primary/30">
      {/* Top Banner / Broadcast Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/80 px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href={`/explore/tournaments/${slug}/scores`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
              title="Exit Kiosk Mode"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">
                  Live Court Board {liveCount > 0 && `• ${liveCount} Active`}
                </p>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                {tournamentName}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {currentTime && (
              <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-1.5 text-xs font-mono text-zinc-300">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>{currentTime}</span>
              </div>
            )}

            {isOffline && (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Gym offline</span>
              </div>
            )}

            {/* QR Scan Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowQrModal(true)}
              className="h-8 gap-1.5 border-zinc-700 bg-zinc-800/80 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white"
            >
              <QrIcon className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline">Phone QR</span>
            </Button>

            {/* Projector Fullscreen Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 gap-1.5 border-zinc-700 bg-zinc-800/80 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-white"
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Exit Fullscreen</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Fullscreen</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Filters bar: View (All / Live / Upcoming / Final) and Court Selection */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-800/60 pt-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setViewFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                viewFilter === "all"
                  ? "bg-primary text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              All Matches ({matches.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("live")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                viewFilter === "live"
                  ? "bg-primary text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              Live ({matches.filter((m) => m.status === "in_progress").length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("upcoming")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                viewFilter === "upcoming"
                  ? "bg-primary text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              Upcoming ({matches.filter((m) => m.status === "upcoming").length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("completed")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors",
                viewFilter === "completed"
                  ? "bg-primary text-white"
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              )}
            >
              Final ({matches.filter((m) => m.status === "completed").length})
            </button>
          </div>

          {availableCourts.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto max-w-full">
              <span className="text-zinc-400 text-[11px] font-medium mr-1">
                Court:
              </span>
              <button
                type="button"
                onClick={() => setSelectedCourt("all")}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                  selectedCourt === "all"
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                )}
              >
                All
              </button>
              {availableCourts.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCourt(c)}
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                    selectedCourt === c
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Broadcast Grid */}
      <main className="flex flex-1 flex-col justify-center p-4 sm:p-6 lg:p-8">
        {visible.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 text-center space-y-3">
            <Trophy className="mx-auto h-10 w-10 text-zinc-600" />
            <h2 className="text-lg font-bold text-white">No matches scheduled</h2>
            <p className="text-sm text-zinc-400">
              Matches will automatically appear once court assignments and pools are active.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2 flex-1 items-stretch">
            {visible.map((match) => (
              <KioskMatchCard key={match.slug} match={match} />
            ))}
          </div>
        )}
      </main>

      {/* Floating spectator QR Code card in corner for viewers looking at projector */}
      <aside
        aria-label="Spectator QR Code"
        className="fixed bottom-4 right-4 z-30 hidden lg:flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/95 p-2.5 shadow-2xl backdrop-blur-md"
      >
        <QrCode
          value={fullShareUrl}
          size={56}
          margin={0}
          className="p-1 rounded bg-white shadow-sm shrink-0"
          ariaLabel="QR code to open mobile scoreboard"
        />
        <div className="pr-1 text-left">
          <p className="text-[11px] font-bold text-white leading-tight">
            Scan for mobile scores
          </p>
          <p className="text-[10px] text-zinc-400 leading-tight">
            Follow brackets & court updates
          </p>
        </div>
      </aside>

      {/* Footer / Pagination Dots */}
      <footer className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-900/60 px-6 py-3">
        <p className="text-xs text-zinc-400">
          Page {page + 1} of {pages} ({orderedMatches.length} matches)
        </p>

        {pages > 1 && (
          <div className="flex gap-2">
            {Array.from({ length: pages }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setPage(index)}
                aria-label={`Go to page ${index + 1}`}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  index === page
                    ? "w-8 bg-primary"
                    : "w-2.5 bg-zinc-700 hover:bg-zinc-600"
                )}
              />
            ))}
          </div>
        )}

        <div className="text-right">
          <span className="text-[11px] text-zinc-400">brackt</span>
        </div>
      </footer>

      {/* Full QR Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">
              Scan for Tournament Scoreboard
            </h3>
            <p className="text-xs text-zinc-300">
              Point your phone camera here to get court schedules, live points, and bracket standings.
            </p>
            <div className="flex justify-center py-2">
              <QrCode
                value={fullShareUrl}
                size={220}
                className="bg-white p-3 shadow-lg rounded-xl"
                ariaLabel="Large QR code for mobile scoreboard"
              />
            </div>
            <p className="text-xs font-mono text-zinc-400 break-all">
              {fullShareUrl}
            </p>
            <Button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full text-xs"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function KioskMatchCard({ match }: { match: TournamentMatchContract }) {
  const setLine = formatSetLine(match.sets);
  const isLive = match.status === "in_progress";
  const isCompleted = match.status === "completed";

  const meta = [
    match.courtName,
    match.scheduledTime && formatMatchTime(match.scheduledTime),
    match.divisionName,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <article
      className={cn(
        "flex flex-col justify-between rounded-2xl border p-5 sm:p-6 transition-all duration-300",
        isLive
          ? "border-primary/60 bg-gradient-to-b from-primary/15 to-primary/5 shadow-lg shadow-primary/10"
          : isCompleted
          ? "border-zinc-800/80 bg-zinc-900/40"
          : "border-zinc-800 bg-zinc-900/80"
      )}
    >
      <div>
        {/* Card Header Status */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase",
              isLive
                ? "bg-red-500/20 text-red-400"
                : isCompleted
                ? "bg-zinc-800 text-zinc-400"
                : "bg-zinc-800 text-zinc-300"
            )}
          >
            {isLive ? (
              <>
                <Radio className="h-3 w-3 animate-pulse text-red-400" />
                <span>Live on Court</span>
              </>
            ) : isCompleted ? (
              <span>Final</span>
            ) : (
              <span>Scheduled</span>
            )}
          </span>

          {meta ? (
            <span className="truncate text-xs font-medium text-zinc-400">
              {meta}
            </span>
          ) : null}
        </div>

        {/* Teams and Set Scores */}
        <div className="space-y-3">
          <ScoreLine
            name={match.teamA?.name ?? "TBD"}
            won={match.winnerSlug === match.teamA?.slug}
            live={isLive}
          />
          <ScoreLine
            name={match.teamB?.name ?? "TBD"}
            won={match.winnerSlug === match.teamB?.slug}
            live={isLive}
          />
        </div>
      </div>

      {/* Set Scores Bar */}
      {setLine ? (
        <div className="mt-4 border-t border-zinc-800/60 pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-zinc-400 uppercase tracking-wider text-[11px]">
              Set Scores:
            </span>
            <span className="font-mono font-bold text-white text-sm tracking-widest">
              {setLine}
            </span>
          </div>
        </div>
      ) : match.status === "upcoming" ? (
        <div className="mt-4 border-t border-zinc-800/60 pt-2 text-right">
          <span className="text-[11px] text-zinc-400">Awaiting warm-ups</span>
        </div>
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
    <div className="flex items-center justify-between gap-3">
      <p
        className={cn(
          "truncate text-2xl sm:text-3xl font-extrabold tracking-tight",
          won && "text-white drop-shadow-sm",
          live && !won && "text-zinc-100",
          !live && !won && "text-zinc-400"
        )}
      >
        {name}
      </p>
      {won && (
        <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-bold uppercase text-primary">
          Win
        </span>
      )}
    </div>
  );
}
