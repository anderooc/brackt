/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import Link from "next/link";
import type { BracketMatchContract } from "@/lib/api/contracts/tournament";
import type { DisplayBracket } from "@/lib/tournament-public/flatten-brackets";
import {
  bracketRoundLabel,
  formatSetLine,
  MATCH_STATUS_LABELS,
} from "@/lib/tournament-public/format";
import { cn } from "@/lib/utils";
import { ChampionMoment } from "@/components/brand/champion-moment";
import { findBracketChampion } from "@/lib/tournament-public/champions";

export function PublicBracketView({
  brackets,
  tournamentSlug,
}: {
  brackets: DisplayBracket[];
  tournamentSlug: string;
}) {
  if (brackets.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Brackets have not been released yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {brackets.map((bracket) => {
        const champion = findBracketChampion(bracket.matches);
        return (
          <section
            key={`${bracket.name}-${bracket.tier}`}
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {bracket.name}
              </h2>
              {bracket.contextName ? (
                <p className="text-sm text-muted-foreground">
                  {bracket.contextName}
                </p>
              ) : null}
            </div>

            {champion ? (
              <ChampionMoment bracketName={bracket.name} {...champion} />
            ) : null}

            <BracketRounds
              matches={bracket.matches}
              tournamentSlug={tournamentSlug}
            />
          </section>
        );
      })}
    </div>
  );
}

function BracketRounds({
  matches,
  tournamentSlug,
}: {
  matches: BracketMatchContract[];
  tournamentSlug: string;
}) {
  const rounds = new Map<number, BracketMatchContract[]>();
  for (const match of matches) {
    const list = rounds.get(match.round) ?? [];
    list.push(match);
    rounds.set(match.round, list);
  }

  const sortedRounds = [...rounds.entries()].sort(([a], [b]) => a - b);
  const totalRounds = sortedRounds.at(-1)?.[0] ?? 0;

  return (
    <div className="space-y-6">
      {sortedRounds.map(([round, roundMatches]) => (
        <div key={round} className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            {bracketRoundLabel(round, totalRounds)}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {roundMatches
              .sort((a, b) => a.position - b.position)
              .map((match) => (
                <BracketMatchCard
                  key={match.slug}
                  match={match}
                  tournamentSlug={tournamentSlug}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketMatchCard({
  match,
  tournamentSlug,
}: {
  match: BracketMatchContract;
  tournamentSlug: string;
}) {
  const setLine = formatSetLine(match.sets);
  const isLive = match.status === "in_progress";

  return (
    <Link
      href={`/explore/tournaments/${tournamentSlug}/matches/${match.slug}`}
      className={cn(
        "block rounded-lg border p-3 transition-colors hover:bg-muted/40",
        isLive ? "border-primary/40 bg-primary/5" : "border-border"
      )}
    >
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {MATCH_STATUS_LABELS[match.status]}
      </p>
      <p
        className={cn(
          "truncate text-sm",
          match.winnerSlug === match.teamA?.slug && "font-semibold"
        )}
      >
        {match.teamA?.name ?? "TBD"}
      </p>
      <p
        className={cn(
          "truncate text-sm",
          match.winnerSlug === match.teamB?.slug && "font-semibold"
        )}
      >
        {match.teamB?.name ?? "TBD"}
      </p>
      {setLine ? (
        <p className="mt-1 text-xs text-muted-foreground">{setLine}</p>
      ) : null}
    </Link>
  );
}
