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

import { useMemo, useState } from "react";
import Link from "next/link";
import { format as formatDate } from "date-fns";
import {
  ArrowUpRight,
  CalendarClock,
  CheckSquare,
  FastForward,
  MapPin,
  Radio,
  Users,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildMatchScoreState } from "@/lib/tournaments/match-format";
import type { MatchFormat } from "@/lib/labels/match-format";
import { isBracketRoundOneByeMatch } from "@/lib/utils/bracket";
import { bracketScheduleLabel } from "@/lib/tournaments/bracket-tiers";
import { cn } from "@/lib/utils";
import type { DivisionPlayData } from "./brackets/data";
import { QuickCourtDelayDialog } from "./matches/quick-court-delay-dialog";
import { BulkOpsBar } from "./matches/bulk-ops-bar";

interface MatchSet {
  teamAScore: number;
  teamBScore: number;
}

interface BoardMatch {
  id: string;
  slug: string;
  status: string;
  scheduledTime: Date | null;
  courtId: string | null;
  courtName: string | null;
  context: string;
  teamAName: string | null;
  teamBName: string | null;
  winnerId: string | null;
  teamAId: string | null;
  teamBId: string | null;
  refName: string | null;
  sets: MatchSet[];
}

interface FormatSettings {
  format: MatchFormat;
  targetScore: number;
  tiebreakTargetScore: number;
}

function flattenMatches(divisions: DivisionPlayData[]): BoardMatch[] {
  const out: BoardMatch[] = [];

  for (const div of divisions) {
    for (const pool of div.pools) {
      for (const m of pool.matches) {
        out.push({
          id: m.id,
          slug: m.slug,
          status: m.status,
          scheduledTime: m.scheduledTime,
          courtId: m.courtId,
          courtName: m.courtName ?? null,
          context: `${div.name} · ${pool.name}`,
          teamAName: m.teamA?.name ?? null,
          teamBName: m.teamB?.name ?? null,
          winnerId: m.winnerId,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          refName: m.ref?.name ?? null,
          sets: m.sets,
        });
      }
    }
  }

  const brackets = divisions
    .flatMap((div) => div.brackets)
    .sort((a, b) => a.tier - b.tier);
  const seenBrackets = new Set<string>();

  for (const bracket of brackets) {
    if (seenBrackets.has(bracket.id)) continue;
    seenBrackets.add(bracket.id);
    for (const m of bracket.matches) {
      if (!m.teamAName && !m.teamBName) continue;
      if (
        isBracketRoundOneByeMatch({
          bracketRound: m.bracketRound,
          teamAId: m.teamAId,
          teamBId: m.teamBId,
        })
      ) {
        continue;
      }
      out.push({
        id: m.id,
        slug: m.slug,
        status: m.status,
        scheduledTime: m.scheduledTime,
        courtId: m.courtId,
        courtName: m.courtName ?? null,
        context: bracketScheduleLabel(bracket),
        teamAName: m.teamAName,
        teamBName: m.teamBName,
        winnerId: m.winnerId,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
        refName: m.ref?.name ?? null,
        sets: m.sets,
      });
    }
  }

  return out;
}

function sortByTime(a: BoardMatch, b: BoardMatch): number {
  const at = a.scheduledTime ? a.scheduledTime.getTime() : Infinity;
  const bt = b.scheduledTime ? b.scheduledTime.getTime() : Infinity;
  return at - bt;
}

