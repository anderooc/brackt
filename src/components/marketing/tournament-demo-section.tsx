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
import { Play, CirclePlay } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { FollowBracketIllustration } from "@/components/brand/illustrations";
import {
  getTournamentDemoVideo,
  TOURNAMENT_DEMO_HIGHLIGHTS,
  type TournamentDemoVideo,
} from "@/lib/marketing/demo-video";

function DemoPlayer({ video }: { video: TournamentDemoVideo }) {
  if (video.kind === "file") {
    return (
      <video
        className="h-full w-full bg-black object-cover"
        controls
        playsInline
        preload="metadata"
        src={video.src}
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <iframe
      className="h-full w-full border-0"
      src={video.embedUrl}
      title="brackt tournament demo"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}

function DemoPlaceholder() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center bg-card p-6 sm:p-8">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-2 text-center">
        <FollowBracketIllustration className="mb-1 h-auto w-44 sm:w-60" />
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Play className="h-3.5 w-3.5 fill-current text-primary" aria-hidden />
          Demo video coming soon
        </p>
        <p className="max-w-sm text-xs text-muted-foreground">
          A full walkthrough of pools, brackets, scheduling, and live scoring is
          on the way.
        </p>
      </div>
    </div>
  );
}

export function TournamentDemoSection() {
  const video = getTournamentDemoVideo();

  return (
    <section
      id="demo"
      className="scroll-mt-20 border-t bg-background"
      aria-labelledby="demo-heading"
    >
      <div className="container mx-auto px-4 py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                <CirclePlay className="h-3.5 w-3.5 text-primary" aria-hidden />
                Product demo
              </span>
              <h2
                id="demo-heading"
                className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
              >
                See a tournament run on brackt
              </h2>
              <p className="max-w-xl text-pretty text-muted-foreground">
                Walk through setup, pool play, court scheduling, and live scoring
                — the full host workflow in one place instead of five different
                tools.
              </p>
            </div>

            <ol className="flex flex-col gap-3">
              {TOURNAMENT_DEMO_HIGHLIGHTS.map((item, index) => (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-semibold text-primary ring-1 ring-primary/15">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium leading-tight">{item.title}</p>
                    <p className="mt-1 text-sm leading-snug text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <Link
              href="/explore"
              className={buttonVariants({
                variant: "outline",
                className: "w-full sm:w-auto",
              })}
            >
              Browse tournaments
            </Link>
          </div>

          <div className="relative flex flex-col justify-center">
            <div className="relative w-full">
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-3 -right-3 -z-10 h-full w-full rounded-2xl bg-court-mesh ring-1 ring-border/60 sm:-bottom-4 sm:-right-4"
              />
              <div className="overflow-hidden rounded-2xl border bg-card shadow-lg shadow-primary/5 ring-1 ring-border/80">
                <div className="aspect-video w-full">
                  {video ? <DemoPlayer video={video} /> : <DemoPlaceholder />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
