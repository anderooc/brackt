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

import Link from "next/link";
import { Check, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBracketTypeLabel } from "@/lib/labels/bracket";
import {
  bracketSizeForTeamCount,
  byeCountForTeamCount,
  countPlacedTeams,
  DEFAULT_BRACKET_SLOTS,
  isBracketRoundOneByeMatch,
} from "@/lib/utils/bracket";
import { bracketDisplayName } from "@/lib/tournaments/bracket-tiers";
import {
  ChampionMoment,
  finalSetsFor,
} from "@/components/brand/champion-moment";

interface BracketMatch {
  id: string;
  slug: string;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string | null;
  teamBName: string | null;
  bracketRound: number | null;
  bracketPosition: number | null;
  winnerId: string | null;
  status: string;
  sets?: { teamAScore: number; teamBScore: number }[];
}

interface Bracket {
  id: string;
  bracketType: string;
  seedCount: number;
  name: string | null;
  tier: number;
  matches: BracketMatch[];
}

/** Height of one first-round matchup cell. */
const MATCH_BLOCK = 72;
/** Space above each baseline for the team name. */
const TEAM_LINE = 36;
/** Stroke thickness for all bracket lines. */
const STROKE = 2;
/** Horizontal run from a match to the next column. */
const CONNECTOR = 28;
const SLOT_WIDTH = 168;
const MATCH_WIDTH = SLOT_WIDTH + CONNECTOR * 2;
const CHAMPION_WIDTH = CONNECTOR + SLOT_WIDTH;

