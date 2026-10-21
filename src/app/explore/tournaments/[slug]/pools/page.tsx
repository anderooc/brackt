/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import type { Metadata } from "next";
import { pageMetadata, pageTitle } from "@/lib/metadata";
import { PublicTournamentLayout } from "@/components/tournament-public/public-tournament-shell";
import { PublicPoolsView } from "@/components/tournament-public/public-pools-view";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";
import { findPostedTournamentId } from "@/lib/api/queries/tournament-detail";
import { loadPublicTournamentPlay } from "@/lib/api/queries/tournament-play";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const shell = await loadPublicTournamentShell(slug);
    return pageMetadata(pageTitle("Pools", shell.listItem.name), undefined, {
      canonical: `/explore/tournaments/${slug}/pools`,
      image: `/explore/tournaments/${slug}/opengraph-image`,
    });
  } catch {
    return pageMetadata("Pools");
  }
}

export default async function ExplorePoolsPage({ params }: Props) {
  const { slug } = await params;
  const shell = await loadPublicTournamentShell(slug);
  const posted = await findPostedTournamentId(slug);
  const play = posted ? await loadPublicTournamentPlay(posted.id) : { divisions: [] };

  return (
    <PublicTournamentLayout shell={shell}>
      <PublicPoolsView play={play} tournamentSlug={slug} />
    </PublicTournamentLayout>
  );
}
