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

import { CalendarPlus } from "lucide-react";
import type { AppUser } from "@/lib/auth";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { buttonVariants } from "@/components/ui/button";
import {
  PersonalScheduleMatchList,
  UpNextMatch,
} from "@/components/schedule/personal-schedule-match-list";

export async function TournamentMyMatchesPanel({
  tournamentId,
  user,
}: {
  tournamentId: string;
  user: AppUser;
}) {
  const schedule = await loadPersonalScheduleForViewer(user, {
    tournamentId,
    includeCompleted: true,
  });
  const next = schedule.matches.find((m) => m.status !== "completed");
  const rest = schedule.matches.filter((m) => m.id !== next?.id);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          Matches your teams play or ref here, plus any officiating you’re
          assigned. Times update as the host adjusts the schedule.
        </p>
        <a
          href="/api/v1/me/schedule.ics"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <CalendarPlus className="size-4" aria-hidden />
          Add to calendar
        </a>
      </div>

      {next ? (
        <section aria-labelledby="my-matches-next" className="space-y-3">
          <h2
            id="my-matches-next"
            className="text-base font-semibold tracking-tight"
          >
            Up next
          </h2>
          <UpNextMatch match={next} showTournament={false} />
        </section>
      ) : null}

      {rest.length > 0 || !next ? (
        <section aria-labelledby="my-matches-all" className="space-y-3">
          <h2
            id="my-matches-all"
            className="text-base font-semibold tracking-tight"
          >
            {next ? "Later and finished" : "Your matches"}
          </h2>
          <PersonalScheduleMatchList
            matches={rest}
            compact
            emptyTitle="No matches yet"
            emptyDescription="Your matches show up here once the host schedules and releases them."
          />
        </section>
      ) : null}
    </div>
  );
}
