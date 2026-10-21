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

import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAuthProfile } from "@/lib/auth";
import { TournamentGrid } from "@/components/tournament-grid";
import { getCachedPublicTournamentList } from "@/lib/tournaments/public-list-cache";
import { pageMetadata } from "@/lib/metadata";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";

export const metadata = pageMetadata(
  "Explore collegiate club volleyball tournaments",
  "Find upcoming collegiate club volleyball tournaments, dates, locations, divisions, and registration details.",
  { canonical: "/explore" }
);

export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [user, allTournaments] = await Promise.all([
    getCurrentAuthProfile(),
    getCachedPublicTournamentList(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main id="main-content" tabIndex={-1} className="relative flex-1">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 text-foreground/[0.05] bg-court-lines [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />
        <div className="container mx-auto space-y-8 px-4 py-10">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              Tournaments
            </h1>
            <p className="text-pretty text-muted-foreground">
              Browse upcoming and ongoing collegiate club volleyball tournaments.
            </p>
          </div>

          <TournamentGrid
            tournaments={allTournaments}
            linkPrefix="/explore/tournaments"
          />
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
