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

import type {
  TournamentHostChecklistStepContract,
  TournamentHostOverviewContract,
} from "@/lib/api/contracts/tournament-host";

export type StepAction =
  | { kind: "route"; path: string; label: string }
  | { kind: "status"; status: string; label: string }
  | null;

function plural(count: number, word: string) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

/** Where a checklist step is done in the app, or the status it flips. */
export function stepAction(
  step: TournamentHostChecklistStepContract,
  overview: TournamentHostOverviewContract
): StepAction {
  const base = `/tournament/${overview.slug}`;
  switch (step.id) {
    case "listing":
      return overview.isArchived
        ? null
        : { kind: "route", path: `${base}/host/details`, label: "Edit listing" };
    case "setup":
      return { kind: "route", path: `${base}/host/setup`, label: "Add pools and courts" };
    case "open":
      return step.done || overview.isArchived
        ? null
        : { kind: "status", status: "registration_open", label: "Open registration" };
    case "confirm":
      return {
        kind: "route",
        path: `${base}/host/registrations?tab=pending`,
        label: "Review teams",
      };
    case "pool-settings":
      return { kind: "route", path: `${base}/settings/pool`, label: "Pool settings" };
    case "bracket-settings":
      return { kind: "route", path: `${base}/settings/bracket`, label: "Bracket settings" };
    case "pools":
    case "release":
      return { kind: "route", path: `${base}/host/pools`, label: "Open pools" };
    case "bracket":
      return {
        kind: "route",
        path: overview.sections.bracket ? `${base}/host/bracket` : `${base}/bracket`,
        label: "Open bracket",
      };
    case "schedule":
      return overview.sections.schedule
        ? { kind: "route", path: `${base}/host/schedule`, label: "Open schedule" }
        : null;
    case "run":
      return step.done || overview.isArchived
        ? null
        : { kind: "status", status: "in_progress", label: "Start the event" };
    default:
      return null;
  }
}

/** App wording for a step's hint (the server's hints name web tabs). */
export function stepHint(
  step: TournamentHostChecklistStepContract,
  overview: TournamentHostOverviewContract
): string | undefined {
  if (step.done) return undefined;
  switch (step.id) {
    case "listing":
      return step.hint;
    case "setup":
      return "Add pools and courts in Setup.";
    case "open":
      return "Set status to Registration open when teams can sign up.";
    case "confirm":
      return overview.counts.pendingCount > 0
        ? `${plural(overview.counts.pendingCount, "team")} waiting for approval.`
        : "Approve pending teams, then close registration.";
    case "pools":
      return overview.playFormat === "pool_to_bracket"
        ? "Assign teams to pools in Registrations, then save seeding in Pools to create matches."
        : "Assign teams in Registrations, then save seeding to build the bracket.";
    case "release":
      return "Release pools when schedules are ready for teams and fans.";
    case "bracket":
      return overview.playFormat === "pool_to_bracket"
        ? "Brackets seed automatically when every pool finishes."
        : "Teams appear once seeding is saved.";
    case "schedule":
      return "Set start times and courts in Schedule.";
    case "run":
      return "Set status to In progress on event day.";
    default:
      return step.hint;
  }
}

export function statusConfirmMessage(status: string): string {
  switch (status) {
    case "draft":
      return "Teams won't be able to register while the tournament is a draft.";
    case "registration_open":
      return "Teams will be able to find and register for this tournament.";
    case "registration_closed":
      return "New teams will no longer be able to register.";
    case "in_progress":
      return "Teams and fans will see the event as live.";
    case "completed":
      return "The event will be marked as finished.";
    default:
      return "This changes what teams and fans see.";
  }
}
