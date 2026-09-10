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
import { ArrowRight, Volleyball } from "lucide-react";
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
  { value: "50+", label: "Teams per tournament" },
  { value: "1,000+", label: "Matches tracked" },
  { value: "9", label: "Regions nationwide" },
];

export default async function HomePage() {
  const user = await getCurrentAuthProfile();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={user} />

      <main id="main-content" tabIndex={-1} className="flex-1">
        <section className="relative flex min-h-[calc(100svh-3.5rem)] overflow-hidden">
          {/* Decorative backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 text-foreground/[0.07] bg-dot-grid [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 top-[-10%] -z-10 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-32 top-[10%] -z-10 h-96 w-96 rounded-full bg-secondary/20 blur-3xl"
          />

          <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16 text-center sm:py-20">
            <div className="mx-auto flex max-w-3xl flex-col items-center">
              <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                <Volleyball className="h-3.5 w-3.5 text-primary" />
                Built for collegiate club volleyball
              </span>

              <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
                Run the whole
                <br />
                tournament on{" "}
                <span className="inline-flex items-baseline whitespace-nowrap">
                  <span className="text-primary">brack</span>
                  <span className="text-secondary">t</span>
                </span>
              </h1>

              <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg">
                Pools, brackets, court scheduling, and live scores in one place,
                so hosts, teams, and fans can ditch the spreadsheets and group
                chats.
              </p>

              {!user && (
                <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      size: "lg",
                      className: "group h-11 px-6 text-sm shadow-lg shadow-primary/20",
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

              <dl className="mt-14 grid w-full max-w-lg grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-border/60 shadow-sm">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col items-center gap-1 bg-card/80 px-3 py-5 backdrop-blur-sm"
                  >
                    <dt className="order-2 text-xs text-muted-foreground">
                      {stat.label}
                    </dt>
                    <dd className="order-1 font-heading text-2xl font-bold text-gradient-brand sm:text-3xl">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <AudienceSplitSection />

        <TournamentDemoSection />

        <FeaturedTournamentsSection />

        <HomepageFeaturesSection />

        <OperationsFeaturesSection />

        {!user && (
          <section className="container mx-auto px-4 py-20">
            <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-card to-secondary/10 px-6 py-14 text-center shadow-sm sm:px-12">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 text-foreground/[0.05] bg-dot-grid"
              />
              <div className="relative mx-auto max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready for your next tournament?
                </h2>
                <p className="mt-3 text-muted-foreground">
                  Create a free account and host your first event in minutes.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Link
                    href="/signup"
                    className={buttonVariants({
                      size: "lg",
                      className: "group h-11 px-6 text-sm shadow-lg shadow-primary/20",
                    })}
                  >
                    Get Started
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/login"
                    className={buttonVariants({
                      size: "lg",
                      variant: "outline",
                      className: "h-11 px-6 text-sm",
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
