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

import {
  useState,
  useMemo,
  useRef,
  useCallback,
  useLayoutEffect,
  useEffect,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { TournamentHostSchoolLink } from "@/components/tournament-host-school-link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  formatISODateLabel,
  formatTournamentDateDisplay,
  parseISODate,
  toISODate,
} from "@/lib/date-iso";
import {
  TournamentListFilters,
  countActiveTournamentFilters,
} from "@/components/tournament-list-filters";
import { Calendar, MapPin, Search, Trophy } from "lucide-react";
import { ViewportSplit } from "@/components/layout/viewport-split";
import { DateRail } from "@/components/date-rail";
import { DateScrollWheel } from "@/components/date-scroll-wheel";
import { cn } from "@/lib/utils";
import { isTournamentArchived, todayISO } from "@/lib/tournament-status";
import { takeTournamentScheduleFocus } from "@/lib/tournaments/schedule-focus";
import type { TeamGender, TeamRegion } from "@/types";
import type { TournamentHostSchool } from "@/lib/tournaments/host-school";
import type { PublicRegistrationAvailability } from "@/lib/tournaments/public-projection";
import { registrationAvailabilityOpen } from "@/lib/tournaments/public-refresh-policy";

const DatePickerCalendar = dynamic(
  () =>
    import("@/components/date-picker").then((mod) => ({
      default: mod.DatePickerCalendar,
    })),
  {
    loading: () => <div className="h-[280px] w-[280px]" aria-hidden />,
  }
);

/** Min height for the selected-day panel so empty and tournament days match. */
const SELECTED_PANEL_MIN_H =
  "min-h-[5.5rem] min-w-0 w-full max-w-full";

/**
 * Desktop selected-day list: room for the page chrome, date rail, and
 * selected-day heading, then scroll inside the day pane.
 */
const DESKTOP_LIST_MAX_H = "max-h-[calc(100dvh-20rem)]";

/**
 * Mobile-only vertical wheel height. Sized to the picker itself so it no
 * longer stretches into a tall empty shaft on tall phones / split panes.
 */
const MOBILE_WHEEL_H = "h-[11.25rem]";

/** Enter animation for rows that appear after a list refresh / date move. */
const ROW_ENTER_ANIMATION =
  "ui-enter-soft 420ms cubic-bezier(0.22, 1, 0.36, 1) both";

/**
 * Accumulated wheel deltaY (px) required before moving to the next/previous
 * date. Higher = more scrolling per date, easier to land on adjacent days.
 */
const WHEEL_DELTA_PER_DATE = 120;

interface Tournament {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  location: string;
  date: string;
  status: string;
  gender: TeamGender;
  region: TeamRegion;
  hostSchool?: TournamentHostSchool | null;
  registrationAvailability: PublicRegistrationAvailability;
}

interface TournamentFilters {
  query: string;
  genderFilter: Set<TeamGender>;
  regionFilter: Set<TeamRegion>;
  hideArchived: boolean;
  registrationOpenOnly: boolean;
  today: string;
  now: string;
}

function toggleSetValue<T extends string>(
  set: Set<T>,
  value: T
): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function formatDate(dateStr: string) {
  return formatTournamentDateDisplay(dateStr, { weekday: true });
}

function registrationAvailabilityLabel(
  availability: PublicRegistrationAvailability
): string {
  const registered = availability.capacity == null
    ? `${availability.registeredCount} registered`
    : `${availability.registeredCount} / ${availability.capacity} registered`;
  return `${registered} · ${availability.waitlistCount} waiting`;
}

export function filterTournamentList(
  tournaments: Tournament[],
  filters: TournamentFilters
): Tournament[] {
  let list = tournaments;
  const query = filters.query.trim().toLowerCase();
  if (query) {
    list = list.filter(
      (tournament) =>
        tournament.name.toLowerCase().includes(query) ||
        tournament.location.toLowerCase().includes(query) ||
        tournament.description?.toLowerCase().includes(query)
    );
  }
  if (filters.hideArchived) {
    list = list.filter(
      (tournament) => !isTournamentArchived(tournament.date, filters.today)
    );
  }
  if (filters.registrationOpenOnly) {
    list = list.filter(
      (tournament) =>
        !isTournamentArchived(tournament.date, filters.today) &&
        registrationAvailabilityOpen(
          tournament.status,
          tournament.registrationAvailability,
          filters.now
        )
    );
  }
  if (filters.genderFilter.size > 0) {
    list = list.filter((tournament) =>
      filters.genderFilter.has(tournament.gender)
    );
  }
  if (filters.regionFilter.size > 0) {
    list = list.filter((tournament) =>
      filters.regionFilter.has(tournament.region)
    );
  }
  return list;
}

