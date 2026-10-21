/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/metadata";
import { PublicTournamentLayout } from "@/components/tournament-public/public-tournament-shell";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";
import {
  findPostedTournamentId,
  loadPublicTournamentMatch,
} from "@/lib/api/queries/tournament-detail";
import {
  formatMatchTime,
  formatSetLine,
  MATCH_STATUS_LABELS,
} from "@/lib/tournament-public/format";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ slug: string; matchSlug: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug, matchSlug } = await params;
  const posted = await findPostedTournamentId(slug);
  if (!posted) return pageMetadata("Match");

  const match = await loadPublicTournamentMatch(
    posted.id,
    posted.name,
    matchSlug
  );
  if (!match) return pageMetadata("Match not found", undefined, { noIndex: true });

  const teams = [match.teamA?.name, match.teamB?.name].filter(Boolean).join(" vs ");
  return pageMetadata(teams || "Match", undefined, {
    canonical: `/explore/tournaments/${slug}/matches/${matchSlug}`,
    image: `/explore/tournaments/${slug}/opengraph-image`,
  });
}

export default async function ExploreMatchPage({ params }: Props) {
  const { slug, matchSlug } = await params;
  const shell = await loadPublicTournamentShell(slug);
  const posted = await findPostedTournamentId(slug);
  if (!posted) notFound();

  const match = await loadPublicTournamentMatch(
    posted.id,
    posted.name,
    matchSlug
  );
  if (!match) notFound();

  const setLine = formatSetLine(match.sets);
  const isLive = match.status === "in_progress";

  return (
    <PublicTournamentLayout shell={shell}>
      <article className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {match.divisionName ?? "Match"}
            {match.courtName ? ` · ${match.courtName}` : ""}
            {match.scheduledTime
              ? ` · ${formatMatchTime(match.scheduledTime)}`
              : ""}
          </p>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
              isLive
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {MATCH_STATUS_LABELS[match.status]}
          </span>
        </div>

        <div className="rounded-xl border border-border p-4">
          <MatchTeamLine
            name={match.teamA?.name ?? "TBD"}
            won={match.winnerSlug === match.teamA?.slug}
          />
          <MatchTeamLine
            name={match.teamB?.name ?? "TBD"}
            won={match.winnerSlug === match.teamB?.slug}
          />
          {setLine ? (
            <p className="mt-3 text-sm tabular-nums text-muted-foreground">
              Sets: {setLine}
            </p>
          ) : null}
        </div>

        {match.refTeamName ? (
          <p className="text-sm text-muted-foreground">
            Ref crew: {match.refTeamName}
          </p>
        ) : null}
      </article>
    </PublicTournamentLayout>
  );
}

function MatchTeamLine({ name, won }: { name: string; won: boolean }) {
  return (
    <p className={cn("text-lg", won ? "font-bold" : "font-medium")}>{name}</p>
  );
}
