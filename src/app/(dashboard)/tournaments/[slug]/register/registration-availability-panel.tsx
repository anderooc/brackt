/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PublicRegistrationAvailability } from "@/components/public-registration-availability";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { BackLink } from "@/components/layout/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import {
  OperationConflictError,
  OperationValidationError,
} from "@/lib/tournaments/competition-operation-rules";
import { invalidatePublicTournamentCachesByIds } from "@/lib/tournaments/public-cache-invalidation";
import type { PublicRegistrationAvailability as Availability } from "@/lib/tournaments/public-projection";
import {
  withdrawApplicantWaitlistEntry,
  type ApplicantWaitlistRow,
} from "@/lib/tournaments/applicant-waitlist";
import type { TeamGender, TeamRegion } from "@/types";
import { RegisterForm } from "./register-form";

interface RegistrationTeam {
  id: string;
  name: string;
  university: string;
  schoolId: string | null;
  schoolName: string | null;
}

interface RegistrationSchool {
  id: string;
  name: string;
  university: string;
}

interface RegistrationTournamentSummary {
  id: string;
  slug: string;
  name: string;
  gender: TeamGender;
  region: TeamRegion;
}

function registrationPageHref(slug: string): string {
  return `/tournaments/${encodeURIComponent(slug)}/register`;
}

