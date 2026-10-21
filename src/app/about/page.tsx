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
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentAuthProfile } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";

export const metadata = pageMetadata(
  "About",
  "Why brackt exists: built by Andrew Chang from running Emory club volleyball tournaments without the right tools.",
  { canonical: "/about" }
);

export default async function AboutPage() {
  const user = await getCurrentAuthProfile();

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SiteHeader user={user} />

      <main id="main-content" tabIndex={-1} className="relative flex-1 overflow-x-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 text-foreground/[0.05] bg-court-lines [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />

        <article className="container mx-auto max-w-3xl px-4 py-10 sm:py-16 md:py-20">
          <header className="space-y-3 sm:space-y-4">
            <p className="text-sm font-medium text-muted-foreground">
              About brackt
            </p>
            <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Built from running tournaments the hard way
            </h1>
            <p className="max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
              I created brackt after years as president of Emory Club
              Volleyball, hosting and traveling to tournaments that were held
              together by spreadsheets, group chats, and too many last-minute
              fixes.
            </p>
          </header>

          <div className="mt-10 space-y-9 text-base leading-relaxed text-foreground/90 sm:mt-12 sm:space-y-10">
            <section className="space-y-4">
              <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                What it was like at Emory
              </h2>
              <p className="text-pretty">
                Club volleyball is one of the best parts of college sports. Teams
                arrive early, compete all day, and care deeply about getting every
                match right. As club president, I experienced the other side too:
                organizing pools, building brackets, collecting rosters, assigning
                courts, and keeping scores accurate while answering the same
                questions across multiple chats.
              </p>
              <p className="text-pretty">
                The tournaments themselves were great. The tools were not.
              </p>
              <p className="text-pretty">
                Every event depended on a patchwork of Google Sheets, shared Docs,
                Instagram posts, GroupMe messages, and verbal updates that never
                reached everyone who needed them. When something changed on court,
                captains, players, and spectators often found out last.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                Why I built brackt
              </h2>
              <p className="text-pretty">
                Those frustrations weren&apos;t unique to Emory. Nearly every
                collegiate club tournament I attended followed the same pattern:
                dedicated hosts trying to run great events with tools that were
                never designed for tournament day.
              </p>
              <p className="text-pretty">
                Instead of focusing on the competition, organizers spent hours
                rebuilding the same systems from scratch and solving avoidable
                problems throughout the weekend.
              </p>
              <p className="text-pretty">brackt is my answer to that.</p>
              <p className="text-pretty">
                I wanted a single platform for hosts to manage registration,
                build divisions, generate pools and brackets, schedule courts, and
                update live scores—without worrying about whether everyone has the
                latest spreadsheet.
              </p>
              <p className="text-pretty">
                I wanted captains to be able to register their teams, manage rosters, and
                always know where they&apos;re playing next. I wanted players and
                spectators to refresh one page and trust that the information
                they&apos;re seeing is accurate.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                What I&apos;m building toward
              </h2>
              <p className="text-pretty">
                brackt is built for collegiate club volleyball first because
                that&apos;s the community I know best.
              </p>
              <p className="text-pretty">
                The goal isn&apos;t to create another generic tournament platform.
                It&apos;s to build software that understands how our tournaments
                actually operate: early mornings, limited courts, tight turnarounds
                between pools and playoffs, and hosts who are often players or
                alumni volunteering their weekends to make the event happen.
              </p>
              <p className="text-pretty">
                If brackt can save a host from a stressful Saturday morning, make
                a tournament run a little smoother, or help one team find the right
                court at the right time, then it&apos;s accomplishing exactly what
                it was built to do.
              </p>
            </section>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-border/70 pt-8 sm:mt-14 sm:flex-row sm:items-center sm:pt-10">
            <Link
              href="/explore"
              className={buttonVariants({
                size: "lg",
                className: "group h-11 w-full px-6 text-sm sm:w-auto",
              })}
            >
              Browse tournaments
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {!user ? (
              <Link
                href="/signup"
                className={buttonVariants({
                  size: "lg",
                  variant: "outline",
                  className: "h-11 w-full px-6 text-sm sm:w-auto",
                })}
              >
                Create account
              </Link>
            ) : null}
          </div>

          <p className="mt-8 text-pretty text-sm leading-relaxed text-muted-foreground sm:mt-10">
            <span className="font-medium text-foreground/80">Andrew Chang</span>
            <span className="mt-1 block sm:mt-0 sm:inline">
              <span className="mx-2 hidden text-border sm:inline" aria-hidden>
                /
              </span>
              Founder
              <span className="mx-2 text-border" aria-hidden>
                /
              </span>
              Former president, Emory Club Volleyball
            </span>
          </p>
        </article>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
