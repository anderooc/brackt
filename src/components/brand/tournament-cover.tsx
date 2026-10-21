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

import { CoverScene } from "@/components/brand/cover-scene";
import { cn } from "@/lib/utils";

/**
 * Tournament header: details on the left over a soft court-blue wash, the
 * court-and-net scene on the right (above the details on phones).
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
        "relative isolate overflow-hidden rounded-2xl bg-[var(--art-mist)] bg-hero-wash ring-1 ring-border/60 sm:flex sm:min-h-56 sm:items-center",
        className
      )}
    >
      {/* Sized from the cover's width, not its height: wrapped text makes
          the cover taller, and a height-driven scene would widen into it. */}
      <CoverScene
        preserveAspectRatio="xMidYMax meet"
        className="absolute inset-x-0 top-2 -z-10 mx-auto h-40 w-full sm:inset-x-auto sm:-bottom-4 sm:right-1 sm:top-auto sm:h-auto sm:max-h-[calc(100%+0.5rem)] sm:w-[38%]"
      />
      <div className="w-full px-5 pb-6 pt-[11.5rem] sm:py-8 sm:pl-8 sm:pr-[42%]">
        {children}
      </div>
    </div>
  );
}
