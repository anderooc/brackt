"use client";

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

import { Trophy, Users, Calendar, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

const FEATURES: {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
}[] = [
  {
    icon: Trophy,
    title: "Tournament Management",
    desc: "Spin up divisions, pools, and brackets, then run the whole event from draft to finals.",
    accent: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: Users,
    title: "Team Registration",
    desc: "Register your club, manage rosters and jersey numbers, and track application status.",
    accent: "from-secondary/15 to-secondary/5 text-secondary",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Auto-generate court assignments and time slots with warmup windows built in.",
    accent: "from-primary/15 to-primary/5 text-primary",
  },
  {
    icon: Zap,
    title: "Live Scoring",
    desc: "Real-time set scores and standings so players, captains, and fans never lose the thread.",
    accent: "from-secondary/15 to-secondary/5 text-secondary",
  },
];

export function HomepageFeaturesSection() {
  return (
    <section className="relative border-t" aria-labelledby="features-heading">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-line-grid [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,black,transparent)]"
      />
      <div className="container relative mx-auto px-4 py-20">
        <ScrollReveal className="max-w-2xl">
          <h2
            id="features-heading"
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Everything to run game day
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            From the first registration to the final point.
          </p>
        </ScrollReveal>

        <div className="mt-12 overflow-hidden rounded-3xl ring-1 ring-border/70">
          {FEATURES.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              as="article"
              delayMs={index * 70}
              className={cn(
                "group relative grid gap-6 overflow-hidden px-6 py-8 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:px-10 sm:py-10",
                index > 0 && "border-t border-border/60",
                index % 2 === 0
                  ? "bg-muted/20"
                  : "bg-gradient-to-r from-primary/[0.05] via-card to-secondary/[0.05]"
              )}
            >
              <feature.icon
                aria-hidden
                className="pointer-events-none absolute -bottom-6 -right-4 h-28 w-28 text-foreground/[0.04] transition-transform duration-500 ease-out group-data-[revealed]:scale-105 sm:h-32 sm:w-32"
              />
              <div
                className={cn(
                  "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-inset ring-foreground/5 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  "group-hover:scale-105 group-data-[revealed]:shadow-md",
                  feature.accent
                )}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <div className="relative min-w-0">
                <h3 className="font-heading text-xl font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {feature.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
