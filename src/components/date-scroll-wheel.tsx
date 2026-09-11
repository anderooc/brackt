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

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { parseISODate } from "@/lib/date-iso";
import { cn } from "@/lib/utils";

const LINE_HEIGHT_PX = 36;
const VISIBLE_RADIUS = 2;
const WHEEL_HEIGHT_PX = LINE_HEIGHT_PX * (VISIBLE_RADIUS * 2 + 1);
const WHEEL_DELTA_PER_DATE = 160;
const FADE_IDLE_MS = 1100;
const DRAG_STEP_PX = 36;
const CLICK_SLOP_PX = 6;

function subscribeMediaQuery(query: string) {
  return (onStoreChange: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener("change", onStoreChange);
    return () => mq.removeEventListener("change", onStoreChange);
  };
}

function getMediaQuerySnapshot(query: string) {
  return () => window.matchMedia(query).matches;
}

const subscribeReducedMotion = subscribeMediaQuery(
  "(prefers-reduced-motion: reduce)"
);
const getReducedMotionSnapshot = getMediaQuerySnapshot(
  "(prefers-reduced-motion: reduce)"
);
const subscribeCoarsePointer = subscribeMediaQuery("(pointer: coarse)");
const getCoarsePointerSnapshot = getMediaQuerySnapshot("(pointer: coarse)");

function formatWheelLine(iso: string, today: string) {
  const d = parseISODate(iso);
  const dateLabel = d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (iso === today) {
    return { isToday: true, label: "Today", dateLabel };
  }
  return { isToday: false, label: dateLabel, dateLabel: null };
}

