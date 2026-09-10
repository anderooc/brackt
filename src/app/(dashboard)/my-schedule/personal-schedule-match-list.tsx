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

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import type { PersonalScheduleMatchContract } from "@/lib/api/contracts/personal-schedule";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatTournamentDateDisplay } from "@/lib/date-iso";

const ROLE_LABELS: Record<PersonalScheduleMatchContract["role"], string> = {
  playing: "Playing",
  reffing: "Reffing",
  crew: "Officiating",
  scorekeeping: "Scorekeeping",
};

export function PersonalScheduleMatchList({
  matches,
  compact,
}: {
  matches: PersonalScheduleMatchContract[];
  compact?: boolean;
}) {
  const byDate = useMemo(() => {
    const groups = new Map<string, PersonalScheduleMatchContract[]>();
    for (const match of matches) {
      const dateKey = format(new Date(match.scheduledTime), "yyyy-MM-dd");
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(match);
    }
    return groups;
  }, [matches]);

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No upcoming matches"
        description="Matches for your teams will appear here once tournament schedules are released."
      />
    );
  }

  return (
    <div className="space-y-8">
      {[...byDate.entries()].map(([dateKey, dayMatches]) => (
        <section key={dateKey} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {format(new Date(dateKey + "T00:00:00"), "EEE, MMM d, yyyy")}
          </h2>
          <div className="list-stack border-y border-border/70">
            {dayMatches.map((match) => (
              <PersonalScheduleRow
                key={match.id}
                match={match}
                compact={compact}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PersonalScheduleRow({
  match,
  compact,
}: {
  match: PersonalScheduleMatchContract;
  compact?: boolean;
}) {
  const scheduledTime = new Date(match.scheduledTime);
  const warmupStart = match.warmupStart ? new Date(match.warmupStart) : null;
  const meta = [
    match.courtName,
    match.contextLabel || null,
    match.refTeamName ? `Ref ${match.refTeamName}` : null,
  ].filter(Boolean);

  const href = `/tournaments/${match.tournamentSlug}/matches/${match.matchSlug}`;

  return (
    <Link
      href={href}
      className="flex flex-col gap-2.5 px-1 py-3.5 transition-colors duration-150 ease-out hover:bg-muted/45 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start justify-between gap-3 sm:contents">
          <div className="flex shrink-0 flex-col gap-0.5 sm:w-[7rem]">
            <time
              dateTime={scheduledTime.toISOString()}
              className="whitespace-nowrap text-sm font-medium tabular-nums text-foreground sm:text-muted-foreground"
            >
              {format(scheduledTime, "h:mm a")}
            </time>
            {warmupStart ? (
              <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
                Warmup {format(warmupStart, "h:mm a")}
              </span>
            ) : null}
          </div>
          <StatusBadge
            kind="match"
            status={match.status}
            className="shrink-0 sm:hidden"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          {!compact ? (
            <p className="text-xs font-medium text-muted-foreground">
              {match.tournamentName}
              <span className="mx-1.5 text-muted-foreground/60">·</span>
              {formatTournamentDateDisplay(match.tournamentDate)}
            </p>
          ) : null}
          <p className="font-medium leading-snug sm:truncate">
            {match.teamAName}
            <span className="text-muted-foreground"> vs </span>
            {match.teamBName}
          </p>
          {meta.length > 0 ? (
            <p className="text-sm text-muted-foreground sm:truncate">
              {meta.join(" · ")}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Badge variant="secondary" className="text-[10px] uppercase">
              {ROLE_LABELS[match.role]}
            </Badge>
            {match.myTeamName ? (
              <span className="text-xs text-muted-foreground">
                {match.myTeamName}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <StatusBadge
        kind="match"
        status={match.status}
        className="hidden shrink-0 self-center sm:inline-flex"
      />
    </Link>
  );
}
