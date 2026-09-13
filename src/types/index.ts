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

export type UserRole = "player" | "captain" | "organizer" | "admin";

export type TournamentStatus =
  | "draft"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed";

export type RegistrationStatus = "pending" | "confirmed" | "checked_in";

export type TournamentChatChannelKind =
  | "announcements"
  | "questions"
  | "general";

export type UserNotificationKind =
  | "tournament_posted"
  | "tournament_message"
  | "chat_announcement"
  | "registration_update"
  | "school_join_request"
  | "school_join_update";

export type SchoolJoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export type RegistrationPaymentStatus =
  | "unpaid"
  | "submitted"
  | "confirmed"
  | "waived";

export type RegistrationPaymentMethod =
  | "venmo"
  | "zelle"
  | "cashapp"
  | "check"
  | "cash"
  | "other";

export type DivisionFormat =
  | "pool_to_bracket"
  | "single_elimination"
  | "double_elimination";

export type BracketType = "single_elimination" | "double_elimination";

export type MatchStatus = "upcoming" | "in_progress" | "completed";

export type TeamMemberRole = "captain" | "player";

export type SchoolMemberRole = "president" | "officer" | "member";

/** Tournament co-host / staff roles (resource-scoped host helpers). */
export type TournamentStaffRole = "co_host" | "staff";

export type SchoolVerificationStatus = "pending" | "verified" | "rejected";

/** Standalone teams (no parent school) use the same review states as schools. */
export type TeamVerificationStatus = SchoolVerificationStatus;

export type TeamGender = "mens" | "womens";

export type TeamRegion =
  | "north"
  | "northeast"
  | "east"
  | "east_central"
  | "central"
  | "south"
  | "southeast"
  | "west"
  | "northwest";

export type UserPlayerGender = "male" | "female";

export type VolleyballPosition =
  | "outside_hitter"
  | "middle_blocker"
  | "opposite_hitter"
  | "setter"
  | "libero_ds";
