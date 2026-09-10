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

import { useEffect, useRef } from "react";
import { parseISODate } from "@/lib/date-iso";
import { cn } from "@/lib/utils";

function formatRailParts(iso: string, today: string) {
  const d = parseISODate(iso);
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  const monthDay = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return {
    isToday: iso === today,
    weekday: iso === today ? "Today" : weekday,
    monthDay,
  };
}

/**
 * Horizontal date strip for wide viewports. Replaces the vertical side wheel
 * on desktop so date navigation stays anchored to content instead of floating
 * in a tall empty column.
 */
export function DateRail({
  dates,
  selectedDate,
  onSelect,
  today,
  className,
}: {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  today: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const selected = selectedRef.current;
    if (!scroller || !selected) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const offset =
      selected.offsetLeft -
      scroller.clientWidth / 2 +
      selected.offsetWidth / 2;

    // Prefer instant centering on first paint; smooth only when already mounted.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    scroller.scrollTo({
      left: Math.max(0, offset),
      behavior:
        prefersReduced || selectedRect.width === 0 || scrollerRect.width === 0
          ? "auto"
          : "smooth",
    });
  }, [selectedDate, dates]);

  if (dates.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      aria-label="Date selector"
      aria-orientation="horizontal"
      className={cn(
        "flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]",
        "[mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
        className
      )}
    >
      {dates.map((iso) => {
        const isSelected = iso === selectedDate;
        const { isToday, weekday, monthDay } = formatRailParts(iso, today);

        return (
          <button
            key={iso}
            ref={isSelected ? selectedRef : undefined}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => onSelect(iso)}
            className={cn(
              "flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl px-3.5 py-2.5 text-center transition-[background-color,color,box-shadow] duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                isSelected
                  ? "text-primary-foreground/85"
                  : isToday
                    ? "text-primary"
                    : "text-muted-foreground"
              )}
            >
              {weekday}
            </span>
            <span
              className={cn(
                "mt-0.5 text-sm tabular-nums leading-none",
                isSelected ? "font-bold" : "font-medium"
              )}
            >
              {monthDay}
            </span>
          </button>
        );
      })}
    </div>
  );
}
