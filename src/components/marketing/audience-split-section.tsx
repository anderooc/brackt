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
import { ArrowRight, LayoutDashboard, UsersRound } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BringTeamsTogetherIllustration,
  OrganizeTournamentIllustration,
} from "@/components/brand/illustrations";

const AUDIENCES = [
  {
    id: "host",
    icon: LayoutDashboard,
    label: "Tournament directors",
    title: "Run the whole event",
    description:
      "Open registration, build pools and brackets, schedule courts, and keep scores live from one dashboard.",
    bullets: [
      "Division setup and match format",
      "Court scheduling with warmup windows",
      "Live standings and bracket updates",
    ],
    href: "/signup",
    cta: "Start hosting",
    panelClass: "bg-court-mesh",
    iconClass: "bg-primary/15 text-primary ring-primary/20",
    art: OrganizeTournamentIllustration,
  },
  {
    id: "team",
    icon: UsersRound,
    label: "Captains and players",
    title: "Register and show up ready",
    description:
      "Find tournaments, submit your roster, handle waivers and payments, and follow your schedule on game day.",
    bullets: [
      "Team registration and roster management",
      "Digital waivers and payment tracking",
      "Schedule, chat, and live scores in one place",
    ],
    href: "/explore",
    cta: "Find a tournament",
    panelClass: "bg-card",
    iconClass: "bg-secondary text-secondary-foreground ring-primary/15",
    art: BringTeamsTogetherIllustration,
  },
] as const;

export function AudienceSplitSection() {
  return (
    <section
      className="relative overflow-hidden border-t"
      aria-labelledby="audience-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-line-grid [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div className="container relative mx-auto px-4 py-20">
        <div className="max-w-2xl">
          <h2
            id="audience-heading"
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Built for hosts and teams
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            Whether you are running a regional or registering your club, brackt
            meets you where you are.
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded-3xl ring-1 ring-border/70 shadow-xl shadow-primary/5">
          <div className="grid lg:grid-cols-2">
            {AUDIENCES.map((audience, index) => (
              <article
                key={audience.id}
                className={cn(
                  "relative flex min-h-full flex-col p-8 sm:p-10 lg:p-12",
                  audience.panelClass,
                  index === 1 && "border-t border-border/60 lg:border-l lg:border-t-0"
                )}
              >
                <audience.art className="relative -mx-2 -mt-4 mb-2 h-auto w-full max-w-sm self-center sm:-mt-6" />

                <div className="relative flex flex-1 flex-col gap-6">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset",
                        audience.iconClass
                      )}
                    >
                      <audience.icon className="h-5 w-5" aria-hidden />
                    </span>
                    <p className="text-sm font-medium text-muted-foreground">
                      {audience.label}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
                      {audience.title}
                    </h3>
                    <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {audience.description}
                    </p>
                  </div>

                  <ul className="space-y-3 border-t border-border/50 pt-6">
                    {audience.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-3 text-sm leading-snug text-foreground/90"
                      >
                        <span
                          aria-hidden
                          className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={audience.href}
                    className={buttonVariants({
                      variant: audience.id === "host" ? "default" : "outline",
                      className:
                        "group/btn mt-auto w-full self-start sm:w-auto",
                    })}
                  >
                    {audience.cta}
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
