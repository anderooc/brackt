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

import {
  CreditCard,
  FileText,
  MessageSquare,
  ScrollText,
} from "lucide-react";
import { ScrollReveal } from "@/components/marketing/scroll-reveal";

const OPERATIONS_FEATURES = [
  {
    icon: ScrollText,
    title: "Digital waivers",
    desc: "Collect signatures before game day and track who still needs to complete paperwork.",
  },
  {
    icon: CreditCard,
    title: "Registration payments",
    desc: "Set entry fees, record payments, and see who has paid without chasing Venmo screenshots.",
  },
  {
    icon: MessageSquare,
    title: "Tournament chat",
    desc: "Keep hosts and captains aligned with announcements and replies in one thread per event.",
  },
  {
    icon: FileText,
    title: "Tournament packet",
    desc: "Share rules, court maps, and host notes so every team has the same info before they arrive.",
  },
] as const;

export function OperationsFeaturesSection() {
  return (
    <section className="border-t" aria-labelledby="operations-heading">
      <div className="container mx-auto px-4 py-20">
        <ScrollReveal className="max-w-2xl">
          <h2
            id="operations-heading"
            className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
          >
            Beyond brackets and scores
          </h2>
          <p className="mt-3 max-w-xl text-pretty text-muted-foreground">
            Waivers, payments, comms, and packets live here too. The admin work
            around a tournament, not just game day.
          </p>
        </ScrollReveal>

        <ul className="mt-10 grid gap-8 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-10 lg:max-w-4xl">
          {OPERATIONS_FEATURES.map((feature, index) => (
            <ScrollReveal
              key={feature.title}
              as="li"
              delayMs={(index % 2) * 90}
              className="group flex gap-4"
            >
              <feature.icon
                className="mt-0.5 h-5 w-5 shrink-0 text-primary transition-transform duration-500 ease-out group-data-[revealed]:scale-110"
                aria-hidden
              />
              <div className="min-w-0">
                <h3 className="font-heading font-semibold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