export function DateScrollWheel({
  dates,
  selectedDate,
  onSelect,
  today,
  activityKey = 0,
  className,
}: {
  dates: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
  today: string;
  /** Increment when dates change outside this control (schedule scroll, keys, calendar). */
  activityKey?: number;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepAccumulatorRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number | null;
    startY: number;
    lastY: number;
    startDate: string | null;
    dragged: boolean;
  }>({
    pointerId: null,
    startY: 0,
    lastY: 0,
    startDate: null,
    dragged: false,
  });
  const [visible, setVisible] = useState(true);
  // Media queries differ on server vs device; defer idle-fade until after
  // mount so the first client paint matches SSR (wheel shown).
  const [idleFadeReady, setIdleFadeReady] = useState(false);
  const reduceMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
  const isCoarsePointer = useSyncExternalStore(
    subscribeCoarsePointer,
    getCoarsePointerSnapshot,
    () => false
  );
  const [isDragging, setIsDragging] = useState(false);

  const selectedIndex = dates.indexOf(selectedDate);

  /**
   * Fixed-size window of slots centered on the selection, padded with empty
   * slots at the ends of the range. Keeps the selected line at the wheel's
   * middle instead of drifting to an edge on the first/last date.
   */
  const slots = useMemo(() => {
    if (dates.length === 0) return [];
    const i = selectedIndex === -1 ? 0 : selectedIndex;
    const out: (string | null)[] = [];
    for (let offset = -VISIBLE_RADIUS; offset <= VISIBLE_RADIUS; offset += 1) {
      const index = i + offset;
      out.push(index >= 0 && index < dates.length ? dates[index] : null);
    }
    return out;
  }, [dates, selectedIndex]);

  const show = useCallback(() => {
    setVisible(true);
    if (!idleFadeReady || reduceMotion || isCoarsePointer) return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      hideTimerRef.current = null;
    }, FADE_IDLE_MS);
  }, [idleFadeReady, isCoarsePointer, reduceMotion]);

  const advance = useCallback(
    (delta: number) => {
      if (delta === 0) return;
      show();
      const i = dates.indexOf(selectedDate);
      const safeI = i === -1 ? 0 : i;
      const next = Math.max(0, Math.min(dates.length - 1, safeI + delta));
      const nextDate = dates[next];
      if (nextDate && nextDate !== selectedDate) onSelect(nextDate);
    },
    [dates, onSelect, selectedDate, show]
  );

  useEffect(() => {
    setIdleFadeReady(true);
  }, []);

  // Visible on first paint, then idle-fade (fine pointer). Re-show on
  // external date activity (schedule scroll, keys, calendar).
  useEffect(() => {
    if (!idleFadeReady) return;
    queueMicrotask(() => show());
  }, [activityKey, idleFadeReady, show]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (Math.abs(e.deltaY) < 1) return;
      // Accumulator lives in a ref so re-attaching this listener on each date
      // change doesn't discard leftover trackpad momentum mid-gesture.
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
      // One move for the whole event: `advance` reads the committed date, so
      // repeated single steps in a fast flick would collapse into one.
      advance(steps);
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [advance]);

  const endDrag = useCallback(
    (pointerId: number) => {
      const s = dragRef.current;
      if (s.pointerId !== pointerId) return;

      if (!s.dragged && s.startDate) {
        show();
        onSelect(s.startDate);
      }

      dragRef.current = {
        pointerId: null,
        startY: 0,
        lastY: 0,
        startDate: null,
        dragged: false,
      };
      stepAccumulatorRef.current = 0;
      setIsDragging(false);
      rootRef.current?.releasePointerCapture(pointerId);
    },
    [onSelect, show]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-date]"
      );

      show();
      dragRef.current = {
        pointerId: e.pointerId,
        startY: e.clientY,
        lastY: e.clientY,
        startDate: btn?.dataset.date ?? selectedDate,
        dragged: false,
      };
      stepAccumulatorRef.current = 0;
      rootRef.current?.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [selectedDate, show]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const s = dragRef.current;
      if (s.pointerId !== e.pointerId) return;

      const dy = e.clientY - s.lastY;
      s.lastY = e.clientY;

      if (Math.abs(e.clientY - s.startY) > CLICK_SLOP_PX) {
        if (!s.dragged) {
          s.dragged = true;
          setIsDragging(true);
        }
      }

      if (!s.dragged) return;

      stepAccumulatorRef.current += dy;

      let steps = 0;
      while (stepAccumulatorRef.current >= DRAG_STEP_PX) {
        steps += 1;
        stepAccumulatorRef.current -= DRAG_STEP_PX;
      }
      while (stepAccumulatorRef.current <= -DRAG_STEP_PX) {
        steps -= 1;
        stepAccumulatorRef.current += DRAG_STEP_PX;
      }
      advance(steps);
    },
    [advance]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e.pointerId);
    },
    [endDrag]
  );

  // Before idle-fade is armed, always show so SSR and the first client
  // paint match (media queries are not safe during hydration).
  const isShown =
    !idleFadeReady || reduceMotion || isCoarsePointer || visible;

  if (slots.length === 0) return null;

  return (
    <div
      ref={rootRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={cn(
        "flex h-[180px] w-full touch-none select-none flex-col justify-center overflow-hidden overscroll-y-none",
        "transition-opacity duration-300 ease-out",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        isShown ? "opacity-100" : "pointer-events-none opacity-0",
        className
      )}
      aria-label="Date selector"
      aria-hidden={!isShown}
    >
      <div
        className="flex flex-col items-center"
        style={{ height: WHEEL_HEIGHT_PX }}
      >
        {slots.map((iso, slotIndex) => {
          const offset = slotIndex - VISIBLE_RADIUS;
          if (!iso) {
            return (
              <div
                key={`empty-${offset}`}
                style={{ height: LINE_HEIGHT_PX }}
                className="w-full shrink-0"
                aria-hidden
              />
            );
          }

          const isSelected = iso === selectedDate;
          const { isToday, label, dateLabel } = formatWheelLine(iso, today);
          const proximity = Math.min(Math.abs(offset), 2);

          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              disabled={!isShown}
              style={{ height: LINE_HEIGHT_PX }}
              className={cn(
                "flex w-full min-w-0 shrink-0 items-center justify-center overflow-hidden border-0 bg-transparent px-1 text-center leading-tight transition-[color,opacity] duration-300 ease-out select-none",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                isSelected
                  ? "text-sm font-semibold text-foreground"
                  : proximity === 1
                    ? "text-xs text-muted-foreground/55"
                    : "text-[11px] text-muted-foreground/35"
              )}
              aria-current={isSelected ? "date" : undefined}
            >
              {isToday ? (
                <span className="flex min-w-0 items-baseline justify-center gap-1 truncate select-none">
                  <span className="shrink-0 font-semibold uppercase tracking-wide">
                    {label}
                  </span>
                  <span className="truncate">{dateLabel}</span>
                </span>
              ) : (
                <span className="w-full truncate select-none">{label}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
