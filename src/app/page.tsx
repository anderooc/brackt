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
import { buttonVariants } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { ArrowRight } from "lucide-react";
import { WelcomeHeroIllustration } from "@/components/brand/illustrations";
import { getCurrentAuthProfile } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { TournamentDemoSection } from "@/components/marketing/tournament-demo-section";
import { AudienceSplitSection } from "@/components/marketing/audience-split-section";
import { FeaturedTournamentsSection } from "@/components/marketing/featured-tournaments-section";
import { HomepageFeaturesSection } from "@/components/marketing/homepage-features-section";
import { OperationsFeaturesSection } from "@/components/marketing/operations-features-section";

export const metadata = pageMetadata(
  "Collegiate club volleyball tournaments",
  "Run collegiate club volleyball tournaments from registration through pools, brackets, court schedules, and live scoring.",
  { canonical: "/" }
);

export const dynamic = "force-dynamic";

const STATS = [
  { value: "9", label: "Club regions covered" },
  { value: "1", label: "Link for teams and fans" },
  { value: "0", label: "Spreadsheets needed" },
];

export default async function HomePage() {
  const user = await getCurrentAuthProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="relative grid overflow-hidden border-b bg-hero-wash lg:min-h-[min(42rem,calc(100svh-3.5rem))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex items-center px-4 pb-10 pt-14 sm:pl-[calc((100vw-40rem)/2+1rem)] sm:pt-20 md:pl-[calc((100vw-48rem)/2+1rem)] lg:py-20 lg:pl-[calc((100vw-64rem)/2+1rem)] lg:pr-10 xl:pl-[calc((100vw-80rem)/2+1rem)] 2xl:pl-[calc((100vw-96rem)/2+1rem)]">
            <div className="flex max-w-xl flex-col">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span aria-hidden className="h-0.5 w-6 bg-net" />
                Built for collegiate club volleyball
              </p>

              <h1 className="mt-5 text-balance text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl">
                Run the whole tournament on{" "}
                <span className="font-black italic text-gradient-brand">brackt</span>
              </h1>

              <p className="mt-6 max-w-lg text-pretty text-base text-muted-foreground sm:text-lg">
                Pools, brackets, court scheduling, and live scores in one place,
                so hosts, teams, and fans can ditch the spreadsheets and group
                chats.
              </p>

              {!user && (
                <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      size: "lg",
                      className: "group h-11 px-6 text-sm",
                    })}
                  >
                    Create Account
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/explore"
                    className={buttonVariants({
                      size: "lg",
                      variant: "outline",
                      className: "h-11 px-6 text-sm",
                    })}
                  >
                    Browse Tournaments
                  </Link>
                  <Link
                    href="#demo"
                    className={buttonVariants({
                      size: "lg",
                      variant: "ghost",
                      className: "h-11 px-6 text-sm",
                    })}
                  >
                    Watch demo
                  </Link>
                </div>
              )}

              <dl className="mt-12 grid max-w-md grid-cols-3 divide-x border-t pt-6">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col gap-1.5 px-4 first:pl-0 last:pr-0"
                  >
                    <dt className="order-2 text-xs leading-snug text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="order-1 w-fit font-heading text-4xl font-black italic leading-none tracking-tight tabular-nums text-gradient-brand sm:text-5xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="relative min-h-0 lg:min-h-full">
            <WelcomeHeroIllustration
              viewBox="660 0 780 640"
              preserveAspectRatio="xMidYMid slice"
              className="block aspect-[780/560] h-auto w-full lg:absolute lg:inset-0 lg:aspect-auto lg:h-full"
            />
          </div>
        </section>

        <AudienceSplitSection />

        <TournamentDemoSection />

        <FeaturedTournamentsSection />

        <HomepageFeaturesSection />

        <OperationsFeaturesSection />

        {!user && (
          <section className="container mx-auto px-4 py-20">
            <div className="relative overflow-hidden rounded-3xl bg-court-gradient px-6 py-16 text-center text-court-foreground sm:px-12">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 text-white/15 bg-court-lines"
              />
              <span
                aria-hidden
                className="pointer-events-none absolute bottom-10 right-0 h-2 w-14 bg-net"
              />
              <div className="relative mx-auto max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready for your next tournament?
                </h2>
                <p className="mt-3 text-court-foreground/80">
                  Create a free account and host your first event in minutes.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      size: "lg",
                      className:
                        "group h-11 bg-white px-6 text-sm text-court hover:bg-white/90 [a]:hover:bg-white/90 focus-visible:ring-white/60",
                    })}
                  >
                    Get Started
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/login"
                    className={buttonVariants({
                      size: "lg",
                      variant: "ghost",
                      className:
                        "h-11 px-6 text-sm text-court-foreground ring-1 ring-inset ring-white/40 hover:bg-white/10 hover:text-court-foreground dark:hover:bg-white/10 focus-visible:ring-white/60",
                    })}
                  >
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <PublicSiteFooter showTagline />
    </div>
  );
}
