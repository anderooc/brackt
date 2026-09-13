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
import { getCurrentUser } from "@/lib/auth";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";
import { PersonalScheduleMatchList } from "./personal-schedule-match-list";

export const metadata = pageMetadata("My schedule");

export const dynamic = "force-dynamic";

export default async function MySchedulePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schedule = await loadPersonalScheduleForViewer(user);

  return (
    <div className="space-y-8">
      <PageHeader
        title="My schedule"
        description="Upcoming matches for your teams, reffing assignments, and officiating roles."
        actions={
          schedule.matches.length > 0 ? (
            <a
              href="/api/v1/me/schedule.ics"
              className={buttonVariants({
                variant: "outline",
                className: "w-full sm:w-auto",
              })}
            >
              <CalendarPlus className="mr-2 h-4 w-4" />
              Add to calendar
            </a>
          ) : null
        }
      />

      <PersonalScheduleMatchList matches={schedule.matches} />
    </div>
  );
}
