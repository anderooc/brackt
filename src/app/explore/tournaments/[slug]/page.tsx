/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Monitor } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { pageMetadata } from "@/lib/metadata";
import { PublicRegistrationAvailability } from "@/components/public-registration-availability";
import { PublicTournamentLayout } from "@/components/tournament-public/public-tournament-shell";
import { OverviewLiveMatches } from "@/components/tournament-public/overview-live-matches";
import { ShareScoreboardDialog } from "@/components/tournament-public/share-scoreboard-dialog";
import { loadPublicTournamentShell } from "@/lib/tournament-public/load-shell";
import { findPostedTournamentId, loadPublicTournamentMatches } from "@/lib/api/queries/tournament-detail";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const shell = await loadPublicTournamentShell(slug);
    const description =
      shell.listItem.description?.trim() ||
      `${shell.listItem.name} is a collegiate club volleyball tournament in ${shell.listItem.location} on ${formatTournamentDateDisplay(shell.listItem.date)}.`;
    return pageMetadata(shell.listItem.name, description, {
      canonical: `/explore/tournaments/${slug}`,
    });
  } catch {
    return pageMetadata("Tournament not found", undefined, { noIndex: true });
  }
}

export default async function ExploreTournamentPage({ params }: Props) {
  const { slug } = await params;
  const shell = await loadPublicTournamentShell(slug);
  const posted = await findPostedTournamentId(slug);
  const matches = posted ? await loadPublicTournamentMatches(posted.id) : [];

  return (
    <PublicTournamentLayout shell={shell}>
      <div className="space-y-6">
        {/* Quick Fan Discovery Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-card/60 p-3.5">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground">
              Spectator & Fan Access
            </p>
            <p className="text-[11px] text-muted-foreground">
              Follow real-time scores, standings, and court assignments without signing in.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareScoreboardDialog
              slug={shell.slug}
              tournamentName={shell.listItem.name}
            />
            <Link
              href={`/explore/tournaments/${shell.slug}/scores?kiosk=1`}
              target="_blank"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs gap-1.5")}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>TV / Kiosk</span>
            </Link>
          </div>
        </div>

        {/* Live / Recent Match Results Showcase */}
        {matches.length > 0 && (
          <OverviewLiveMatches slug={shell.slug} initialMatches={matches} />
        )}

        {/* Tournament Description */}
        {shell.listItem.description ? (
          <div className="space-y-1.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              About the Tournament
            </h2>
            <p className="max-w-2xl whitespace-pre-wrap text-pretty text-sm text-foreground/90">
              {shell.listItem.description}
            </p>
          </div>
        ) : null}

        {/* Registration Availability, Capacity & Deadlines */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team Registration & Capacity
          </h2>
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <PublicRegistrationAvailability
              availability={shell.listItem.registrationAvailability}
            />
            {shell.registrationOpen ? (
              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-pretty text-xs text-muted-foreground">
                  Registration is currently open for college club volleyball teams.
                </p>
                <Link
                  href={`/tournaments/${shell.slug}/register`}
                  className={cn(buttonVariants({ size: "sm" }), "text-xs gap-1.5 shrink-0")}
                >
                  <span>Register a team</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <p className="text-pretty text-xs text-muted-foreground">
                Registration is closed for this tournament.
              </p>
            )}
          </div>
        </div>

        {/* Next step notice */}
        {!shell.hasReleasedPlay && (
          <p className="text-xs text-muted-foreground">
            Match schedules and live score cards will appear on this page as soon as the tournament host releases pools.
          </p>
        )}
      </div>
    </PublicTournamentLayout>
  );
}
