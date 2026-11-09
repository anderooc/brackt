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

import { Calendar, User } from "lucide-react";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { TournamentLocationLink } from "@/components/tournament-location-link";
import { cn } from "@/lib/utils";

/** Single-line date and venue under a tournament title. */
export function TournamentSummaryLine({
  location,
  address,
  date,
  className,
}: {
  location: string;
  address?: string | null;
  date: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground",
        className
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5">
        <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {formatTournamentDateDisplay(date)}
      </span>
      <TournamentLocationLink
        location={location}
        address={address}
        className="min-w-0"
        showExternalIcon={false}
      />
    </div>
  );
}

/** Venue, date, and organizer lines shared by tournament detail headers. */
export function TournamentHeaderMeta({
  location,
  address,
  date,
  organizerName,
  compact = false,
  className,
}: {
  location: string;
  address?: string | null;
  date: string;
  organizerName: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "space-y-1 text-muted-foreground",
        compact ? "text-xs" : "text-sm",
        className
      )}
    >
      <TournamentLocationLink
        location={location}
        address={address}
        className="flex w-full max-w-full min-w-0"
      />
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-3 sm:gap-y-1">
        <span className="flex min-w-0 max-w-full items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{formatTournamentDateDisplay(date)}</span>
        </span>
        <span className="flex min-w-0 max-w-full items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{organizerName}</span>
        </span>
      </div>
    </div>
  );
}
