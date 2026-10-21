/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import type { Metadata } from "next";
import { pageMetadata, pageTitle } from "@/lib/metadata";
import { PublicTournamentLayout } from "@/components/tournament-public/public-tournament-shell";
import { PublicScoresBoard } from "@/components/tournament-public/public-scores-board";
import { PublicScoresToolbar } from "@/components/tournament-public/public-scores-toolbar";
import { KioskScoreboard } from "@/components/tournament-public/kiosk-scoreboard";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";
import { findPostedTournamentId, loadPublicTournamentMatches } from "@/lib/api/queries/tournament-detail";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ kiosk?: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const shell = await loadPublicTournamentShell(slug);
    return pageMetadata(pageTitle("Live scores", shell.listItem.name), undefined, {
      canonical: `/explore/tournaments/${slug}/scores`,
      image: `/explore/tournaments/${slug}/opengraph-image`,
    });
  } catch {
    return pageMetadata("Live scores");
  }
}

export default async function ExploreScoresPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const kiosk = sp.kiosk === "1";

  const shell = await loadPublicTournamentShell(slug);
  const posted = await findPostedTournamentId(slug);
  const matches = posted ? await loadPublicTournamentMatches(posted.id) : [];

  if (kiosk) {
    return (
      <KioskScoreboard
        slug={slug}
        tournamentName={shell.listItem.name}
        initialMatches={matches}
      />
    );
  }

  return (
    <PublicTournamentLayout shell={shell}>
      <div className="space-y-4">
        <PublicScoresToolbar slug={slug} tournamentName={shell.listItem.name} />
        <PublicScoresBoard slug={slug} initialMatches={matches} />
      </div>
    </PublicTournamentLayout>
  );
}