function MatchCard({
  slug,
  match,
  settings,
  bulkMode = false,
  isSelected = false,
  onToggleSelect,
}: {
  slug: string;
  match: BoardMatch;
  settings: FormatSettings;
  bulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (matchId: string) => void;
}) {
  const { setsWonA, setsWonB } = buildMatchScoreState(settings, match.sets);
  const teamA = match.teamAName ?? "TBD";
  const teamB = match.teamBName ?? "TBD";
  const aWon = match.winnerId != null && match.winnerId === match.teamAId;
  const bWon = match.winnerId != null && match.winnerId === match.teamBId;
  const isCompleted = match.status === "completed";

  const cardContent = (
    <Card
      className={cn(
        "h-full gap-0 py-0 transition-colors duration-150",
        bulkMode
          ? isSelected
            ? "border-primary bg-primary/5 ring-1 ring-primary/40"
            : "hover:border-foreground/30 hover:bg-muted/20"
          : "group-hover:border-primary/35 group-hover:bg-muted/30"
      )}
    >
      <CardHeader className="gap-2 p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {bulkMode && !isCompleted && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect?.(match.id)}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                aria-label={`Select ${teamA} vs ${teamB}`}
              />
            )}
            <h4 className="text-sm font-semibold leading-tight truncate">
              {teamA}{" "}
              <span className="font-normal text-muted-foreground">vs</span>{" "}
              {teamB}
            </h4>
          </div>
          <StatusBadge
            kind="match"
            status={match.status}
            className="shrink-0"
          />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{match.context}</span>
          {match.courtName && (
            <span className="flex items-center gap-1 font-medium text-foreground/80">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {match.courtName}
            </span>
          )}
          {match.scheduledTime && (
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" />
              {formatDate(match.scheduledTime, "EEE h:mm a")}
            </span>
          )}
          {match.refName && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Ref {match.refName}
            </span>
          )}
        </p>
      </CardHeader>

      <CardContent className="p-4 pt-0">
        <div className="flex items-center justify-center gap-6 text-center">
          <ScoreColumn name={teamA} value={setsWonA} won={aWon} />
          <span className="text-lg text-muted-foreground">–</span>
          <ScoreColumn name={teamB} value={setsWonB} won={bWon} />
        </div>

        {match.sets.length > 0 ? (
          <>
            <Separator className="my-3" />
            <div className="space-y-1">
              {match.sets.map((s, i) => (
                <div
                  key={i}
                  className="flex justify-between px-1 text-sm tabular-nums"
                >
                  <span className="text-muted-foreground">Set {i + 1}</span>
                  <span>
                    <span
                      className={cn(
                        s.teamAScore > s.teamBScore && "font-semibold"
                      )}
                    >
                      {s.teamAScore}
                    </span>
                    <span className="text-muted-foreground"> – </span>
                    <span
                      className={cn(
                        s.teamBScore > s.teamAScore && "font-semibold"
                      )}
                    >
                      {s.teamBScore}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {match.status === "in_progress"
              ? "In progress, no sets recorded yet"
              : "Not started"}
          </p>
        )}

        <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary">
          {bulkMode ? (
            <Link
              href={`/tournaments/${slug}/matches/${match.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center text-primary hover:underline"
            >
              Open match
              <ArrowUpRight className="ml-0.5 h-3 w-3" />
            </Link>
          ) : (
            <span className="inline-flex items-center opacity-0 transition-opacity group-hover:opacity-100">
              Open match
              <ArrowUpRight className="ml-0.5 h-3 w-3" />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (bulkMode) {
    return (
      <div
        onClick={() => !isCompleted && onToggleSelect?.(match.id)}
        className={cn(
          "block h-full outline-none",
          !isCompleted && "cursor-pointer"
        )}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={`/tournaments/${slug}/matches/${match.slug}`}
      className="group block h-full rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      {cardContent}
    </Link>
  );
}

function ScoreColumn({
  name,
  value,
  won,
}: {
  name: string;
  value: number;
  won: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "text-3xl font-bold tabular-nums",
          won ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {value}
      </p>
      <p className="max-w-[9rem] truncate text-sm text-muted-foreground sm:max-w-[10rem]">
        {name}
      </p>
    </div>
  );
}

/**
 * Board of every match in a tournament with day-of ops support for hosts.
 */
export function MatchBoard({
  slug,
  divisions,
  settings,
  tournamentId,
  courts = [],
  isOrganizer = false,
}: {
  slug: string;
  divisions: DivisionPlayData[];
  settings: FormatSettings;
  tournamentId?: string;
  courts?: { id: string; name: string }[];
  isOrganizer?: boolean;
}) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quickDelayOpen, setQuickDelayOpen] = useState(false);
  const [courtFilter, setCourtFilter] = useState<string>("all");

  const all = useMemo(() => flattenMatches(divisions), [divisions]);

  const filteredMatches = useMemo(() => {
    if (courtFilter === "all") return all;
    if (courtFilter === "__unassigned__") {
      return all.filter((m) => !m.courtId);
    }
    return all.filter((m) => m.courtId === courtFilter);
  }, [all, courtFilter]);

  if (all.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No matches yet"
        description="Once pools or brackets are generated, every match shows up here with live status and scores."
      />
    );
  }

  const live = filteredMatches
    .filter((m) => m.status === "in_progress")
    .sort(sortByTime);
  const upcoming = filteredMatches
    .filter((m) => m.status === "upcoming")
    .sort(sortByTime);
  const completed = filteredMatches
    .filter((m) => m.status === "completed")
    .sort(sortByTime);

  const activePlayable = filteredMatches.filter((m) => m.status !== "completed");

  function handleToggleSelect(matchId: string) {
    setSelectedIds((prev) =>
      prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]
    );
  }

  function handleSelectAllVisible() {
    setSelectedIds(activePlayable.map((m) => m.id));
  }

  function handleSelectUpcoming() {
    setSelectedIds(upcoming.map((m) => m.id));
  }

  function handleClearSelection() {
    setSelectedIds([]);
  }

  function handleExitBulkMode() {
    setBulkMode(false);
    setSelectedIds([]);
  }

  return (
    <div className="space-y-6">
      {/* Host Day-of Ops Toolbar */}
      {isOrganizer && tournamentId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Day-of operations
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              ({all.length} matches total · {live.length} live · {upcoming.length} upcoming)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {courts.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuickDelayOpen(true)}
                className="h-8 text-xs font-medium"
              >
                <FastForward className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Quick court delay
              </Button>
            )}

            <Button
              type="button"
              variant={bulkMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                if (bulkMode) handleExitBulkMode();
                else setBulkMode(true);
              }}
              className="h-8 text-xs font-medium"
            >
              {bulkMode ? (
                <>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Exit bulk select
                </>
              ) : (
                <>
                  <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  Bulk select matches
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Bulk mode control sub-bar */}
      {bulkMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 animate-in fade-in duration-150">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAllVisible}
              className="h-7 text-xs bg-background"
            >
              Select all active ({activePlayable.length})
            </Button>
            {upcoming.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectUpcoming}
                className="h-7 text-xs bg-background"
              >
                Select upcoming ({upcoming.length})
              </Button>
            )}
            {selectedIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                className="h-7 text-xs"
              >
                Deselect all
              </Button>
            )}
          </div>

          {courts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Filter court:</span>
              <Select
                value={courtFilter}
                onValueChange={(val) => {
                  if (val) setCourtFilter(val);
                }}
              >
                <SelectTrigger size="sm" className="h-7 min-w-[7.5rem] text-xs bg-background">
                  <SelectValue placeholder="All courts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courts</SelectItem>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Live matches */}
      {live.length > 0 && (
        <Section title="Live" count={live.length} icon={<Radio className="h-4 w-4 text-live" />}>
          {live.map((m) => (
            <MatchCard
              key={m.id}
              slug={slug}
              match={m}
              settings={settings}
              bulkMode={bulkMode}
              isSelected={selectedIds.includes(m.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </Section>
      )}

      {/* Upcoming matches */}
      <Section title="Upcoming" count={upcoming.length}>
        {upcoming.length === 0 ? (
          <Card className="sm:col-span-2 xl:col-span-3">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              {courtFilter !== "all"
                ? "No upcoming matches for this court."
                : "No upcoming matches."}
            </CardContent>
          </Card>
        ) : (
          upcoming.map((m) => (
            <MatchCard
              key={m.id}
              slug={slug}
              match={m}
              settings={settings}
              bulkMode={bulkMode}
              isSelected={selectedIds.includes(m.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))
        )}
      </Section>

      {/* Completed matches */}
      {completed.length > 0 && (
        <Section title="Completed" count={completed.length}>
          {completed.map((m) => (
            <MatchCard
              key={m.id}
              slug={slug}
              match={m}
              settings={settings}
              bulkMode={bulkMode}
              isSelected={selectedIds.includes(m.id)}
              onToggleSelect={handleToggleSelect}
            />
          ))}
        </Section>
      )}

      {/* Quick court delay dialog */}
      {isOrganizer && tournamentId && (
        <QuickCourtDelayDialog
          open={quickDelayOpen}
          onOpenChange={setQuickDelayOpen}
          tournamentId={tournamentId}
          slug={slug}
          courts={courts}
        />
      )}

      {/* Bulk action floating bar */}
      {bulkMode && tournamentId && selectedIds.length > 0 && (
        <BulkOpsBar
          tournamentId={tournamentId}
          slug={slug}
          courts={courts}
          selectedMatchIds={selectedIds}
          onClearSelection={handleClearSelection}
          onExitBulkMode={handleExitBulkMode}
        />
      )}
    </div>
  );
}

function Section({
  title,
  count,
  icon,
  children,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
        {icon}
        <span>{title}</span>
        <span className="text-muted-foreground">({count})</span>
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </section>
  );
}