interface DateGroup {
  date: string;
  tournaments: Tournament[];
}

function groupByDate(list: Tournament[]): DateGroup[] {
  const map = new Map<string, Tournament[]>();
  for (const t of list) {
    const existing = map.get(t.date);
    if (existing) {
      existing.push(t);
    } else {
      map.set(t.date, [t]);
    }
  }
  return Array.from(map.entries()).map(([date, tournaments]) => ({
    date,
    tournaments,
  }));
}

function TournamentRow({
  tournament: t,
  linkPrefix,
  compact = false,
  enter = false,
  highlighted = false,
}: {
  tournament: Tournament;
  linkPrefix: string;
  /** Narrow column beside the date wheel — stack and truncate instead of widening. */
  compact?: boolean;
  /** Soft enter when this row appears after a schedule refresh. */
  enter?: boolean;
  /** Brief emphasis after navigating back from an edit-date flow. */
  highlighted?: boolean;
}) {
  return (
    <div
      data-tournament-slug={t.slug}
      className={cn(
        "min-w-0 max-w-full overflow-hidden px-1 py-3.5 transition-colors duration-150 hover:bg-muted/40",
        compact && "w-full",
        highlighted && "rounded-md bg-primary/10"
      )}
      style={
        enter || highlighted
          ? { animation: ROW_ENTER_ANIMATION }
          : undefined
      }
    >
      <Link
        href={`${linkPrefix}/${t.slug}`}
        className="block min-w-0 max-w-full overflow-hidden"
      >
        <div
          className={cn(
            "flex gap-1.5",
            compact
              ? "flex-col items-start"
              : "flex-col sm:flex-row sm:items-start sm:justify-between sm:gap-3"
          )}
        >
          <span className="min-w-0 w-full truncate font-medium leading-tight">
            {t.name}
          </span>
          <StatusBadge
            kind="tournament"
            status={t.status}
            date={t.date}
            className="shrink-0 self-start"
          />
        </div>
        <div
          className={cn(
            "mt-1.5 min-w-0 text-sm text-muted-foreground",
            compact
              ? "flex flex-col gap-1"
              : "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1"
          )}
        >
          <span className="flex min-w-0 max-w-full items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{t.location}</span>
          </span>
          <span className={cn(compact && "truncate")}>
            {registrationAvailabilityLabel(t.registrationAvailability)}
          </span>
        </div>
      </Link>
      <div
        className={cn(
          "mt-1.5 min-w-0 max-w-full",
          compact
            ? "flex flex-col items-start gap-1.5"
            : "flex min-w-0 flex-wrap items-center gap-1.5"
        )}
      >
        <TeamAttributesBadges
          gender={t.gender}
          region={t.region}
          className={compact ? "w-full" : undefined}
        />
        <TournamentHostSchoolLink
          school={t.hostSchool}
          className={compact ? "w-full max-w-full" : undefined}
        />
      </div>
    </div>
  );
}