async function submitApplicantWaitlistWithdrawal(
  tournamentId: string,
  tournamentSlug: string,
  teamId: string
): Promise<void> {
  "use server";
  const user = await requireUser();
  let errorMessage: string | null = null;
  try {
    await withdrawApplicantWaitlistEntry(
      { tournamentId, teamId, actorUserId: user.id },
      async () => {
        await invalidatePublicTournamentCachesByIds([tournamentId], {
          listing: true,
        });
        revalidatePath(`/tournaments/${tournamentSlug}`);
        revalidatePath(registrationPageHref(tournamentSlug));
      }
    );
  } catch (error) {
    if (
      error instanceof OperationConflictError ||
      error instanceof OperationValidationError
    ) {
      errorMessage = error.message;
    } else {
      console.error("Waitlist withdrawal failed", error);
      errorMessage = "Could not withdraw from the waitlist. Try again.";
    }
  }
  const href = registrationPageHref(tournamentSlug);
  if (errorMessage) {
    redirect(`${href}?withdrawError=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`${href}?withdrawn=1`);
}

export function ApplicantWaitlistEntries({
  rows,
  withdrawAction,
}: {
  rows: ApplicantWaitlistRow[];
  withdrawAction: string | ((teamId: string) => Promise<void>);
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-4 space-y-2" aria-labelledby="your-waitlist-heading">
      <div>
        <h2 id="your-waitlist-heading" className="text-sm font-semibold">
          Your teams on the waitlist
        </h2>
        <p className="text-xs text-muted-foreground">
          Waitlisted teams do not pay unless the organizer promotes them.
        </p>
      </div>
      {rows.map((row) => (
        <div key={row.teamId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/80 p-3">
          <div>
            <p className="text-sm font-medium">{row.teamName}</p>
            <p className="text-xs text-muted-foreground">
              {row.university} · Queue position {row.queueRank}
            </p>
          </div>
          <form action={typeof withdrawAction === "string" ? withdrawAction : withdrawAction.bind(null, row.teamId)}>
            <button type="submit" className="text-sm font-medium text-destructive underline-offset-4 hover:underline">
              Withdraw from waitlist
            </button>
          </form>
        </div>
      ))}
    </section>
  );
}

function RegistrationFeedback({
  withdrawn,
  withdrawError,
}: {
  withdrawn?: string;
  withdrawError?: string;
}) {
  return (
    <>
      {withdrawn === "1" ? (
        <p className="mb-4 rounded-md border border-border/80 bg-muted/20 p-3 text-sm">
          Your team was withdrawn from the waitlist.
        </p>
      ) : null}
      {withdrawError ? (
        <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {withdrawError}
        </p>
      ) : null}
    </>
  );
}

function PaymentInstructions({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <div className="mb-4 rounded-md border border-border/80 bg-muted/20 p-3">
      <p className="text-sm font-medium">Entry fee</p>
      <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-muted-foreground">
        {value}
      </pre>
      <p className="mt-2 text-xs text-muted-foreground">
        After registering, mark payment as sent on the tournament Payment tab.
      </p>
    </div>
  );
}

function RegistrationHeader({
  tournament,
  availability,
  isHost,
  genderLabel,
  hostSchool,
}: {
  tournament: RegistrationTournamentSummary;
  availability: Availability;
  isHost: boolean;
  genderLabel: string;
  hostSchool: { id: string; name: string } | null;
}) {
  const hostPrefix = hostSchool ? ` Starts with ${hostSchool.name}.` : "";
  return (
    <CardHeader>
      <CardTitle>{isHost ? "Add teams to" : "Register for"} {tournament.name}</CardTitle>
      <TeamAttributesBadges gender={tournament.gender} region={tournament.region} className="mt-2" />
      <div className="mt-3"><PublicRegistrationAvailability availability={availability} /></div>
      <p className="mt-2 text-sm text-muted-foreground">
        {isHost
          ? `Choose a school, then select ${genderLabel} teams to add.${hostPrefix} Pool and group placement can be set later, and host-added teams are confirmed automatically.`
          : `Select one or more ${genderLabel} teams to register for this event.`}
      </p>
    </CardHeader>
  );
}

interface RegistrationOpenViewProps {
  tournament: RegistrationTournamentSummary;
  availability: Availability;
  applicantRows: ApplicantWaitlistRow[];
  teams: RegistrationTeam[];
  schools: RegistrationSchool[];
  hostSchool: { id: string; name: string } | null;
  isHost: boolean;
  genderLabel: string;
  showForm: boolean;
  emptyMessage: string;
  paymentInstructions: string | null;
  feedback: { withdrawn?: string; withdrawError?: string };
}

function RegistrationBody(props: RegistrationOpenViewProps) {
  const tournament = props.tournament;
  return (
    <CardContent className="overflow-visible">
      <RegistrationFeedback {...props.feedback} />
      <ApplicantWaitlistEntries
        rows={props.applicantRows}
        withdrawAction={submitApplicantWaitlistWithdrawal.bind(null, tournament.id, tournament.slug)}
      />
      {!props.isHost ? <PaymentInstructions value={props.paymentInstructions} /> : null}
      {props.showForm ? (
        <RegisterForm
          tournamentId={tournament.id}
          tournamentSlug={tournament.slug}
          teams={props.teams}
          asHost={props.isHost}
          hostSchool={props.hostSchool}
          schools={props.isHost ? props.schools : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{props.emptyMessage}</p>
      )}
    </CardContent>
  );
}

export function RegistrationOpenView(props: RegistrationOpenViewProps) {
  return (
    <div className="space-y-3">
      <BackLink href={`/tournaments/${props.tournament.slug}`}>Back to tournament</BackLink>
      <div className="mx-auto max-w-lg">
        <Card className="overflow-visible">
          <RegistrationHeader
            tournament={props.tournament}
            availability={props.availability}
            isHost={props.isHost}
            genderLabel={props.genderLabel}
            hostSchool={props.hostSchool}
          />
          <RegistrationBody {...props} />
        </Card>
      </div>
    </div>
  );
}

interface RegistrationClosedViewProps {
  tournamentSlug: string;
  availability: Availability;
  applicantRows?: ApplicantWaitlistRow[];
  withdrawAction?: string | ((teamId: string) => Promise<void>);
  tournamentId?: string;
}

export function RegistrationClosedView({
  tournamentSlug,
  availability,
  applicantRows = [],
  withdrawAction,
  tournamentId,
}: RegistrationClosedViewProps) {
  const resolvedWithdrawAction =
    withdrawAction ??
    (tournamentId
      ? submitApplicantWaitlistWithdrawal.bind(
          null,
          tournamentId,
          tournamentSlug
        )
      : undefined);
  return (
    <div className="space-y-3">
      <BackLink href={`/tournaments/${tournamentSlug}`}>Back to tournament</BackLink>
      <div className="mx-auto max-w-lg">
        <Card className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 text-foreground/[0.05] bg-court-lines [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
          />
          <CardContent className="relative py-12 text-center">
            <p className="font-heading text-base font-semibold tracking-tight">Registration closed</p>
            <p className="mt-1.5 text-pretty text-sm text-muted-foreground">
              Registration is not currently open for this tournament.
            </p>
            <div className="mt-5 text-left"><PublicRegistrationAvailability availability={availability} /></div>
            {resolvedWithdrawAction ? (
              <div className="mt-5 text-left">
                <ApplicantWaitlistEntries
                  rows={applicantRows}
                  withdrawAction={resolvedWithdrawAction}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
