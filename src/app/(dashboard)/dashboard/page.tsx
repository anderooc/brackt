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

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatTournamentDateDisplay } from "@/lib/date-iso";
import { getUserSchoolSummary } from "@/lib/schools/navigation";
import { getDashboardTournaments } from "@/lib/tournaments/dashboard";
import { loadPersonalScheduleForViewer } from "@/lib/api/queries/personal-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import {
  Trophy,
  Users,
  Calendar,
  Plus,
  Compass,
  ArrowRight,
  Clock,
  GraduationCap,
  CalendarPlus,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";
import { cn } from "@/lib/utils";
import {
  PersonalScheduleMatchList,
  UpNextMatch,
} from "@/components/schedule/personal-schedule-match-list";

export const metadata = pageMetadata("Dashboard");

export const dynamic = "force-dynamic";

const SCHEDULE_PREVIEW_COUNT = 4;

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [userTeams, allMyTournaments, school, personalSchedule] =
    await Promise.all([
    db
      .select({
        id: teams.id,
        slug: teams.slug,
        name: teams.name,
        university: teams.university,
        gender: teams.gender,
        region: teams.region,
        role: teamMembers.role,
        jerseyNumber: teamMembers.jerseyNumber,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, user.id)),
    // No limit — players rarely have enough connected events to need one,
    // and stats should reflect the full set.
    getDashboardTournaments(user.id),
    getUserSchoolSummary(user.id),
    loadPersonalScheduleForViewer(user),
  ]);

  const [nextMatch, ...laterMatches] = personalSchedule.matches;
  const shownLater = laterMatches.slice(0, SCHEDULE_PREVIEW_COUNT);
  const hiddenLater = laterMatches.slice(SCHEDULE_PREVIEW_COUNT);

  const upcomingCount = allMyTournaments.filter((t) => t.relation !== "past").length;
  const pendingCount = allMyTournaments.filter((t) => t.relation === "pending").length;
  const pastCount = allMyTournaments.filter((t) => t.relation === "past").length;
  const myTournaments = allMyTournaments.slice(0, 12);

  const firstName = user.fullName.split(" ")[0];
  const isNewUser =
    userTeams.length === 0 && allMyTournaments.length === 0 && !school;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          school
            ? `Your hub for ${school.name} — teams, signups, and tournaments.`
            : "Your teams, signups, and tournaments."
        }
      />

      {!isNewUser && (userTeams.length > 0 || nextMatch) ? (
        <section
          id="your-schedule"
          aria-labelledby="dashboard-schedule"
          className="scroll-mt-20 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="dashboard-schedule"
              className="text-lg font-semibold tracking-tight"
            >
              Your schedule
            </h2>
            {nextMatch ? (
              <a
                href="/api/v1/me/schedule.ics"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <CalendarPlus className="mr-2 h-4 w-4" />
                Add to calendar
              </a>
            ) : null}
          </div>
          {nextMatch ? (
            <UpNextMatch match={nextMatch} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No matches scheduled yet. Your teams’ matches and ref duties show
              up here once a host releases the schedule.
            </p>
          )}
          {shownLater.length > 0 ? (
            <PersonalScheduleMatchList matches={shownLater} />
          ) : null}
          {hiddenLater.length > 0 ? (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                  className="h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
                <span className="group-open:hidden">
                  Show {hiddenLater.length} more
                </span>
                <span className="hidden group-open:inline">Show fewer</span>
              </summary>
              <div className="mt-4">
                <PersonalScheduleMatchList matches={hiddenLater} />
              </div>
            </details>
          ) : null}
        </section>
      ) : null}

      {isNewUser ? (
        <Card className="relative overflow-hidden border-dashed">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 text-foreground/[0.05] bg-court-lines [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
          />
          <CardContent className="relative py-10">
            <div className="mx-auto max-w-xl text-center">
              <h2 className="font-heading text-xl font-semibold tracking-tight">
                Get started
              </h2>
              <p className="mt-2 text-pretty text-sm text-muted-foreground">
                Create your first team, run a tournament, or explore what other
                clubs are up to.
              </p>
              <div className="mt-6 grid divide-y border border-border/80 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Link
                  href="/teams/new"
                  className="group flex flex-col items-start gap-1 p-4 text-left transition-colors duration-150 hover:bg-muted/40"
                >
                  <Users className="h-4 w-4 text-primary" />
                  <span className="mt-2 font-medium">Create a team</span>
                  <span className="text-xs text-muted-foreground">
                    Add your roster or invite players by email.
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Start
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
                <Link
                  href="/tournaments/new"
                  className="group flex flex-col items-start gap-1 p-4 text-left transition-colors duration-150 hover:bg-muted/40"
                >
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="mt-2 font-medium">Run a tournament</span>
                  <span className="text-xs text-muted-foreground">
                    Configure pools, courts, and brackets.
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Start
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
                <Link
                  href="/explore"
                  className="group flex flex-col items-start gap-1 p-4 text-left transition-colors duration-150 hover:bg-muted/40"
                >
                  <Compass className="h-4 w-4 text-primary" />
                  <span className="mt-2 font-medium">Browse tournaments</span>
                  <span className="text-xs text-muted-foreground">
                    See what&apos;s happening across clubs.
                  </span>
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">
                    Explore
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="My Teams"
            value={userTeams.length}
            icon={Users}
            accent="primary"
          />
          <StatCard
            label="Upcoming"
            value={upcomingCount}
            icon={Calendar}
            accent="secondary"
            hint={
              pendingCount > 0
                ? `${pendingCount} pending acceptance`
                : undefined
            }
          />
          <StatCard
            label="Past events"
            value={pastCount}
            icon={Clock}
            accent="primary"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Teams</CardTitle>
            <Link
              href="/teams/new"
              className={buttonVariants({ size: "sm" })}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Team
            </Link>
          </CardHeader>
          <CardContent className="pt-0">
            {school ? (
              <Link
                href={`/schools/${school.slug}`}
                className="mb-3 flex items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
              >
                <GraduationCap className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">School · </span>
                  <span className="font-medium">{school.name}</span>
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            ) : null}
            {userTeams.length === 0 ? (
              <EmptyState
        illustration="teams"
                variant="inline"
                icon={Users}
                title="No teams yet"
                description="Create a team to manage your roster and register for tournaments."
              />
            ) : (
              <div className="list-stack">
                {userTeams.map((team) => (
                  <Link
                    key={team.id}
                    href={`/teams/${team.slug}`}
                    className="list-row"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{team.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {team.university}
                        {team.jerseyNumber != null ? (
                          <>
                            <span className="mx-1.5">&middot;</span>
                            #{team.jerseyNumber}
                          </>
                        ) : null}
                      </p>
                      <TeamAttributesBadges
                        gender={team.gender}
                        region={team.region}
                        className="mt-1.5"
                      />
                    </div>
                    <Badge variant="secondary" className="ml-3 shrink-0 capitalize">
                      {team.role}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>My Tournaments</CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/explore"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                <Compass className="mr-2 h-4 w-4" />
                Browse
              </Link>
              <Link
                href="/tournaments/new"
                className={buttonVariants({ size: "sm" })}
              >
                <Plus className="mr-2 h-4 w-4" />
                New
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {myTournaments.length === 0 ? (
              <EmptyState
        illustration="tournaments"
                variant="inline"
                icon={Trophy}
                title="No tournaments yet"
                description="Tournaments your teams sign up for, or that you host, will show up here."
              />
            ) : (
              <div className="list-stack">
                {myTournaments.map((t) => {
                  const meta = [
                    formatTournamentDateDisplay(t.date),
                    t.location,
                    t.teamName,
                    t.divisionName,
                  ].filter(Boolean);

                  return (
                    <Link
                      key={t.id}
                      href={`/tournaments/${t.slug}`}
                      className="list-row items-start"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {meta.map((part, i) => (
                            <span key={`${part}-${i}`}>
                              {i > 0 ? (
                                <span className="mx-1.5">&middot;</span>
                              ) : null}
                              {part}
                            </span>
                          ))}
                        </p>
                        {t.status === "in_progress" && t.relation !== "past" ? (
                          <StatusBadge
                            kind="tournament"
                            status={t.status}
                            date={t.date}
                            className="mt-1.5"
                          />
                        ) : null}
                      </div>
                      <StatusBadge
                        kind="dashboard_relation"
                        status={t.relation}
                        className="ml-3 mt-0.5 shrink-0"
                      />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  hint,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "primary" | "secondary";
  hint?: string;
}) {
  const accentClasses =
    accent === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-secondary text-secondary-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-inset ring-border/60",
            accentClasses
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-3xl font-bold tracking-tight">
          {value}
        </div>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
