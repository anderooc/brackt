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
  RegistrationStatus,
  TeamGender,
  TeamMemberRole,
  TeamRegion,
  TournamentStatus,
} from "@/types";

/** How the viewer relates to a tournament on the dashboard. */
export type DashboardTournamentRelation =
  | "pending"
  | "signed_up"
  | "past"
  | "hosting";

export interface DashboardTeamContract {
  slug: string;
  name: string;
  university: string;
  gender: TeamGender;
  region: TeamRegion;
  role: TeamMemberRole;
  jerseyNumber: number | null;
}

export interface DashboardTournamentContract {
  slug: string;
  name: string;
  date: string;
  location: string;
  status: TournamentStatus;
  relation: DashboardTournamentRelation;
  teamName: string | null;
  divisionName: string | null;
  registrationStatus: RegistrationStatus | null;
  /** Organizer or staff; these appear under Hosting rather than Upcoming. */
  isOrganizer: boolean;
}

/** Something the viewer can act on now, soonest event first. */
export interface DashboardAttentionContract {
  key: string;
  kind:
    | "approve_teams"
    | "review_payments"
    | "pay_fee"
    | "sign_waiver"
    | "collect_waivers";
  /** Which screen resolves it: the host's pending list, payments, or waivers. */
  target: "pending" | "payment" | "waiver";
  title: string;
  /** Team the item is about, when it isn't obvious from the tournament. */
  detail: string | null;
  cta: string;
  tournament: { slug: string; name: string; date: string };
}

/** An upcoming tournament the viewer runs, with registration at a glance. */
export interface DashboardHostingContract {
  slug: string;
  name: string;
  date: string;
  status: TournamentStatus;
  /** Confirmed + checked-in teams. */
  teamCount: number;
  pendingCount: number;
  capacity: number | null;
  /** ISO timestamp. */
  deadline: string | null;
  deadlinePassed: boolean;
}

export interface DashboardContract {
  firstName: string;
  school: { slug: string; name: string } | null;
  /** Kept for app builds that still show the count strip. */
  stats: {
    teamCount: number;
    upcomingCount: number;
    pendingCount: number;
    pastCount: number;
  };
  teams: DashboardTeamContract[];
  /** Every upcoming tournament, then the most recent past ones. */
  tournaments: DashboardTournamentContract[];
  attention: DashboardAttentionContract[];
  hosting: DashboardHostingContract[];
}
