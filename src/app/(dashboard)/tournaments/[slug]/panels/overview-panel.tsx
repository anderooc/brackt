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
import {
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  Radio,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { TournamentHostSchoolLink } from "@/components/tournament-host-school-link";
import { TournamentHeaderMeta } from "@/components/tournament-header-meta";
import type { HostChecklistStep } from "@/lib/tournaments/permissions";
import type { TournamentHostSchool } from "@/lib/tournaments/host-school";
import { cn } from "@/lib/utils";
import type { TeamGender, TeamRegion, TournamentStatus } from "@/types";
import { tournamentTabUrl, type TournamentTabId } from "../constants";
import { EditListingButton } from "../listing-details-dialog";
import { StatusStepButton } from "../status-step-button";

type StepAction =
  | { kind: "link"; href: string; label: string }
  | { kind: "status"; status: TournamentStatus; label: string }
  | { kind: "listing"; label: string };

export type OverviewTournament = {
  id: string;
  slug: string;
  status: string;
  description: string | null;
  location: string;
  address: string | null;
  date: string;
  gender: TeamGender;
  region: TeamRegion;
  registrationCapacity: number | null;
};

type SharedProps = {
  tournament: OverviewTournament;
  organizerName: string;
  hostSchool: TournamentHostSchool | null;
  allowedTabs: ReadonlySet<TournamentTabId>;
  confirmedCount: number;
};

function stepAction(
  step: HostChecklistStep,
  ctx: {
    slug: string;
    status: string;
    archived: boolean;
    pendingCount: number;
    allowedTabs: ReadonlySet<TournamentTabId>;
  }
): StepAction | null {
  const tab = (...candidates: TournamentTabId[]) => {
    const found = candidates.find((id) => ctx.allowedTabs.has(id));
    return found ? tournamentTabUrl(ctx.slug, found) : null;
  };
  const link = (href: string | null, label: string): StepAction | null =>
    href ? { kind: "link", href, label } : null;
  const status = (next: TournamentStatus, label: string): StepAction | null =>
    ctx.archived ? null : { kind: "status", status: next, label };

  switch (step.id) {
    case "listing":
      return ctx.archived
        ? null
        : { kind: "listing", label: "Edit listing details" };
    case "setup":
      return link(tab("setup"), "Add pools & courts");
    case "open":
      return status("registration_open", "Open registration");
    case "confirm":
      if (ctx.pendingCount > 0) {
        return link(tab("pending"), "Review pending teams");
      }
      if (ctx.status === "registration_open") {
        return status("registration_closed", "Close registration");
      }
      return link(tab("teams"), "View teams");
    case "pool-settings":
      return link(tab("pool-play", "bracket", "setup"), "Configure pool settings");
    case "pools":
      return link(tab("teams"), "Assign teams");
    case "bracket-settings":
      return link(tab("bracket"), "Configure brackets");
    case "release":
      return link(tab("pool-play"), "Release pools");
    case "bracket":
      return link(tab("bracket"), "Open bracket");
    case "schedule":
      return link(tab("matches") ?? "/schedule", "Schedule matches");
    case "run":
      return status("in_progress", "Start event");
    default:
      return null;
  }
}

type StepDestination = { kind: "link"; href: string } | { kind: "listing" };

/** Where a step is done, so every checklist row can jump straight there. */
function stepDestination(
  step: HostChecklistStep,
  ctx: {
    slug: string;
    pendingCount: number;
    allowedTabs: ReadonlySet<TournamentTabId>;
  }
): StepDestination | null {
  const tab = (...candidates: TournamentTabId[]): StepDestination | null => {
    const found = candidates.find((id) => ctx.allowedTabs.has(id));
    return found
      ? { kind: "link", href: tournamentTabUrl(ctx.slug, found) }
      : null;
  };

  switch (step.id) {
    case "listing":
      return { kind: "listing" };
    case "setup":
      return tab("setup");
    case "confirm":
      return ctx.pendingCount > 0 ? tab("pending", "teams") : tab("teams");
    case "pool-settings":
      return tab("pool-play", "bracket", "setup");
    case "pools":
      return tab("teams");
    case "bracket-settings":
    case "bracket":
      return tab("bracket");
    case "release":
      return tab("pool-play");
    case "schedule":
      return tab("matches") ?? { kind: "link", href: "/schedule" };
    case "run":
      return { kind: "link", href: `/tournaments/${ctx.slug}/scoring` };
    default:
      return null;
  }
}

function StepActionControl({
  action,
  tournament,
  primary,
}: {
  action: StepAction;
  tournament: OverviewTournament;
  primary: boolean;
}) {
  if (action.kind === "status") {
    return (
      <StatusStepButton
        tournamentId={tournament.id}
        status={action.status}
        label={action.label}
      />
    );
  }
  if (action.kind === "listing") {
    return (
      <EditListingButton
        tournamentId={tournament.id}
        details={tournament}
        label={action.label}
        variant={primary ? "default" : "outline"}
      />
    );
  }
  return (
    <Link
      href={action.href}
      className={buttonVariants({
        size: "sm",
        variant: primary ? "default" : "outline",
      })}
    >
      {action.label}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

function AboutSection({
  tournament,
  organizerName,
  hostSchool,
  editable,
}: {
  tournament: OverviewTournament;
  organizerName: string;
  hostSchool: TournamentHostSchool | null;
  editable: boolean;
}) {
  return (
    <section aria-labelledby="overview-about" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="overview-about"
          className="text-base font-semibold tracking-tight"
        >
          About this event
        </h2>
        {editable ? (
          <EditListingButton
            tournamentId={tournament.id}
            details={tournament}
            label="Edit"
            variant="ghost"
          />
        ) : null}
      </div>
      {tournament.description ? (
        <p className="max-w-prose whitespace-pre-wrap text-pretty text-sm leading-relaxed">
          {tournament.description}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {editable
            ? "No description yet. Add the start time, entry fees, and format so teams know what to expect."
            : "The host hasn’t added details yet."}
        </p>
      )}
      <TournamentHeaderMeta
        location={tournament.location}
        address={tournament.address}
        date={tournament.date}
        organizerName={organizerName}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <TeamAttributesBadges
          gender={tournament.gender}
          region={tournament.region}
        />
        <TournamentHostSchoolLink school={hostSchool} />
      </div>
    </section>
  );
}

function StatList({
  items,
}: {
  items: { label: string; value: string; href?: string | null }[];
}) {
  return (
    <dl className="divide-y divide-border/70 border-y border-border/70">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-4 py-2.5 text-sm"
        >
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-medium tabular-nums">
            {item.href ? (
              <Link
                href={item.href}
                aria-label={`${item.label}: ${item.value}`}
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item.value}
              </Link>
            ) : (
              item.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function teamsValue(confirmed: number, capacity: number | null): string {
  return capacity ? `${confirmed} of ${capacity}` : String(confirmed);
}

export function TournamentOverviewHostPanel({
  tournament,
  organizerName,
  hostSchool,
  allowedTabs,
  confirmedCount,
  pendingCount,
  divisionCount,
  courtCount,
  steps,
  archived,
}: SharedProps & {
  pendingCount: number;
  divisionCount: number;
  courtCount: number;
  steps: HostChecklistStep[];
  archived: boolean;
}) {
  const ctx = {
    slug: tournament.slug,
    status: tournament.status,
    archived,
    pendingCount,
    allowedTabs,
  };
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);
  const next = nextIndex >= 0 ? steps[nextIndex] : null;
  const nextAction = next ? stepAction(next, ctx) : null;
  const href = (id: TournamentTabId) =>
    allowedTabs.has(id) ? tournamentTabUrl(tournament.slug, id) : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <section aria-labelledby="overview-next" className="min-w-0 space-y-6">
        <div className="rounded-xl border bg-primary/[0.04] p-5 dark:bg-primary/[0.08]">
          <p className="text-sm text-muted-foreground tabular-nums">
            {doneCount} of {steps.length} steps done
          </p>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Setup progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{
                width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%`,
              }}
            />
          </div>
          {next ? (
            <div className="mt-5 space-y-3">
              <h2
                id="overview-next"
                className="text-lg font-semibold tracking-tight text-balance"
              >
                Next: {next.label}
              </h2>
              {next.hint ? (
                <p className="max-w-prose text-sm text-muted-foreground">
                  {next.hint}
                </p>
              ) : null}
              {nextAction ? (
                <StepActionControl
                  action={nextAction}
                  tournament={tournament}
                  primary
                />
              ) : null}
            </div>
          ) : (
            <div className="mt-5 space-y-1">
              <h2
                id="overview-next"
                className="text-lg font-semibold tracking-tight"
              >
                You’re all set
              </h2>
              <p className="text-sm text-muted-foreground">
                Every step is done. Follow the action from the Play tab.
              </p>
            </div>
          )}
        </div>

        <ol className="space-y-1" aria-label="Host checklist">
          {steps.map((step, index) => {
            const isNext = index === nextIndex;
            const reachable = stepDestination(step, ctx);
            const destination =
              reachable?.kind === "listing" && archived ? null : reachable;
            const rowClass = cn(
              "group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-150 ease-out",
              isNext && "bg-muted/60",
              destination &&
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            );
            const content = (
              <>
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                    step.done
                      ? "border-primary bg-primary text-primary-foreground"
                      : isNext
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    step.done ? "text-muted-foreground" : "font-medium"
                  )}
                >
                  {step.label}
                  <span className="sr-only">
                    {step.done ? " (done)" : isNext ? " (next)" : ""}
                  </span>
                </span>
                {destination ? (
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden
                  />
                ) : null}
              </>
            );
            return (
              <li key={step.id} aria-current={isNext ? "step" : undefined}>
                {destination?.kind === "link" ? (
                  <Link href={destination.href} className={rowClass}>
                    {content}
                  </Link>
                ) : destination?.kind === "listing" ? (
                  <EditListingButton
                    tournamentId={tournament.id}
                    details={tournament}
                    className={rowClass}
                    unstyled
                  >
                    {content}
                  </EditListingButton>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="min-w-0 space-y-8">
        <section aria-labelledby="overview-glance" className="space-y-3">
          <h2
            id="overview-glance"
            className="text-base font-semibold tracking-tight"
          >
            At a glance
          </h2>
          <StatList
            items={[
              {
                label: "Confirmed teams",
                value: teamsValue(
                  confirmedCount,
                  tournament.registrationCapacity
                ),
                href: href("teams"),
              },
              {
                label: "Pending",
                value: String(pendingCount),
                href: href("pending"),
              },
              {
                label: "Pools",
                value: String(divisionCount),
                href: href("setup"),
              },
              {
                label: "Courts",
                value: String(courtCount),
                href: href("setup"),
              },
            ]}
          />
        </section>
        <AboutSection
          tournament={tournament}
          organizerName={organizerName}
          hostSchool={hostSchool}
          editable={!archived}
        />
      </div>
    </div>
  );
}

export function TournamentOverviewPublicPanel({
  tournament,
  organizerName,
  hostSchool,
  allowedTabs,
  confirmedCount,
  myPendingCount,
  canRegister,
  canDownloadPacket,
}: SharedProps & {
  myPendingCount: number;
  canRegister: boolean;
  canDownloadPacket: boolean;
}) {
  const playTab = (["pool-play", "bracket", "matches"] as const).find((id) =>
    allowedTabs.has(id)
  );
  const teamTasks = (["waiver", "payment"] as const).filter((id) =>
    allowedTabs.has(id)
  );

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12">
      <div className="min-w-0 space-y-8">
        {myPendingCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-primary/[0.04] p-4 dark:bg-primary/[0.08]">
            <p className="text-sm">
              <span className="font-medium">Your application is in review.</span>{" "}
              <span className="text-muted-foreground">
                The host will confirm your team soon.
              </span>
            </p>
            <Link
              href={tournamentTabUrl(tournament.slug, "pending")}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              View application
            </Link>
          </div>
        ) : null}
        <AboutSection
          tournament={tournament}
          organizerName={organizerName}
          hostSchool={hostSchool}
          editable={false}
        />
      </div>

      <div className="min-w-0 space-y-8">
        <section aria-labelledby="overview-actions" className="space-y-3">
          <h2
            id="overview-actions"
            className="text-base font-semibold tracking-tight"
          >
            Get involved
          </h2>
          <div className="flex flex-col gap-2">
            {canRegister ? (
              <Link
                href={`/tournaments/${tournament.slug}/register`}
                className={buttonVariants({ className: "w-full" })}
              >
                Register a team
              </Link>
            ) : null}
            {playTab ? (
              <Link
                href={tournamentTabUrl(tournament.slug, playTab)}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full",
                })}
              >
                Pools, brackets & results
              </Link>
            ) : null}
            <Link
              href={`/tournaments/${tournament.slug}/scoring`}
              className={buttonVariants({
                variant: "outline",
                className: "w-full",
              })}
            >
              <Radio className="size-4" aria-hidden />
              Live scoring
            </Link>
            {canDownloadPacket ? (
              <Link
                href={`/tournaments/${tournament.slug}/packet`}
                className={buttonVariants({
                  variant: "ghost",
                  className: "w-full",
                })}
              >
                <Download className="size-4" aria-hidden />
                Tournament packet
              </Link>
            ) : null}
            {teamTasks.map((id) => (
              <Link
                key={id}
                href={tournamentTabUrl(tournament.slug, id)}
                className={buttonVariants({
                  variant: "ghost",
                  className: "w-full",
                })}
              >
                {id === "waiver" ? "Team waiver" : "Team payment"}
              </Link>
            ))}
          </div>
        </section>
        <StatList
          items={[
            {
              label: "Confirmed teams",
              value: teamsValue(confirmedCount, tournament.registrationCapacity),
            },
          ]}
        />
      </div>
    </div>
  );
}
