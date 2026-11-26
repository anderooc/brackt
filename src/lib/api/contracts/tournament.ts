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
  SchoolVerificationStatus,
  TeamGender,
  TeamRegion,
} from "@/types";

/** Excludes `draft`, which never leaves the public loader. */
export type PublicTournamentStatus =
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed";

export interface TournamentHostSchoolContract {
  name: string;
  slug: string;
  verificationStatus: SchoolVerificationStatus;
}

export interface TournamentAvailabilityContract {
  capacity: number | null;
  deadline: string | null;
  registeredCount: number;
  waitlistCount: number;
}

/**
 * Declared independently of the loader's internal projection type. The two are
 * structurally identical today, but keeping them separate means a change to an
 * internal query cannot silently alter the wire format that shipped clients
 * depend on — the mapping in `projections/tournament.ts` fails to compile
 * instead.
 */
export interface TournamentListItemContract {
  slug: string;
  name: string;
  description: string | null;
  location: string;
  /** Calendar date, `YYYY-MM-DD`, with no timezone. */
  date: string;
  status: string;
  gender: TeamGender;
  region: TeamRegion;
  registrationAvailability: TournamentAvailabilityContract;
  hostSchool: TournamentHostSchoolContract | null;
}

export interface TournamentListContract {
  tournaments: TournamentListItemContract[];
  /** Total matching the filters, ignoring pagination. */
  total: number;
}

export type TournamentDivisionFormatContract =
  | "pool_to_bracket"
  | "single_elimination"
  | "double_elimination";

export interface TournamentDivisionContract {
  name: string;
  format: TournamentDivisionFormatContract;
  /** True once the host has released pool play / brackets to the public. */
  poolsReleased: boolean;
}

export interface TournamentDetailContract extends TournamentListItemContract {
  address: string | null;
  organizerName: string;
  /** True when a captain can still start a registration on the web. */
  registrationOpen: boolean;
  divisions: TournamentDivisionContract[];
}

export interface TournamentTeamContract {
  slug: string;
  name: string;
  university: string;
  schoolName: string | null;
  divisionName: string | null;
}

export interface TournamentTeamListContract {
  teams: TournamentTeamContract[];
}

export type PublicMatchStatus = "upcoming" | "in_progress" | "completed";

export type PublicMatchPhase = "pool" | "bracket";

export interface TournamentMatchTeamContract {
  slug: string;
  name: string;
}

export interface TournamentMatchSetContract {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
}

export interface TournamentMatchContract {
  slug: string;
  status: PublicMatchStatus;
  phase: PublicMatchPhase;
  scheduledTime: string | null;
  /** IANA zone of the event, for rendering `scheduledTime`. */
  timeZone: string;
  courtName: string | null;
  divisionName: string | null;
  teamA: TournamentMatchTeamContract | null;
  teamB: TournamentMatchTeamContract | null;
  winnerSlug: string | null;
  sets: TournamentMatchSetContract[];
}

export interface TournamentMatchListContract {
  matches: TournamentMatchContract[];
}

export interface TournamentMatchDetailContract extends TournamentMatchContract {
  tournamentName: string;
  refTeamName: string | null;
}

export interface PoolStandingContract {
  teamSlug: string;
  teamName: string;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  pointDiff: number;
}

export interface PlayPoolContract {
  name: string;
  standings: PoolStandingContract[];
  matches: TournamentMatchContract[];
}

export interface BracketMatchContract {
  slug: string;
  round: number;
  position: number;
  status: PublicMatchStatus;
  teamA: TournamentMatchTeamContract | null;
  teamB: TournamentMatchTeamContract | null;
  winnerSlug: string | null;
  sets: TournamentMatchSetContract[];
}

export interface PlayBracketContract {
  name: string;
  type: string;
  tier: number;
  matches: BracketMatchContract[];
}

export interface PlayDivisionContract {
  name: string;
  format: TournamentDivisionFormatContract;
  released: boolean;
  pools: PlayPoolContract[];
  brackets: PlayBracketContract[];
}

export interface TournamentPlayContract {
  divisions: PlayDivisionContract[];
}