export function BracketView({
  bracket,
  slug,
}: {
  bracket: Bracket;
  slug: string;
}) {
  const rounds = new Map<number, BracketMatch[]>();
  for (const match of bracket.matches) {
    const round = match.bracketRound ?? 1;
    if (!rounds.has(round)) rounds.set(round, []);
    rounds.get(round)!.push(match);
  }

  for (const [, roundMatches] of rounds) {
    roundMatches.sort(
      (a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0)
    );
  }

  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);
  const totalRounds = sortedRounds.length;

  const placedTeamCount = countPlacedTeams(bracket.matches);
  const teamCount =
    placedTeamCount > 0
      ? placedTeamCount
      : bracket.seedCount > 0 &&
          bracket.seedCount !== DEFAULT_BRACKET_SLOTS
        ? bracket.seedCount
        : 0;
  const byeCount =
    teamCount >= 2 ? byeCountForTeamCount(teamCount) : 0;

  if (totalRounds === 0) {
    return (
      <section className="rounded-xl border border-border/70 bg-card/40 px-4 py-8 text-center shadow-[inset_0_1px_0_0_oklch(1_0_0/0.5)] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]">
        <h3 className="font-heading text-base font-semibold tracking-tight sm:text-lg">
          {`${bracketDisplayName(bracket)} Bracket`}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Seeds automatically when pool play finishes in every pool.
        </p>
      </section>
    );
  }

  const firstRoundCount = sortedRounds[0][1].length;
  const bracketHeight = firstRoundCount * MATCH_BLOCK;

  function roundLabel(round: number): string {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semis";
    if (round === totalRounds - 2) return "Quarters";
    return `R${round}`;
  }

  const title = `${bracketDisplayName(bracket)} Bracket`;

  const showBracketType =
    bracket.bracketType === "double_elimination" && !bracket.name;

  const finalMatches = sortedRounds[totalRounds - 1][1];
  const finalMatch = finalMatches[0];
  const champion = findChampion(finalMatches);
  const bracketDecided = Boolean(champion) && finalMatch?.status === "completed";
  /** Baseline Y where the final's advance stem meets the champion line. */
  const championY = bracketHeight / 2;

  return (
    <section className="overflow-hidden rounded-xl border border-border/70 bg-card/40 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.5)] dark:shadow-[inset_0_1px_0_0_oklch(1_0_0/0.06)]">
      <header className="border-b border-border/60 px-4 py-3 text-center sm:px-6">
        <h3 className="font-heading text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {teamCount > 0 ? (
            <>
              {teamCount} teams
              {byeCount > 0 && (
                <>
                  {" "}
                  · {byeCount} bye{byeCount === 1 ? "" : "s"} ({" "}
                  {bracketSizeForTeamCount(teamCount)}-team draw)
                </>
              )}
            </>
          ) : (
            "Waiting for pool results"
          )}
          {showBracketType && (
            <> · {formatBracketTypeLabel(bracket.bracketType)}</>
          )}
        </p>
      </header>

      {bracketDecided && champion && finalMatch && (
        <div className="border-b border-border/60 p-3 sm:p-4">
          <ChampionMoment
            teamName={champion}
            bracketName={bracketDisplayName(bracket)}
            runnerUpName={
              finalMatch.winnerId === finalMatch.teamAId
                ? finalMatch.teamBName
                : finalMatch.teamAName
            }
            finalSets={finalSetsFor(
              finalMatch.sets,
              finalMatch.winnerId === finalMatch.teamAId
            )}
          />
        </div>
      )}

      <p className="border-b border-border/40 px-4 py-2 text-xs text-muted-foreground md:hidden">
        Swipe sideways to see later rounds
      </p>
      <div className="relative min-w-0">
        <div className="overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <div
            className="mx-auto w-max px-4 py-6 sm:px-8 sm:py-8"
            style={{
              display: "grid",
              gridTemplateColumns: `${[...sortedRounds.map(() => `${MATCH_WIDTH}px`), `${CHAMPION_WIDTH}px`].join(" ")}`,
              minHeight: bracketHeight + 48,
            }}
          >
          {sortedRounds.map(([round], roundIndex) => (
            <div
              key={`label-${round}`}
              className="relative mb-4 min-h-7 overflow-visible"
              style={{ gridRow: 1, gridColumn: roundIndex + 1 }}
            >
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-muted/80 px-2.5 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-foreground/80"
                style={{ left: SLOT_WIDTH / 2 }}
              >
                {roundLabel(round)}
              </span>
            </div>
          ))}

          <div
            className="relative mb-4 min-h-7 overflow-visible"
            style={{ gridRow: 1, gridColumn: sortedRounds.length + 1 }}
          >
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 font-heading text-xs font-bold uppercase tracking-wide text-primary"
              style={{ left: CONNECTOR + SLOT_WIDTH / 2 }}
            >
              Champion
            </span>
          </div>

          {sortedRounds.map(([round, roundMatches], roundIndex) => {
            const blockHeight = MATCH_BLOCK * Math.pow(2, roundIndex);

            return (
              <div
                key={round}
                className="flex flex-col"
                style={{
                  gridRow: 2,
                  gridColumn: roundIndex + 1,
                  height: bracketHeight,
                  width: MATCH_WIDTH,
                }}
              >
                {roundMatches.map((match) => (
                  <div
                    key={match.id}
                    className="relative"
                    style={{ height: blockHeight, width: MATCH_WIDTH }}
                  >
                    <BracketMatchLines
                      match={match}
                      slug={slug}
                      blockHeight={blockHeight}
                      showAdvance
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {/* Champion — baseline shares Y with final midpoint stem */}
          <div
            className="relative"
            style={{
              gridRow: 2,
              gridColumn: sortedRounds.length + 1,
              height: bracketHeight,
              width: CHAMPION_WIDTH,
            }}
          >
            <StrokeH
              y={championY}
              x={0}
              width={CHAMPION_WIDTH}
              className={champion ? "bg-primary" : "bg-border"}
            />
            <div
              className="absolute"
              style={{
                top: championY - TEAM_LINE,
                left: CONNECTOR,
                height: TEAM_LINE,
                width: SLOT_WIDTH,
              }}
            >
              <TeamLine
                name={champion}
                isWinner={Boolean(champion)}
                isLoser={false}
                live={false}
                width={SLOT_WIDTH}
                leadingIcon={
                  champion ? (
                    <Trophy className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : null
                }
                strong={Boolean(champion)}
              />
            </div>
          </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent md:hidden"
          aria-hidden
        />
      </div>
    </section>
  );
}

function findChampion(finalMatches: BracketMatch[]): string | null {
  const final = finalMatches[0];
  if (!final?.winnerId) return null;
  if (final.winnerId === final.teamAId) return final.teamAName;
  if (final.winnerId === final.teamBId) return final.teamBName;
  return null;
}

function setsWon(
  match: BracketMatch
): { a: number; b: number } | null {
  if (!match.sets || match.sets.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const s of match.sets) {
    if (s.teamAScore > s.teamBScore) a++;
    else if (s.teamBScore > s.teamAScore) b++;
  }
  if (a === 0 && b === 0) return null;
  return { a, b };
}

/** Horizontal stroke centered on y (so a 2px line spans y-1 … y+1). */
function StrokeH({
  x,
  y,
  width,
  className,
}: {
  x: number;
  y: number;
  width: number;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute", className)}
      style={{
        left: x,
        top: y - STROKE / 2,
        width,
        height: STROKE,
      }}
      aria-hidden
    />
  );
}

/** Vertical stroke centered on x. */
function StrokeV({
  x,
  y,
  height,
  className,
}: {
  x: number;
  y: number;
  height: number;
  className?: string;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute", className)}
      style={{
        left: x - STROKE / 2,
        top: y,
        width: STROKE,
        height,
      }}
      aria-hidden
    />
  );
}

/**
 * Team A baseline at 25% of the cell (center of the upper feeder match).
 * Team B baseline at 75% (center of the lower feeder). The advance stem
 * leaves at 50%, which is the receiving baseline on the next column.
 * All strokes use the same centered pixel geometry so lines meet exactly.
 */
function BracketMatchLines({
  match,
  slug,
  blockHeight,
  showAdvance,
}: {
  match: BracketMatch;
  slug: string;
  blockHeight: number;
  showAdvance: boolean;
}) {
  const roundOneBye = isBracketRoundOneByeMatch(match);
  const isByeSlotA = roundOneBye && !match.teamAId && Boolean(match.teamBId);
  const isByeSlotB = roundOneBye && Boolean(match.teamAId) && !match.teamBId;
  const live = !roundOneBye && match.status === "in_progress";
  const complete = !roundOneBye && match.status === "completed";
  const scores = roundOneBye ? null : setsWon(match);
  const aWon =
    complete && Boolean(match.winnerId && match.winnerId === match.teamAId);
  const bWon =
    complete && Boolean(match.winnerId && match.winnerId === match.teamBId);

  const teamABottom = blockHeight * 0.25;
  const teamBBottom = blockHeight * 0.75;
  const midY = blockHeight * 0.5;
  const matchTop = teamABottom - TEAM_LINE;
  const matchHeight = teamBBottom - teamABottom + TEAM_LINE;
  const strokeClass =
    roundOneBye
      ? "bg-border/70"
      : live || complete
        ? "bg-foreground/40"
        : "bg-border";

  const slotClassName = cn(
    "absolute left-0 z-10 outline-none rounded-sm border border-transparent",
    !roundOneBye && [
      "group transition-[background-color,border-color,box-shadow] duration-150",
      "hover:border-primary hover:bg-muted/50 hover:shadow-sm",
      "focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary/25",
    ],
    roundOneBye && "cursor-default",
    live && "border-primary/30 bg-primary/[0.05]",
    !roundOneBye && live && "hover:border-primary hover:bg-primary/[0.08]"
  );

  const slotStyle = {
    top: matchTop,
    height: matchHeight,
    width: SLOT_WIDTH,
  };

  const slotContent = (
    <>
      {live && (
        <span
          className="absolute -left-1 size-1.5 -translate-y-1/2 rounded-full bg-live motion-safe:animate-pulse"
          style={{ top: midY }}
        />
      )}

      <div
        className="absolute left-0 right-0"
        style={{ top: teamABottom - TEAM_LINE - matchTop, height: TEAM_LINE }}
      >
        <TeamLine
          name={match.teamAName}
          score={scores?.a}
          isWinner={aWon}
          isLoser={complete && !aWon && Boolean(match.winnerId)}
          live={live}
          complete={complete}
          placeholder={isByeSlotA ? "Bye" : undefined}
        />
      </div>

      <div
        className="absolute left-0 right-0"
        style={{ top: teamBBottom - TEAM_LINE - matchTop, height: TEAM_LINE }}
      >
        <TeamLine
          name={match.teamBName}
          score={scores?.b}
          isWinner={bWon}
          isLoser={complete && !bWon && Boolean(match.winnerId)}
          live={live}
          complete={complete}
          placeholder={isByeSlotB ? "Bye" : undefined}
        />
      </div>
    </>
  );

  return (
    <div className="absolute inset-0">
      {roundOneBye ? (
        <div
          className={slotClassName}
          style={slotStyle}
          aria-label={`${match.teamAName ?? "Bye"} vs ${match.teamBName ?? "Bye"} — bye, not played`}
        >
          {slotContent}
        </div>
      ) : (
        <Link
          href={`/tournaments/${slug}/matches/${match.slug}`}
          className={slotClassName}
          style={slotStyle}
          aria-label={`${match.teamAName ?? "TBD"} vs ${match.teamBName ?? "TBD"}`}
        >
          {slotContent}
        </Link>
      )}

      {/* Team underlines — same Y as feeder stems from the previous round */}
      <StrokeH
        x={0}
        y={teamABottom}
        width={SLOT_WIDTH}
        className={cn(
          roundOneBye && strokeClass,
          !roundOneBye && live && "bg-primary/50",
          !roundOneBye && complete && aWon && "bg-primary",
          !roundOneBye &&
            complete &&
            !aWon &&
            Boolean(match.winnerId) &&
            "bg-border/60",
          !roundOneBye && !complete && !live && strokeClass
        )}
      />
      <StrokeH
        x={0}
        y={teamBBottom}
        width={SLOT_WIDTH}
        className={cn(
          roundOneBye && strokeClass,
          !roundOneBye && live && "bg-primary/50",
          !roundOneBye && complete && bWon && "bg-primary",
          !roundOneBye &&
            complete &&
            !bWon &&
            Boolean(match.winnerId) &&
            "bg-border/60",
          !roundOneBye && !complete && !live && strokeClass
        )}
      />

      {/* Vertical join between the two baselines */}
      <StrokeV
        x={SLOT_WIDTH}
        y={teamABottom}
        height={teamBBottom - teamABottom}
        className={strokeClass}
      />

      {/* Horizontal stem to the next round’s baseline */}
      {showAdvance && (
        <StrokeH
          x={SLOT_WIDTH}
          y={midY}
          width={CONNECTOR * 2}
          className={strokeClass}
        />
      )}
    </div>
  );
}

function TeamLine({
  name,
  score,
  isWinner,
  isLoser,
  live,
  complete = false,
  width = SLOT_WIDTH,
  leadingIcon,
  strong,
  placeholder,
}: {
  name: string | null;
  score?: number;
  isWinner: boolean;
  isLoser: boolean;
  live: boolean;
  complete?: boolean;
  width?: number;
  leadingIcon?: React.ReactNode;
  strong?: boolean;
  placeholder?: string;
}) {
  const displayName = name ?? placeholder ?? "TBD";
  const isPlaceholder = !name && Boolean(placeholder);
  // Name sits above the baseline; the baseline itself is drawn by StrokeH
  // at the bottom edge of this box (shared Y with connectors).
  return (
    <div
      className={cn(
        "flex h-full items-end justify-between gap-1.5 rounded-sm px-1",
        isWinner && complete && "bg-primary/10",
        isLoser && complete && "bg-muted/30"
      )}
      style={{ width }}
      title={name ?? undefined}
    >
      <span
        className={cn(
          "flex min-w-0 flex-1 items-baseline gap-1 pb-2.5 font-heading text-[15px] leading-normal",
          "transition-colors group-hover:text-primary",
          isWinner && "font-bold text-primary",
          isLoser && "font-medium text-muted-foreground/60 line-through decoration-muted-foreground/40",
          isPlaceholder && "font-medium italic text-muted-foreground/70",
          !name && !placeholder && "font-medium text-muted-foreground",
          name && !isWinner && !isLoser && !strong && "font-semibold text-foreground",
          live && !isWinner && !isLoser && "text-foreground"
        )}
      >
        {isWinner && complete ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        ) : (
          leadingIcon
        )}
        <span className={name ? "truncate" : "whitespace-nowrap"}>
          {displayName}
        </span>
      </span>
      {score != null && (
        <span
          className={cn(
            "shrink-0 pb-2.5 pl-1 font-heading text-[15px] tabular-nums leading-normal",
            isWinner ? "font-bold text-primary" : "font-semibold text-muted-foreground",
            isLoser && "text-muted-foreground/60"
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}
