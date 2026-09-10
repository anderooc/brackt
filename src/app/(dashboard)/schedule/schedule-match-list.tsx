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

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { MatchStatus, TeamGender, TeamRegion } from "@/types";
import { ScheduleListFilters } from "./schedule-list-filters";

export type ScheduleMatchListItem = {
  id: string;
  status: MatchStatus;
  scheduledTime: string | null;
  warmupStart: string | null;
  teamAName: string;
  teamBName: string;
  courtName: string;
  refTeamName: string | null;
  contextLabel: string;
  gender: TeamGender;
  region: TeamRegion;
};

function toggleSetValue<T extends string>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function filterMatches(
  matches: ScheduleMatchListItem[],
  genderFilter: ReadonlySet<TeamGender>,
  regionFilter: ReadonlySet<TeamRegion>
): ScheduleMatchListItem[] {
  return matches.filter((match) => {
    if (genderFilter.size > 0 && !genderFilter.has(match.gender)) return false;
    if (regionFilter.size > 0 && !regionFilter.has(match.region)) return false;
    return true;
  });
}

export function ScheduleMatchList({
  matches,
}: {
  matches: ScheduleMatchListItem[];
}) {
  const [genderFilter, setGenderFilter] = useState<Set<TeamGender>>(
    () => new Set()
  );
  const [regionFilter, setRegionFilter] = useState<Set<TeamRegion>>(
    () => new Set()
  );

  const filtered = useMemo(
    () => filterMatches(matches, genderFilter, regionFilter),
    [matches, genderFilter, regionFilter]
  );

  const byDate = useMemo(() => {
    const groups = new Map<string, ScheduleMatchListItem[]>();
    for (const match of filtered) {
      const dateKey = match.scheduledTime
        ? format(new Date(match.scheduledTime), "yyyy-MM-dd")
        : "unscheduled";
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(match);
    }
    return groups;
  }, [filtered]);

  if (matches.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No scheduled matches yet"
        description="Create a tournament and generate pools or brackets, then auto-schedule to see matches here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ScheduleListFilters
          genderFilter={genderFilter}
          regionFilter={regionFilter}
          onToggleGender={(value) =>
            setGenderFilter((prev) => toggleSetValue(prev, value))
          }
          onToggleRegion={(value) =>
            setRegionFilter((prev) => toggleSetValue(prev, value))
          }
          onClear={() => {
            setGenderFilter(new Set());
            setRegionFilter(new Set());
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No matches match these filters"
          description="Try clearing gender or region filters to see more matches."
        />
      ) : (
        <div className="space-y-8">
          {[...byDate.entries()].map(([dateKey, dayMatches]) => (
            <section key={dateKey} className="space-y-3">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {dateKey === "unscheduled"
                  ? "Unscheduled"
                  : format(
                      new Date(dateKey + "T00:00:00"),
                      "EEE, MMM d, yyyy"
                    )}
              </h2>
              <div className="list-stack border-y border-border/70">
                {dayMatches.map((match) => {
                  const scheduledTime = match.scheduledTime
                    ? new Date(match.scheduledTime)
                    : null;
                  const warmupStart = match.warmupStart
                    ? new Date(match.warmupStart)
                    : null;
                  const meta = [
                    match.courtName,
                    match.contextLabel || null,
                    match.refTeamName ? `Ref ${match.refTeamName}` : null,
                  ].filter(Boolean);

                  return (
                    <div
                      key={match.id}
                      className="flex flex-col gap-2.5 px-1 py-3.5 transition-colors duration-150 ease-out hover:bg-muted/45 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-start justify-between gap-3 sm:contents">
                          {scheduledTime ? (
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
                          ) : null}
                          <StatusBadge
                            kind="match"
                            status={match.status}
                            className="shrink-0 sm:hidden"
                          />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
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
                        </div>
                      </div>

                      <StatusBadge
                        kind="match"
                        status={match.status}
                        className="hidden shrink-0 self-center sm:inline-flex"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
