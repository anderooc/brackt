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

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  formatISODateLabel,
  getCalendarMonthBounds,
  parseISODate,
  toISODate,
} from "@/lib/date-iso";
import { cn } from "@/lib/utils";

/** Tighter layout via CSS vars only — avoids overriding required flex/grid classNames. */
const COMPACT_CALENDAR_CLASS =
  "p-1.5 [--cell-size:1.625rem] [--cell-radius:var(--radius-sm)]";

export type DatePickerCalendarProps = {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  /** ISO dates (YYYY-MM-DD) that extend the year dropdown when scheduled later. */
  rangeFromDates?: string[];
  /** Dates highlighted with a dot (e.g. days that have tournaments). */
  markedDates?: Date[];
  month?: Date;
  onMonthChange?: (month: Date) => void;
  /** Earliest selectable date (YYYY-MM-DD); earlier days are disabled. */
  minDate?: string;
  className?: string;
  autoFocus?: boolean;
};

/** Shared brackt calendar: month/year dropdowns, current-year start, no outside days. */
export function DatePickerCalendar({
  selected,
  onSelect,
  rangeFromDates = [],
  markedDates,
  month: monthProp,
  onMonthChange,
  minDate,
  className,
  autoFocus,
}: DatePickerCalendarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { startMonth, endMonth, today } = useMemo(
    () => getCalendarMonthBounds(rangeFromDates),
    [rangeFromDates]
  );

  const [internalMonth, setInternalMonth] = useState(() =>
    selected ?? parseISODate(today)
  );
  const month = monthProp ?? internalMonth;
  const setMonth = onMonthChange ?? setInternalMonth;

  useEffect(() => {
    if (monthProp !== undefined || !selected) return;
    queueMicrotask(() => setInternalMonth(selected));
  }, [selected, monthProp]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.stopPropagation();
    }

    function onTouchMove(e: TouchEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("select")) return;
      e.preventDefault();
    }

    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  return (
    <div ref={rootRef} className="overscroll-contain">
      <Calendar
        mode="single"
        showOutsideDays={false}
        captionLayout="dropdown"
        navLayout="after"
        hideNavigation
        reverseYears
        startMonth={startMonth}
        endMonth={endMonth}
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={onSelect}
        disabled={minDate ? { before: parseISODate(minDate) } : undefined}
        modifiers={
          markedDates?.length ? { marked: markedDates } : undefined
        }
        modifiersClassNames={{
          marked:
            "relative after:absolute after:bottom-0.5 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary",
        }}
        className={cn(COMPACT_CALENDAR_CLASS, className)}
        autoFocus={autoFocus}
      />
    </div>
  );
}

type DatePickerFieldProps = {
  id?: string;
  label?: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  /** For native form posts (e.g. create tournament). */
  name?: string;
  required?: boolean;
  markedDates?: Date[];
  rangeFromDates?: string[];
  /** Earliest selectable date (YYYY-MM-DD). */
  minDate?: string;
  className?: string;
  /** Where the calendar opens relative to the trigger. */
  placement?: "top" | "bottom" | "auto";
};

const PANEL_GAP_PX = 4;
/** Approximate height before the panel mounts; used for first paint only. */
const PANEL_ESTIMATED_HEIGHT_PX = 320;

function resolvePlacement(
  placement: "top" | "bottom" | "auto",
  triggerRect: DOMRect,
  panelHeight: number
): "top" | "bottom" {
  if (placement === "top") return "top";
  if (placement === "bottom") return "bottom";

  const spaceBelow = window.innerHeight - triggerRect.bottom - PANEL_GAP_PX;
  const spaceAbove = triggerRect.top - PANEL_GAP_PX;
  if (spaceBelow >= panelHeight) return "bottom";
  if (spaceAbove >= panelHeight) return "top";
  return spaceAbove >= spaceBelow ? "top" : "bottom";
}

/** Form field: labeled trigger opens the shared calendar in a fixed portal. */
export function DatePickerField({
  id,
  label,
  value,
  onChange,
  disabled,
  name,
  required,
  markedDates,
  rangeFromDates = [],
  minDate,
  className,
  placement = "auto",
}: DatePickerFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [month, setMonth] = useState(() =>
    value ? parseISODate(value) : new Date()
  );

  const displayLabel = value
    ? formatISODateLabel(value, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight =
      panelRef.current?.offsetHeight || PANEL_ESTIMATED_HEIGHT_PX;
    const side = resolvePlacement(placement, rect, panelHeight);
    const top =
      side === "top"
        ? rect.top - panelHeight - PANEL_GAP_PX
        : rect.bottom + PANEL_GAP_PX;

    const maxLeft = Math.max(8, window.innerWidth - (panelRef.current?.offsetWidth ?? 280) - 8);
    const left = Math.min(Math.max(8, rect.left), maxLeft);

    setPanelStyle({
      top: Math.max(8, Math.min(top, window.innerHeight - panelHeight - 8)),
      left,
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
    requestAnimationFrame(() => updatePanelPosition());
  }, [open, value, placement, updatePanelPosition]);

  function openPanel() {
    setMonth(value ? parseISODate(value) : new Date());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onLayoutChange() {
      updatePanelPosition();
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onLayoutChange);
    window.addEventListener("scroll", onLayoutChange, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onLayoutChange);
      window.removeEventListener("scroll", onLayoutChange, true);
    };
  }, [open, updatePanelPosition]);

  function handleSelect(date: Date | undefined) {
    if (!date) return;
    onChange(toISODate(date));
    setOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.blur();
    });
  }

  const calendarPanel =
    open && panelStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date"
            className="fixed z-50 w-auto rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-md ring-1 ring-foreground/10"
            style={{ top: panelStyle.top, left: panelStyle.left }}
          >
            <DatePickerCalendar
              selected={value ? parseISODate(value) : undefined}
              onSelect={handleSelect}
              markedDates={markedDates}
              rangeFromDates={
                value ? [...rangeFromDates, value] : rangeFromDates
              }
              month={month}
              onMonthChange={setMonth}
              minDate={minDate}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <div className={cn("space-y-2", className)}>
      {name && (
        <input type="hidden" name={name} value={value} required={required} />
      )}
      {label && <Label htmlFor={id}>{label}</Label>}
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "h-8 w-full justify-start gap-2 font-normal",
          !value && "text-muted-foreground",
          open && "bg-muted text-foreground"
        )}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openPanel();
        }}
      >
        <CalendarIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">{displayLabel}</span>
      </Button>
      {calendarPanel}
    </div>
  );
}
