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

import { TournamentCoverIllustration } from "@/components/brand/illustrations";
import { cn } from "@/lib/utils";

/**
 * Tournament header on the Center Court cover template: details sit on the
 * mist field, the net-and-court art fills the right side (a top band on
 * phones so long names keep the full width).
 */
export function TournamentCover({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-[var(--art-mist)] ring-1 ring-border/60",
        className
      )}
    >
      <TournamentCoverIllustration
        viewBox="640 0 560 630"
        preserveAspectRatio="xMinYMid slice"
        className="absolute inset-x-0 top-0 -z-10 h-16 w-full sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:w-[34%]"
      />
      <span
        aria-hidden
        className="absolute bottom-4 left-0 -z-10 h-1 w-16 bg-[var(--art-line)] sm:w-24"
      />
      <div className="px-5 pb-8 pt-[5.25rem] sm:py-8 sm:pl-8 sm:pr-[calc(34%+1.75rem)]">
        {children}
      </div>
    </div>
  );
}
