/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import Link from "next/link";
import type { TournamentMatchContract } from "@/lib/api/contracts/tournament";
import { cn } from "@/lib/utils";
import {
  formatMatchTime,
  formatSetLine,
  MATCH_STATUS_LABELS,
} from "@/lib/tournament-public/format";

export function PublicMatchRow({
  match,
  tournamentSlug,
  compact = false,
}: {
  match: TournamentMatchContract;
  tournamentSlug: string;
  compact?: boolean;
}) {
  const status = MATCH_STATUS_LABELS[match.status];
  const setLine = formatSetLine(match.sets);
  const isLive = match.status === "in_progress";
  const meta = [
    match.scheduledTime
      ? formatMatchTime(match.scheduledTime, match.timeZone)
      : null,
    match.courtName,
    compact ? null : match.phase === "bracket" ? "Bracket" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const content = (
    <div
      className={cn(
        "rounded-xl border p-3.5 transition-colors",
        isLive
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-semibold",
            isLive
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground"
          )}
        >
          {status}
        </span>
        {meta ? (
          <span className="truncate text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </div>

      <TeamLine
        name={match.teamA?.name ?? "TBD"}
        won={match.winnerSlug === match.teamA?.slug}
      />
      <TeamLine
        name={match.teamB?.name ?? "TBD"}
        won={match.winnerSlug === match.teamB?.slug}
      />

      {setLine ? (
        <p className="mt-2 text-xs text-muted-foreground">{setLine}</p>
      ) : null}
    </div>
  );

  return (
    <Link
      href={`/explore/tournaments/${tournamentSlug}/matches/${match.slug}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}

function TeamLine({ name, won }: { name: string; won: boolean }) {
  return (
    <p
      className={cn(
        "truncate text-sm leading-snug",
        won ? "font-semibold" : "font-medium text-foreground/90"
      )}
    >
      {name}
    </p>
  );
}
