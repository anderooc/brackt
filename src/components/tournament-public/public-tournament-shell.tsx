/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { StatusBadge } from "@/components/ui/status-badge";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { TournamentHostSchoolLink } from "@/components/tournament-host-school-link";
import { TournamentHeaderMeta } from "@/components/tournament-header-meta";
import { getCurrentAuthProfile } from "@/lib/auth";
import type { PublicTournamentShell } from "@/lib/tournament-public/load-shell";
import { PublicTournamentNav } from "./public-tournament-nav";

export async function PublicTournamentLayout({
  shell,
  children,
  hideFooter = false,
}: {
  shell: PublicTournamentShell;
  children: React.ReactNode;
  hideFooter?: boolean;
}) {
  const authProfile = await getCurrentAuthProfile();
  const { listItem } = shell;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={authProfile} />

      <main id="main-content" tabIndex={-1} className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56 text-foreground/[0.05] bg-court-lines [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
          <Link
            href="/explore"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← All tournaments
          </Link>

          <div className="space-y-2">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <h1 className="min-w-0 max-w-full text-balance text-2xl font-bold tracking-tight sm:text-3xl">
                {listItem.name}
              </h1>
              <StatusBadge
                kind="tournament"
                status={listItem.status}
                date={listItem.date}
                className="shrink-0 self-start"
              />
            </div>
            <TournamentHeaderMeta
              location={listItem.location}
              address={shell.address}
              date={listItem.date}
              organizerName={shell.organizerName}
            />
            <div className="flex min-w-0 max-w-full items-center gap-1.5 max-md:overflow-x-auto max-md:pb-0.5 max-md:[scrollbar-width:none]">
              <TeamAttributesBadges
                gender={listItem.gender}
                region={listItem.region}
              />
              <TournamentHostSchoolLink
                school={listItem.hostSchool}
                className="shrink-0"
              />
            </div>
          </div>

          <PublicTournamentNav
            slug={shell.slug}
            hasReleasedPlay={shell.hasReleasedPlay}
          />

          {children}
        </div>
      </main>

      {!hideFooter && <PublicSiteFooter />}
    </div>
  );
}
