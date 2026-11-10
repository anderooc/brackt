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

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, format } from "date-fns";
import { eq } from "drizzle-orm";
import {
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  Compass,
  FileSignature,
  GraduationCap,
  Plus,
  Trophy,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, teamMembers } from "@/lib/db/schema";
import { parseISODate } from "@/lib/date-iso";
import { todayISO } from "@/lib/tournament-status";
import { getUserSchoolSummary } from "@/lib/schools/navigation";
import {
  getDashboardActivity,
  getDashboardTournaments,
  type DashboardHostingStats,
  type DashboardTournament,
} from "@/lib/tournaments/dashboard";
import type {
  AttentionItem,
  AttentionKind,
} from "@/lib/tournaments/dashboard-attention";
import { formatFeeCents } from "@/lib/tournaments/payment-settings";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { tournamentTabUrl } from "@/app/(dashboard)/tournaments/[slug]/constants";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  PersonalScheduleMatchList,
  UpNextMatch,
} from "@/components/schedule/personal-schedule-match-list";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata("Dashboard");

export const dynamic = "force-dynamic";

const SCHEDULE_PREVIEW_COUNT = 4;
const PAST_PREVIEW_COUNT = 8;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Wrapped so the query runs once even though two consumers await it.
  const userTeamsPromise = Promise.resolve(
    db
      .select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        role: teamMembers.role,
        jerseyNumber: teamMembers.jerseyNumber,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id))
  );

  const today = todayISO();
  const [userTeams, school, personalSchedule, { tournaments, activity }] =
    await Promise.all([
      userTeamsPromise,
      getUserSchoolSummary(user.id),
      loadPersonalScheduleForViewer(user, { fromDate: today }),
      Promise.all([getDashboardTournaments(user.id), userTeamsPromise]).then(
        async ([tournaments, memberships]) => ({
          tournaments,
          activity: await getDashboardActivity(
            user.id,
            tournaments,
            memberships.map((m) => ({ teamId: m.id, role: m.role }))
          ),
        })
      ),
    ]);

  const hosting = tournaments.filter((t) => t.relation !== "past" && t.isOrganizer);
  const upcoming = tournaments.filter(
    (t) => t.relation !== "past" && !t.isOrganizer
  );
  const past = tournaments.filter((t) => t.relation === "past");
  const { attention } = activity;

  const [nextMatch, ...laterMatches] = personalSchedule.matches;
  const shownLater = laterMatches.slice(0, SCHEDULE_PREVIEW_COUNT);
  const hiddenLater = laterMatches.slice(SCHEDULE_PREVIEW_COUNT);

  const firstName = user.fullName.split(" ")[0];
  const isNewUser =
    userTeams.length === 0 && tournaments.length === 0 && !school;
  const showSchedule = userTeams.length > 0 || Boolean(nextMatch);

  if (isNewUser) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <DashboardHeading firstName={firstName} summary="Let’s get you on the court." />
        <GetStarted />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <DashboardHeading
        firstName={firstName}
        summary={headlineSummary(attention.length, [...hosting, ...upcoming], today)}
      />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 space-y-10">
          {attention.length > 0 ? (
            <DashboardSection id="needs-you" title="Needs you">
              <AttentionList items={attention} today={today} />
            </DashboardSection>
          ) : null}

          {showSchedule ? (
            <DashboardSection
              id="your-schedule"
              title="Your schedule"
              action={
                nextMatch ? (
                  <a
                    href="/api/v1/me/schedule.ics"
                    className={buttonVariants({ size: "sm", variant: "ghost" })}
                  >
                    <CalendarPlus aria-hidden />
                    Add to calendar
                  </a>
                ) : null
              }
            >
              {nextMatch ? (
                <div className="space-y-5">
                  <UpNextMatch match={nextMatch} />
                  {shownLater.length > 0 ? (
                    <PersonalScheduleMatchList matches={shownLater} />
                  ) : null}
                  {hiddenLater.length > 0 ? (
                    <ShowMore count={hiddenLater.length}>
                      <PersonalScheduleMatchList matches={hiddenLater} />
                    </ShowMore>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No matches yet. Your games and ref duties land here once a
                  host releases the schedule.
                </p>
              )}
            </DashboardSection>
          ) : null}

          {hosting.length > 0 ? (
            <DashboardSection
              id="hosting"
              title="Hosting"
              action={
                <Link
                  href="/tournaments/new"
                  className={buttonVariants({ size: "sm", variant: "ghost" })}
                >
                  <Plus aria-hidden />
                  New tournament
                </Link>
              }
            >
              <ul className="list-stack border-y border-border/70">
                {hosting.map((t) => (
                  <HostingRow
                    key={t.id}
                    tournament={t}
                    stats={activity.hosting.get(t.id)}
                    today={today}
                  />
                ))}
              </ul>
            </DashboardSection>
          ) : null}

          <DashboardSection
            id="upcoming"
            title="Upcoming events"
            action={
              <Link
                href="/explore"
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                <Compass aria-hidden />
                Find a tournament
              </Link>
            }
          >
            {upcoming.length > 0 ? (
              <ul className="list-stack border-y border-border/70">
                {upcoming.map((t) => (
                  <EventRow key={t.id} tournament={t} today={today} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {hosting.length > 0
                  ? "None of your teams are signed up for another event."
                  : "Nothing on the calendar. Find a tournament for your team to enter."}
              </p>
            )}
          </DashboardSection>

          {past.length > 0 ? (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
                Past events ({past.length})
              </summary>
              <ul className="list-stack mt-3 border-y border-border/70">
                {past.slice(0, PAST_PREVIEW_COUNT).map((t) => (
                  <EventRow key={t.id} tournament={t} today={today} />
                ))}
              </ul>
              {past.length > PAST_PREVIEW_COUNT ? (
                <Link
                  href="/tournaments"
                  className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                >
                  All tournaments
                </Link>
              ) : null}
            </details>
          ) : null}
        </div>

        <aside className="space-y-8 lg:border-l lg:border-border/70 lg:pl-8">
          <DashboardSection
            id="your-teams"
            title="Your teams"
            action={
              <Link
                href="/teams/new"
                aria-label="Create a team"
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              >
                <Plus aria-hidden />
              </Link>
            }
          >
            {userTeams.length > 0 ? (
              <ul className="-mx-2 space-y-0.5">
                {userTeams.map((team) => (
                  <li key={team.id}>
                    <Link
                      href={`/teams/${team.slug}`}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <TeamMonogram name={team.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {team.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[
                            team.role === "captain" ? "Captain" : "Player",
                            team.jerseyNumber != null ? `#${team.jerseyNumber}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                You’re not on a roster yet.{" "}
                <Link href="/teams" className="font-medium text-primary hover:underline">
                  Find your team
                </Link>{" "}
                or create one.
              </p>
            )}
          </DashboardSection>

          {school ? (
            <DashboardSection id="your-school" title="Your school">
              <Link
                href={`/schools/${school.slug}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <GraduationCap className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {school.name}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </DashboardSection>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/schools" className="font-medium text-primary hover:underline">
                Join your school
              </Link>{" "}
              to see events your club hosts.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function headlineSummary(
  attentionCount: number,
  upcoming: DashboardTournament[],
  today: string
): string {
  const next = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0];
  let nextPart = "Nothing on the calendar yet.";
  if (next) {
    const when = relativeDay(next.date, today);
    nextPart = `${next.name} is ${
      when
        ? when.toLowerCase()
        : `on ${format(parseISODate(next.date), "MMMM d")}`
    }.`;
  }
  if (attentionCount === 0) return `You’re all caught up. ${nextPart}`;
  return `${attentionCount} ${attentionCount === 1 ? "thing needs" : "things need"} you. ${nextPart}`;
}

/** "Today", "Tomorrow", "In 5 days"; null for past dates or two+ weeks out. */
function relativeDay(date: string, today: string): string | null {
  const days = differenceInCalendarDays(parseISODate(date), parseISODate(today));
  if (days < 0 || days >= 14) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function DashboardHeading({
  firstName,
  summary,
}: {
  firstName: string;
  summary: string;
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">
        Hi, {firstName}
      </h1>
      <p className="text-pretty text-sm text-muted-foreground sm:text-base">
        {summary}
      </p>
    </div>
  );
}

function DashboardSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-20 space-y-3"
    >
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ShowMore({ count, children }: { count: number; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <ChevronDown
          className="size-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
          aria-hidden
        />
        <span className="group-open:hidden">Show {count} more</span>
        <span className="hidden group-open:inline">Show fewer</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

const ATTENTION_ICON: Record<AttentionKind, typeof Users> = {
  approve_teams: UserCheck,
  review_payments: Wallet,
  pay_fee: Wallet,
  sign_waiver: FileSignature,
  collect_waivers: FileSignature,
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function attentionCopy(item: AttentionItem): {
  title: string;
  detail: string | null;
  cta: string;
  href: string;
} {
  const slug = item.tournament.slug;
  const count = item.count ?? 0;
  switch (item.kind) {
    case "approve_teams":
      return {
        title: `Approve ${plural(count, "team", "teams")}`,
        detail: null,
        cta: "Review",
        href: tournamentTabUrl(slug, "pending"),
      };
    case "review_payments":
      return {
        title: `Confirm ${plural(count, "payment", "payments")}`,
        detail: null,
        cta: "Review",
        href: tournamentTabUrl(slug, "payment"),
      };
    case "pay_fee":
      return {
        title:
          item.amountCents != null
            ? `Pay the ${formatFeeCents(item.amountCents)} entry fee`
            : "Pay the entry fee",
        detail: item.teamName ?? null,
        cta: "Pay",
        href: tournamentTabUrl(slug, "payment"),
      };
    case "sign_waiver":
      return {
        title: "Sign the waiver",
        detail: null,
        cta: "Sign",
        href: tournamentTabUrl(slug, "waiver"),
      };
    case "collect_waivers":
      return {
        title: `${plural(count, "teammate hasn’t", "teammates haven’t")} signed the waiver`,
        detail: item.teamName ?? null,
        cta: "View",
        href: tournamentTabUrl(slug, "waiver"),
      };
  }
}

function AttentionList({ items, today }: { items: AttentionItem[]; today: string }) {
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border">
      {items.map((item) => {
        const copy = attentionCopy(item);
        const Icon = ATTENTION_ICON[item.kind];
        const when =
          relativeDay(item.tournament.date, today) ??
          format(parseISODate(item.tournament.date), "MMM d");
        const meta = [item.tournament.name, copy.detail, when].filter(Boolean);
        return (
          <li key={item.key}>
            <Link
              href={copy.href}
              className="group flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium leading-snug">{copy.title}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {meta.join(" · ")}
                </span>
              </span>
              <span className="hidden text-sm font-medium text-primary sm:inline">
                {copy.cta}
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DateTile({ date, muted }: { date: string; muted?: boolean }) {
  const d = parseISODate(date);
  return (
    <span
      className={cn(
        "flex w-11 shrink-0 flex-col items-center rounded-lg border py-1 leading-none",
        muted ? "border-border/60 text-muted-foreground" : "bg-card"
      )}
      aria-hidden
    >
      <span className="text-[11px] font-medium text-muted-foreground">
        {format(d, "MMM")}
      </span>
      <span className="mt-1 text-lg font-semibold tabular-nums">{format(d, "d")}</span>
    </span>
  );
}

function EventRow({
  tournament: t,
  today,
}: {
  tournament: DashboardTournament;
  today: string;
}) {
  const isPast = t.relation === "past";
  const live = t.status === "in_progress" && !isPast;
  const when = isPast ? null : relativeDay(t.date, today);
  const entry = [t.teamName, t.divisionName].filter(Boolean).join(" · ");

  return (
    <li>
      <Link
        href={`/tournaments/${t.slug}`}
        className="flex items-center gap-4 px-1 py-3 transition-colors duration-150 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <DateTile date={t.date} muted={isPast} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{t.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[when, t.location].filter(Boolean).join(" · ")}
          </span>
          {entry ? (
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {entry}
            </span>
          ) : null}
        </span>
        {live ? (
          <StatusBadge kind="tournament" status={t.status} date={t.date} className="shrink-0" />
        ) : !isPast && t.relation !== "signed_up" ? (
          <StatusBadge kind="dashboard_relation" status={t.relation} className="shrink-0" />
        ) : null}
      </Link>
    </li>
  );
}

function HostingRow({
  tournament: t,
  stats,
  today,
}: {
  tournament: DashboardTournament;
  stats: DashboardHostingStats | undefined;
  today: string;
}) {
  const when = relativeDay(t.date, today);
  const facts: string[] = [];
  if (stats) {
    facts.push(
      stats.capacity != null
        ? `${stats.teamCount} of ${stats.capacity} teams`
        : plural(stats.teamCount, "team", "teams")
    );
    if (stats.pendingCount > 0) facts.push(`${stats.pendingCount} pending`);
    if (t.status === "registration_open" && stats.deadline) {
      facts.push(
        stats.deadlinePassed
          ? "Deadline passed"
          : `Closes ${format(stats.deadline, "MMM d")}`
      );
    }
  }
  const fill =
    stats?.capacity != null
      ? Math.min(100, Math.round((stats.teamCount / stats.capacity) * 100))
      : null;

  return (
    <li>
      <Link
        href={`/tournaments/${t.slug}`}
        className="flex items-center gap-4 px-1 py-3 transition-colors duration-150 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <DateTile date={t.date} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{t.name}</span>
          <span className="block truncate text-sm text-muted-foreground">
            {[when, ...facts].filter(Boolean).join(" · ")}
          </span>
          {fill != null && t.status !== "draft" ? (
            <span
              className="mt-2 block h-1 w-full max-w-48 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${fill}% of capacity filled`}
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${fill}%` }}
              />
            </span>
          ) : null}
        </span>
        <StatusBadge kind="tournament" status={t.status} date={t.date} className="shrink-0" />
      </Link>
    </li>
  );
}

function TeamMonogram({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
      aria-hidden
    >
      {initials}
    </span>
  );
}

function GetStarted() {
  const steps = [
    {
      href: "/teams",
      icon: Users,
      title: "Join your club team",
      body: "Find your roster, or create one and invite players by email.",
    },
    {
      href: "/explore",
      icon: Compass,
      title: "Find a tournament",
      body: "See what clubs near you are hosting and sign your team up.",
    },
    {
      href: "/tournaments/new",
      icon: Trophy,
      title: "Host a tournament",
      body: "Set up pools, courts, and brackets, then run scoring live.",
    },
  ];
  return (
    <ol className="divide-y divide-border/70 overflow-hidden rounded-xl border">
      {steps.map((step) => (
        <li key={step.href}>
          <Link
            href={step.href}
            className="group flex items-center gap-4 px-4 py-4 transition-colors duration-150 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <step.icon className="size-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{step.title}</span>
              <span className="block text-sm text-muted-foreground">{step.body}</span>
            </span>
            <ChevronRight
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ol>
  );
}
