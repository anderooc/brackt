/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import type { Metadata } from "next";
import { pageMetadata, pageTitle } from "@/lib/metadata";
import { PublicTournamentLayout } from "@/components/tournament-public/public-tournament-shell";
import { PublicBracketView } from "@/components/tournament-public/public-bracket-view";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";
import { findPostedTournamentId } from "@/lib/api/queries/tournament-detail";
import { loadPublicTournamentPlay } from "@/lib/api/queries/tournament-play";
import { flattenBrackets } from "@/lib/tournament-public/flatten-brackets";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const shell = await loadPublicTournamentShell(slug);
    return pageMetadata(pageTitle("Bracket", shell.listItem.name), undefined, {
      canonical: `/explore/tournaments/${slug}/bracket`,
      image: `/explore/tournaments/${slug}/opengraph-image`,
    });
  } catch {
    return pageMetadata("Bracket");
  }
}

export default async function ExploreBracketPage({ params }: Props) {
  const { slug } = await params;
  const shell = await loadPublicTournamentShell(slug);
  const posted = await findPostedTournamentId(slug);
  const play = posted ? await loadPublicTournamentPlay(posted.id) : { divisions: [] };
  const brackets = flattenBrackets(play);

  return (
    <PublicTournamentLayout shell={shell}>
      <PublicBracketView brackets={brackets} tournamentSlug={slug} />
    </PublicTournamentLayout>
  );
}