function SelectedDayPanel({
  group,
  linkPrefix,
  compact = false,
  highlightSlug = null,
}: {
  group: DateGroup;
  linkPrefix: string;
  compact?: boolean;
  highlightSlug?: string | null;
}) {
  const isEmpty = group.tournaments.length === 0;
  const knownKeysRef = useRef<Set<string> | null>(null);
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(
    () => new Set()
  );

  const rowKeys = group.tournaments.map((t) => t.id ?? t.slug);
  const rowKeysSignature = rowKeys.join("\0");

  useLayoutEffect(() => {
    const keys = rowKeysSignature === "" ? [] : rowKeysSignature.split("\0");
    if (knownKeysRef.current === null) {
      knownKeysRef.current = new Set(keys);
      return;
    }
    const prev = knownKeysRef.current;
    const entering = new Set(keys.filter((key) => !prev.has(key)));
    knownKeysRef.current = new Set(keys);
    if (entering.size === 0) return;
    setEnteringKeys(entering);
    const clearId = window.setTimeout(() => {
      setEnteringKeys(new Set());
    }, 450);
    return () => window.clearTimeout(clearId);
  }, [rowKeysSignature]);

  useEffect(() => {
    if (!highlightSlug) return;
    const frame = window.requestAnimationFrame(() => {
      const nodes = document.querySelectorAll(
        `[data-tournament-slug="${CSS.escape(highlightSlug)}"]`
      );
      for (const el of nodes) {
        // ViewportSplit keeps both trees mounted; skip the CSS-hidden one.
        if (el.getClientRects().length === 0) continue;
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
        break;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [highlightSlug, rowKeysSignature]);

  return (
    <div className={cn("w-full min-w-0 overflow-hidden", SELECTED_PANEL_MIN_H)}>
      {isEmpty ? (
        <p
          className={cn(
            "flex w-full items-center rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 text-sm text-muted-foreground",
            SELECTED_PANEL_MIN_H
          )}
        >
          No tournaments scheduled.
        </p>
      ) : (
        <div
          className={cn(
            "list-stack w-full min-w-0 overflow-hidden border-t border-border/70",
            SELECTED_PANEL_MIN_H
          )}
        >
          {group.tournaments.map((t) => {
            const key = t.id ?? t.slug;
            return (
              <TournamentRow
                key={key}
                tournament={t}
                linkPrefix={linkPrefix}
                compact={compact}
                enter={enteringKeys.has(key)}
                highlighted={highlightSlug === t.slug}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Desktop: horizontal date rail above the selected-day list (wide screens
 * read left-to-right; a vertical side picker looked stranded in a tall empty
 * column). Mobile: compact vertical wheel beside a scrollable day list.
 */
function ChronologicalSchedule({
  tournaments,
  linkPrefix,
  selectedDate,
  onSelectedDateChange,
  highlightSlug = null,
}: {
  tournaments: Tournament[];
  linkPrefix: string;
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  highlightSlug?: string | null;
}) {
  const today = todayISO();

  const groups = useMemo(() => {
    const sorted = [...tournaments].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const grouped = groupByDate(sorted);

    // Always materialize today plus the active selection so empty days can
    // still be focused (e.g. from the calendar or synthesized today).
    const required = new Set<string>([today, selectedDate]);
    for (const date of required) {
      if (grouped.some((g) => g.date === date)) continue;
      const insertAt = grouped.findIndex((g) => g.date > date);
      const empty: DateGroup = { date, tournaments: [] };
      if (insertAt === -1) grouped.push(empty);
      else grouped.splice(insertAt, 0, empty);
    }

    return grouped;
  }, [tournaments, today, selectedDate]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wheelAccumulatorRef = useRef(0);
  const [wheelActivity, setWheelActivity] = useState(0);
  const registerWheelActivity = useCallback(() => {
    setWheelActivity((n) => n + 1);
  }, []);

  // If the selected date disappears (filter, day rollover) fall back to
  // today — which is always present because we synthesize it above.
  const effectiveSelectedDate = useMemo(() => {
    if (groups.some((g) => g.date === selectedDate)) return selectedDate;
    return today;
  }, [groups, selectedDate, today]);

  // Mouse/trackpad wheel cycles dates. Touch scrolling is left to the page;
  // the date rail / mobile wheel are the primary gesture surfaces.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function advance(delta: number) {
      if (delta === 0) return;
      registerWheelActivity();
      const i = groups.findIndex((g) => g.date === selectedDate);
      const safeI =
        i === -1 ? groups.findIndex((g) => g.date === today) : i;
      const next = Math.max(
        0,
        Math.min(groups.length - 1, safeI + delta)
      );
      const nextDate = groups[next]?.date;
      if (nextDate) onSelectedDateChange(nextDate);
    }

    function onWheel(e: WheelEvent) {
      // An overflowing selected-day list owns the gesture until it reaches the
      // edge it's being scrolled toward; then dates resume cycling.
      const target = e.target as HTMLElement | null;
      const dayScroll = target?.closest<HTMLElement>("[data-day-scroll]");
      if (dayScroll && dayScroll.scrollHeight > dayScroll.clientHeight + 1) {
        const atTop = dayScroll.scrollTop <= 0;
        const atBottom =
          dayScroll.scrollTop + dayScroll.clientHeight >=
          dayScroll.scrollHeight - 1;
        const towardEdge = e.deltaY > 0 ? atBottom : atTop;
        if (!towardEdge) {
          wheelAccumulatorRef.current = 0;
          return;
        }
      }

      // Horizontal rail owns its own scroll; don't steal trackpad swipes there.
      if (target?.closest('[aria-orientation="horizontal"]')) {
        return;
      }

      e.preventDefault();
      if (Math.abs(e.deltaY) < 1) return;
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
      advance(steps);
    }

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [groups, today, selectedDate, onSelectedDateChange, registerWheelActivity]);

  // Arrow keys move the selected date by one. Ignored while typing.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight"
      ) {
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }
      e.preventDefault();
      registerWheelActivity();
      if (target && target !== document.body) {
        target.blur();
      }
      const i = groups.findIndex((g) => g.date === selectedDate);
      const safeI =
        i === -1 ? groups.findIndex((g) => g.date === today) : i;
      const delta =
        e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1;
      const next = Math.max(
        0,
        Math.min(groups.length - 1, safeI + delta)
      );
      const nextDate = groups[next]?.date;
      if (nextDate) onSelectedDateChange(nextDate);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups, today, selectedDate, onSelectedDateChange, registerWheelActivity]);

  if (groups.length === 0) return null;

  const scheduleDates = groups.map((g) => g.date);

  const selectedGroup =
    groups.find((g) => g.date === effectiveSelectedDate) ?? {
      date: effectiveSelectedDate,
      tournaments: [] as Tournament[],
    };

  const selectedHeading = (
    <h3 className="flex min-h-9 min-w-0 items-center gap-2 truncate text-sm font-semibold text-foreground">
      {selectedGroup.date === today && (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Today
        </span>
      )}
      <span className="truncate">{formatDate(selectedGroup.date)}</span>
    </h3>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ViewportSplit
        mobileClassName="flex min-h-0 flex-1 flex-col"
        mobile={
          <div className="grid h-full min-h-0 w-full max-w-full flex-1 grid-cols-[minmax(0,1fr)_6.75rem] items-center gap-2 overflow-x-hidden">
            <div
              key={selectedGroup.date}
              className="h-full min-h-0 min-w-0 overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:thin]"
            >
              <p className="sr-only">
                Tournaments on {formatDate(selectedGroup.date)}
              </p>
              <SelectedDayPanel
                group={selectedGroup}
                linkPrefix={linkPrefix}
                compact
                highlightSlug={highlightSlug}
              />
            </div>
            <aside
              aria-label="Date navigation"
              className={cn(
                "col-start-2 row-start-1 flex w-full max-w-[6.75rem] shrink-0 touch-none flex-col justify-center overscroll-y-none",
                MOBILE_WHEEL_H
              )}
            >
              <DateScrollWheel
                dates={scheduleDates}
                selectedDate={effectiveSelectedDate}
                onSelect={onSelectedDateChange}
                today={today}
                activityKey={wheelActivity}
              />
            </aside>
          </div>
        }
        desktop={
          <div
            ref={containerRef}
            className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-1 flex-col gap-4 overflow-x-hidden outline-none"
            aria-roledescription="date cycler"
          >
            <DateRail
              dates={scheduleDates}
              selectedDate={effectiveSelectedDate}
              onSelect={onSelectedDateChange}
              today={today}
              className="shrink-0"
            />

            <div className="min-h-0 min-w-0 flex-1 space-y-2">
              {selectedHeading}
              <div
                data-day-scroll
                className={cn(
                  "overflow-y-auto overscroll-y-contain touch-pan-y [scrollbar-width:thin]",
                  DESKTOP_LIST_MAX_H,
                  "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
                )}
              >
                <SelectedDayPanel
                  group={selectedGroup}
                  linkPrefix={linkPrefix}
                  highlightSlug={highlightSlug}
                />
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}

export function TournamentGrid({
  tournaments,
  linkPrefix = "/tournaments",
}: {
  tournaments: Tournament[];
  linkPrefix?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<Set<TeamGender>>(
    () => new Set()
  );
  const [regionFilter, setRegionFilter] = useState<Set<TeamRegion>>(
    () => new Set()
  );
  const [hideArchived, setHideArchived] = useState(false);
  const [registrationOpenOnly, setRegistrationOpenOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => todayISO());
  const [highlightSlug, setHighlightSlug] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date().toISOString());
  const today = todayISO();
  const todaySyncedRef = useRef(today);

  // After edit-date, land on the new day and refresh so late RSC updates
  // animate in instead of snapping mid-view.
  useEffect(() => {
    const focus = takeTournamentScheduleFocus();
    if (!focus) return;
    setSelectedDate(focus.date);
    setHighlightSlug(focus.slug);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!highlightSlug) return;
    const clearId = window.setTimeout(() => setHighlightSlug(null), 1600);
    return () => window.clearTimeout(clearId);
  }, [highlightSlug]);

  // Day rollover only — skip the initial mount so a schedule-focus hint wins.
  useEffect(() => {
    if (todaySyncedRef.current === today) return;
    todaySyncedRef.current = today;
    setSelectedDate(today);
  }, [today]);

  useEffect(() => {
    if (!registrationOpenOnly) return;
    let timer: number | undefined;
    const refreshNow = () => {
      const currentMs = Date.now();
      setNow(new Date(currentMs).toISOString());
      const remaining = tournaments
        .map((tournament) =>
          Date.parse(tournament.registrationAvailability.deadline ?? "") - currentMs
        )
        .filter((value) => Number.isFinite(value) && value > 0);
      const delay = remaining.length === 0 ? 60_000 : Math.min(...remaining);
      timer = window.setTimeout(refreshNow, Math.max(1, Math.min(60_000, delay)));
    };
    refreshNow();
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [registrationOpenOnly, tournaments]);

  const hasActiveFilters =
    countActiveTournamentFilters({
      genderFilter,
      regionFilter,
      hideArchived,
      registrationOpenOnly,
    }) > 0;

  const filtered = useMemo(() => {
    return filterTournamentList(tournaments, {
      query,
      genderFilter,
      regionFilter,
      hideArchived,
      registrationOpenOnly,
      today,
      now,
    });
  }, [
    tournaments,
    query,
    hideArchived,
    registrationOpenOnly,
    genderFilter,
    regionFilter,
    today,
    now,
  ]);

  /** Dates (YYYY-MM-DD) that actually have tournaments — used to dot the calendar. */
  const datesWithTournaments = useMemo(() => {
    const set = new Set<string>();
    for (const t of filtered) set.add(t.date);
    return set;
  }, [filtered]);

  const hasTournamentDates = useMemo(
    () =>
      Array.from(datesWithTournaments).map((iso) => parseISODate(iso)),
    [datesWithTournaments]
  );

  const tournamentDateIsos = useMemo(
    () => tournaments.map((t) => t.date),
    [tournaments]
  );

  useEffect(() => {
    if (!calendarOpen) return;
    setCalendarMonth(parseISODate(selectedDate));
  }, [calendarOpen, selectedDate]);

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    const iso = toISODate(date);
    setSelectedDate(iso);
    setCalendarOpen(false);
    // Return focus to the page so the trigger doesn't keep a focus ring.
    requestAnimationFrame(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });

    if (!datesWithTournaments.has(iso)) {
      const label = date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      toast(`No tournaments on ${label}.`, {
        description: "Try another date from the calendar.",
      });
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-6 md:h-full">
      <div className="flex shrink-0 min-w-0 items-center gap-3">
        <div className="relative min-w-0 flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tournaments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10 rounded-md pl-9 shadow-sm"
          />
        </div>

        <TournamentListFilters
          genderFilter={genderFilter}
          regionFilter={regionFilter}
          hideArchived={hideArchived}
          registrationOpenOnly={registrationOpenOnly}
          onToggleGender={(value) =>
            setGenderFilter((prev) => toggleSetValue(prev, value))
          }
          onToggleRegion={(value) =>
            setRegionFilter((prev) => toggleSetValue(prev, value))
          }
          onHideArchivedChange={setHideArchived}
          onRegistrationOpenOnlyChange={setRegistrationOpenOnly}
          onClear={() => {
            setGenderFilter(new Set());
            setRegionFilter(new Set());
            setHideArchived(false);
            setRegistrationOpenOnly(false);
          }}
        />

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={cn(
                  "shrink-0",
                  selectedDate !== today && "bg-muted"
                )}
                aria-label={`Calendar, ${formatISODateLabel(selectedDate)} selected`}
              >
                <Calendar className="h-4 w-4" />
              </Button>
            }
          />
          <PopoverContent className="w-auto p-1.5" align="end">
            <DatePickerCalendar
              selected={parseISODate(selectedDate)}
              onSelect={handleDateSelect}
              rangeFromDates={tournamentDateIsos}
              markedDates={hasTournamentDates}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={
            tournaments.length === 0
              ? "No tournaments yet"
              : "No matches"
          }
          description={
            tournaments.length === 0
              ? "Check back soon for upcoming events."
              : query.trim() && hasActiveFilters
                ? `Nothing matches "${query}" with the selected filters.`
                : query.trim()
                  ? `Nothing matches "${query}". Try a different search.`
                  : hasActiveFilters
                    ? "No tournaments match your filters. Try clearing filters or showing past events."
                    : "Check back soon for upcoming events."
          }
        />
      ) : (
        <ChronologicalSchedule
          tournaments={filtered}
          linkPrefix={linkPrefix}
          selectedDate={selectedDate}
          onSelectedDateChange={setSelectedDate}
          highlightSlug={highlightSlug}
        />
      )}
    </div>
  );
}
