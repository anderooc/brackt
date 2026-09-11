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

import { useCallback, useEffect, useRef, useState } from "react";
import { parseISODate } from "@/lib/date-iso";
import { cn } from "@/lib/utils";

const CLICK_SLOP_PX = 6;
/** Wheel delta that must accumulate before the selection advances one day. */
const WHEEL_DELTA_PER_DATE = 160;

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
 *
 * Supports native overflow scroll, pointer drag-to-pan, horizontal-wheel pan,
 * and vertical-wheel date stepping with resistance so trackpads don't skip.
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
  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startScrollLeft: number;
    dragged: boolean;
  }>({
    pointerId: null,
    startX: 0,
    startScrollLeft: 0,
    dragged: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickRef = useRef(false);
  const wheelAccumulatorRef = useRef(0);
  const datesRef = useRef(dates);
  const selectedDateRef = useRef(selectedDate);
  const onSelectRef = useRef(onSelect);
  datesRef.current = dates;
  selectedDateRef.current = selectedDate;
  onSelectRef.current = onSelect;

  // Keep the selected chip centered when the selection changes externally
  // (calendar, keyboard). Skip smooth motion while the user is mid-drag.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const selected = selectedRef.current;
    if (!scroller || !selected) return;
    if (dragRef.current.pointerId !== null) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const selectedRect = selected.getBoundingClientRect();
    const offset =
      selected.offsetLeft -
      scroller.clientWidth / 2 +
      selected.offsetWidth / 2;

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

  // Non-passive wheel: vertical steps the selected date (with resistance);
  // horizontal pans the chip strip when it overflows.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      const target = el;
      if (!target) return;

      const dominantX = Math.abs(e.deltaX) >= Math.abs(e.deltaY);

      if (dominantX) {
        const canScroll = target.scrollWidth > target.clientWidth + 1;
        if (!canScroll) return;
        if (Math.abs(e.deltaX) < 1) return;

        const atStart = target.scrollLeft <= 0;
        const atEnd =
          target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;
        const towardEdge = e.deltaX > 0 ? atEnd : atStart;
        if (towardEdge) return;

        e.preventDefault();
        e.stopPropagation();
        target.scrollLeft += e.deltaX;
        return;
      }

      if (Math.abs(e.deltaY) < 1) return;

      const list = datesRef.current;
      if (list.length === 0) return;

      const i = list.indexOf(selectedDateRef.current);
      const safeI = i === -1 ? 0 : i;

      wheelAccumulatorRef.current += e.deltaY;

      let steps = 0;
      while (wheelAccumulatorRef.current >= WHEEL_DELTA_PER_DATE) {
        steps += 1;
        wheelAccumulatorRef.current -= WHEEL_DELTA_PER_DATE;
      }
      while (wheelAccumulatorRef.current <= -WHEEL_DELTA_PER_DATE) {
        steps -= 1;
        wheelAccumulatorRef.current += WHEEL_DELTA_PER_DATE;
      }

      if (steps === 0) {
        // Consume the gesture while building resistance so the page doesn't
        // scroll under the cursor mid-intent.
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const next = Math.max(0, Math.min(list.length - 1, safeI + steps));
      if (next === safeI) {
        wheelAccumulatorRef.current = 0;
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const nextDate = list[next];
      if (nextDate) onSelectRef.current(nextDate);
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const endDrag = useCallback((pointerId: number) => {
    const s = dragRef.current;
    if (s.pointerId !== pointerId) return;

    if (s.dragged) {
      suppressClickRef.current = true;
      // Clear on next tick so the synthetic click from pointerup is ignored.
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }

    dragRef.current = {
      pointerId: null,
      startX: 0,
      startScrollLeft: 0,
      dragged: false,
    };
    setIsDragging(false);
    scrollerRef.current?.releasePointerCapture(pointerId);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const el = scrollerRef.current;
      if (!el) return;
      if (el.scrollWidth <= el.clientWidth + 1) return;

      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
        dragged: false,
      };
      el.setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragRef.current;
      if (s.pointerId !== e.pointerId) return;
      const el = scrollerRef.current;
      if (!el) return;

      const dx = e.clientX - s.startX;
      if (!s.dragged && Math.abs(dx) > CLICK_SLOP_PX) {
        s.dragged = true;
        setIsDragging(true);
      }
      if (!s.dragged) return;

      el.scrollLeft = s.startScrollLeft - dx;
      e.preventDefault();
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e.pointerId);
    },
    [endDrag]
  );

  const handleSelect = useCallback(
    (iso: string) => {
      if (suppressClickRef.current || dragRef.current.dragged) return;
      onSelect(iso);
    },
    [onSelect]
  );

  if (dates.length === 0) return null;

  return (
    <div
      ref={scrollerRef}
      role="listbox"
      aria-label="Date selector"
      aria-orientation="horizontal"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "flex gap-1.5 overflow-x-auto overscroll-x-contain touch-pan-x pb-1 [scrollbar-width:thin]",
        "select-none [mask-image:linear-gradient(to_right,transparent,black_0.75rem,black_calc(100%-0.75rem),transparent)]",
        isDragging ? "cursor-grabbing" : "cursor-grab",
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
            onClick={() => handleSelect(iso)}
            className={cn(
              "flex min-w-[5.25rem] shrink-0 flex-col items-center justify-center rounded-xl px-3.5 py-2.5 text-center transition-[background-color,color,box-shadow] duration-150",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              // Avoid the browser treating a drag-start on a button as text
              // selection / native image drag.
              "touch-manipulation",
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
