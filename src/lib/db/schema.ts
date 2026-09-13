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
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  bigserial,
  pgEnum,
  date,
  primaryKey,
  boolean,
  uniqueIndex,
  index,
  check,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "player",
  "captain",
  "organizer",
  "admin",
]);

export const tournamentStatusEnum = pgEnum("tournament_status", [
  "draft",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
]);

export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "confirmed",
  "checked_in",
]);

export const waitlistEntryStatusEnum = pgEnum("waitlist_entry_status", [
  "waiting",
  "promoted",
  "withdrawn",
  "removed",
]);

export const waiverCompletionMethodEnum = pgEnum("waiver_completion_method", [
  "digital",
  "captain_attested",
  "host_override",
]);

export const tournamentEmailAudienceEnum = pgEnum("tournament_email_audience", [
  "captains_confirmed",
  "captains_all",
  "captains_pending",
  "captains_waiver_incomplete",
]);

export const tournamentEmailKindEnum = pgEnum("tournament_email_kind", [
  "custom",
  "waiver_reminder",
]);

export const userNotificationKindEnum = pgEnum("user_notification_kind", [
  "tournament_posted",
  "tournament_message",
  "chat_announcement",
  "registration_update",
  "school_join_request",
  "school_join_update",
]);

export const memberInviteStatusEnum = pgEnum("member_invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const tournamentChatChannelKindEnum = pgEnum(
  "tournament_chat_channel_kind",
  ["announcements", "questions", "general"]
);

export const registrationPaymentStatusEnum = pgEnum(
  "registration_payment_status",
  ["unpaid", "submitted", "confirmed", "waived"]
);

export const registrationPaymentMethodEnum = pgEnum(
  "registration_payment_method",
  ["venmo", "zelle", "cashapp", "check", "cash", "other"]
);

export const divisionFormatEnum = pgEnum("division_format", [
  "pool_to_bracket",
  "single_elimination",
  "double_elimination",
]);

export const bracketTypeEnum = pgEnum("bracket_type", [
  "single_elimination",
  "double_elimination",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "upcoming",
  "in_progress",
  "completed",
]);

export const matchRefCrewRoleEnum = pgEnum("match_ref_crew_role", [
  "up_ref",
  "down_ref",
  "line_ref_1",
  "line_ref_2",
  "scorekeeper_1",
  "scorekeeper_2",
  "scorekeeper_3",
]);

export const matchFormatEnum = pgEnum("match_format", [
  "play_all_3",
  "best_of_2",
  "two_with_tiebreak",
]);

export const warmupFormatEnum = pgEnum("warmup_format", [
  "none",
  "three_three_one",
]);

export const teamMemberRoleEnum = pgEnum("team_member_role", [
  "captain",
  "player",
]);

export const schoolMemberRoleEnum = pgEnum("school_member_role", [
  "president",
  "officer",
  "member",
]);

export const schoolVerificationStatusEnum = pgEnum(
  "school_verification_status",
  ["pending", "verified", "rejected"]
);

export const schoolJoinRequestStatusEnum = pgEnum(
  "school_join_request_status",
  ["pending", "approved", "rejected", "cancelled"]
);

export const teamVerificationStatusEnum = pgEnum("team_verification_status", [
  "pending",
  "verified",
  "rejected",
]);

export const teamGenderEnum = pgEnum("team_gender", ["mens", "womens"]);

export const userPlayerGenderEnum = pgEnum("user_player_gender", [
  "male",
  "female",
]);

export const volleyballPositionEnum = pgEnum("volleyball_position", [
  "outside_hitter",
  "middle_blocker",
  "opposite_hitter",
  "setter",
  "libero_ds",
]);

export const teamRegionEnum = pgEnum("team_region", [
  "north",
  "northeast",
  "east",
  "east_central",
  "central",
  "south",
  "southeast",
  "west",
  "northwest",
]);

// ── Tables ──────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authId: text("auth_id").unique().notNull(),
    email: text("email").unique().notNull(),
    fullName: text("full_name").notNull(),
    university: text("university"),
    avatarStoragePath: text("avatar_storage_path"),
    /** Player's own gender for profile display; unrelated to team/school gender. */
    playerGender: userPlayerGenderEnum("player_gender"),
    volleyballPosition: volleyballPositionEnum("volleyball_position"),
    /** Preferred jersey 0–99. Copied onto every team roster row for this user. */
    jerseyNumber: integer("jersey_number"),
    displayEmail: text("display_email"),
    displaySchool: text("display_school"),
    role: userRoleEnum("role").default("player").notNull(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    check(
      "users_jersey_number_range",
      sql`${t.jerseyNumber} IS NULL OR (${t.jerseyNumber} >= 0 AND ${t.jerseyNumber} <= 99)`
    ),
  ]
);

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    keyHash: text("key_hash").notNull(),
    scope: text("scope").notNull(),
    attempts: integer("attempts").default(1).notNull(),
    windowExpiresAt: timestamp("window_expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
      mode: "date",
    })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.keyHash, t.scope] })]
);

export const accountDeletionRequests = pgTable("account_deletion_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  authId: text("auth_id").notNull(),
  requestedAt: timestamp("requested_at", {
    withTimezone: true,
    mode: "date",
  })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", {
    withTimezone: true,
    mode: "date",
  }),
  lastError: text("last_error"),
});

export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** URL-friendly unique identifier derived from name */
  slug: text("slug").notNull().unique(),
  university: text("university").notNull(),
  /** A school represents one club program for one gender. Teams under it
   * inherit the gender (and region) at creation time. */
  gender: teamGenderEnum("gender").notNull(),
  region: teamRegionEnum("region").notNull(),
  description: text("description"),
  websiteUrl: text("website_url"),
  /** Expected institutional email domain, e.g. "ucla.edu". Used to auto-flag
   * verification submissions where president/officers' emails match. */
  domainHint: text("domain_hint"),
  verificationStatus: schoolVerificationStatusEnum("verification_status")
    .default("pending")
    .notNull(),
  /** True when at least one president/officer email matches domainHint at submit. */
  domainMatched: boolean("domain_matched").default(false).notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const schoolMembers = pgTable(
  "school_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .references(() => schools.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: schoolMemberRoleEnum("role").default("member").notNull(),
    /** Optional display title (e.g. "VP", "Treasurer"). */
    title: text("title"),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("school_members_school_user_unique").on(t.schoolId, t.userId),
  ]
);

export const schoolJoinRequests = pgTable(
  "school_join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schoolId: uuid("school_id")
      .references(() => schools.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    status: schoolJoinRequestStatusEnum("status").default("pending").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("school_join_requests_pending_school_user_unique")
      .on(t.schoolId, t.userId)
      .where(sql`${t.status} = 'pending'`),
    uniqueIndex("school_join_requests_pending_user_unique")
      .on(t.userId)
      .where(sql`${t.status} = 'pending'`),
    index("school_join_requests_school_pending_idx")
      .on(t.schoolId, t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ]
);

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** URL-friendly unique identifier derived from name */
  slug: text("slug").notNull().unique(),
  university: text("university").notNull(),
  /** Optional parent school. Standalone teams stay null. */
  schoolId: uuid("school_id").references(() => schools.id, {
    onDelete: "set null",
  }),
  gender: teamGenderEnum("gender").notNull(),
  region: teamRegionEnum("region").notNull(),
  season: text("season"),
  /** Standalone teams require admin approval; school-linked teams use verified. */
  verificationStatus: teamVerificationStatusEnum("verification_status")
    .default("pending")
    .notNull(),
  verifiedAt: timestamp("verified_at"),
  verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: teamMemberRoleEnum("role").default("player").notNull(),
    jerseyNumber: integer("jersey_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("team_members_team_user_unique").on(t.teamId, t.userId),
    uniqueIndex("team_members_team_jersey_unique")
      .on(t.teamId, t.jerseyNumber)
      .where(sql`${t.jerseyNumber} IS NOT NULL`),
    check(
      "team_members_jersey_number_range",
      sql`${t.jerseyNumber} IS NULL OR (${t.jerseyNumber} >= 0 AND ${t.jerseyNumber} <= 99)`
    ),
  ]
);

export const tournaments = pgTable("tournaments", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizerId: uuid("organizer_id")
    .references(() => users.id)
    .notNull(),
  /** School hosting the event; gender/region are copied from this school at creation. */
  hostSchoolId: uuid("host_school_id").references(() => schools.id, {
    onDelete: "set null",
  }),
  gender: teamGenderEnum("gender").notNull(),
  region: teamRegionEnum("region").notNull(),
  name: text("name").notNull(),
  /** URL-friendly unique identifier derived from name */
  slug: text("slug").notNull().unique(),
  description: text("description"),
  date: date("date").notNull(),
  location: text("location").notNull(),
  address: text("address"),
  status: tournamentStatusEnum("status").default("draft").notNull(),
  registrationCapacity: integer("registration_capacity"),
  registrationDeadline: timestamp("registration_deadline", {
    withTimezone: true,
  }),
  /** Set / scoring rules used for every match in this tournament. */
  matchFormat: matchFormatEnum("match_format")
    .default("two_with_tiebreak")
    .notNull(),
  /** Starting score per set for pool play (e.g. 4 for shorter pools that begin at 4-4). */
  setStartingScore: integer("set_starting_score").default(0).notNull(),
  /** Target score for a regular set (commonly 21 or 25). */
  setTargetScore: integer("set_target_score").default(25).notNull(),
  /** Target score for the tiebreak third set (commonly 15). */
  tiebreakTargetScore: integer("tiebreak_target_score").default(15).notNull(),
  /** Starting score per set for bracket matches (always 0–0 by default). */
  bracketSetStartingScore: integer("bracket_set_starting_score")
    .default(0)
    .notNull(),
  /**
   * Tournament-wide play structure. Every pool uses this format
   * (pool → bracket, single elim, double elim).
   */
  playFormat: divisionFormatEnum("play_format")
    .default("pool_to_bracket")
    .notNull(),
  /** Warmup convention used between matches. three_three_one = 3-3-1-1 (8 min). */
  warmupFormat: warmupFormatEnum("warmup_format")
    .default("three_three_one")
    .notNull(),
  /**
   * Ordered criteria for pool standings/seeding tiebreaks.
   * Default: match record → set record → point diff → head-to-head.
   */
  poolTiebreakCriteria: jsonb("pool_tiebreak_criteria")
    .$type<
      Array<"match_record" | "set_record" | "point_diff" | "head_to_head">
    >()
    .default(["match_record", "set_record", "point_diff", "head_to_head"])
    .notNull(),
  /**
   * Elimination brackets after pool play (all pools combine):
   * 1 = gold only, 2 = gold + silver, 3 = gold + silver + bronze.
   */
  bracketCount: integer("bracket_count").default(1).notNull(),
  /** Teams that advance into the gold bracket from combined pool standings. */
  goldTeamCount: integer("gold_team_count"),
  /** Teams that advance into silver when bracketCount is 3; remainder to bronze. */
  silverTeamCount: integer("silver_team_count"),
  /** Set when the organizer saves Pool settings on the Pools tab. */
  poolSettingsSavedAt: timestamp("pool_settings_saved_at"),
  /** Set when the organizer saves Bracket settings on the Bracket tab. */
  bracketSettingsSavedAt: timestamp("bracket_settings_saved_at"),
  /**
   * Logistics for the downloadable tournament packet (parking, check-in, agenda,
   * payment, contact). Competition rules are auto-filled from settings.
   */
  packetNotes: text("packet_notes"),
  /** Hex color (e.g. "#1A3F7D") used as the header accent in the PDF packet. */
  packetAccentColor: text("packet_accent_color"),
  /** When true, registered teams must complete the uploaded waiver before check-in. */
  waiverEnabled: boolean("waiver_enabled").default(false).notNull(),
  waiverAllowDownloadPrint: boolean("waiver_allow_download_print")
    .default(true)
    .notNull(),
  waiverAllowThirdParty: boolean("waiver_allow_third_party")
    .default(false)
    .notNull(),
  waiverAllowDigitalAck: boolean("waiver_allow_digital_ack")
    .default(false)
    .notNull(),
  waiverThirdPartyUrl: text("waiver_third_party_url"),
  waiverRequiredBeforeCheckIn: boolean("waiver_required_before_check_in")
    .default(true)
    .notNull(),
  paymentEnabled: boolean("payment_enabled").default(false).notNull(),
  paymentRequiredBeforeConfirm: boolean("payment_required_before_confirm")
    .default(true)
    .notNull(),
  paymentFirstTeamFeeCents: integer("payment_first_team_fee_cents"),
  paymentAdditionalTeamFeeCents: integer("payment_additional_team_fee_cents"),
  paymentVenmoHandle: text("payment_venmo_handle"),
  paymentZelleHandle: text("payment_zelle_handle"),
  paymentCashappHandle: text("payment_cashapp_handle"),
  paymentOtherInstructions: text("payment_other_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  check(
    "tournaments_registration_capacity_positive",
    sql`${t.registrationCapacity} IS NULL OR ${t.registrationCapacity} > 0`
  ),
]);

export const divisions = pgTable("divisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  format: divisionFormatEnum("format").default("pool_to_bracket").notNull(),
  /**
   * Elimination brackets after pool play: 1 = gold only, 2 = gold + silver,
   * 3 = gold + silver + bronze.
   */
  bracketCount: integer("bracket_count").default(1).notNull(),
  /** Teams that advance into the gold bracket (pool_to_bracket). */
  goldTeamCount: integer("gold_team_count"),
  /** Teams that advance into silver when bracketCount is 3; remainder to bronze. */
  silverTeamCount: integer("silver_team_count"),
  /** When set, non-host users can view pool play and brackets for this pool. */
  poolsReleasedAt: timestamp("pools_released_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    /** Set by tournament organizer when placing teams into divisions / pools */
    divisionId: uuid("division_id").references(() => divisions.id, {
      onDelete: "cascade",
    }),
    status: registrationStatusEnum("status").default("pending").notNull(),
    registeredAt: timestamp("registered_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("registrations_team_tournament_unique").on(
      t.teamId,
      t.tournamentId
    ),
  ]
);

export const tournamentWaitlistEntries = pgTable(
  "tournament_waitlist_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    queuePosition: bigserial("queue_position", { mode: "number" }).notNull(),
    requestedByUserId: uuid("requested_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    requestOperationId: uuid("request_operation_id").notNull(),
    status: waitlistEntryStatusEnum("status").default("waiting").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByUserId: uuid("resolved_by_user_id").references(
      () => users.id,
      { onDelete: "set null" }
    ),
    resolutionOperationId: uuid("resolution_operation_id"),
    registrationId: uuid("registration_id").references(() => registrations.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("tournament_waitlist_entries_waiting_team_unique")
      .on(t.tournamentId, t.teamId)
      .where(sql`${t.status} = 'waiting'`),
    index("tournament_waitlist_entries_fifo_idx")
      .on(t.tournamentId, t.queuePosition)
      .where(sql`${t.status} = 'waiting'`),
    index("tournament_waitlist_entries_team_id_idx").on(t.teamId),
    index("tournament_waitlist_entries_requested_by_user_id_idx").on(
      t.requestedByUserId
    ),
    index("tournament_waitlist_entries_resolved_by_user_id_idx").on(
      t.resolvedByUserId
    ),
    uniqueIndex("tournament_waitlist_entries_request_operation_unique").on(
      t.tournamentId,
      t.teamId,
      t.requestOperationId
    ),
    uniqueIndex("tournament_waitlist_entries_resolution_operation_unique")
      .on(t.tournamentId, t.resolutionOperationId)
      .where(sql`${t.resolutionOperationId} IS NOT NULL`),
    uniqueIndex("tournament_waitlist_entries_registration_unique")
      .on(t.registrationId)
      .where(sql`${t.registrationId} IS NOT NULL`),
    check(
      "tournament_waitlist_entries_resolution_consistent",
      sql`
        (
          ${t.status} = 'waiting'
          AND ${t.resolvedAt} IS NULL
          AND ${t.resolvedByUserId} IS NULL
          AND ${t.resolutionOperationId} IS NULL
          AND ${t.registrationId} IS NULL
        )
        OR (
          ${t.status} = 'promoted'
          AND ${t.resolvedAt} IS NOT NULL
          AND ${t.resolutionOperationId} IS NOT NULL
        )
        OR (
          ${t.status} IN ('withdrawn', 'removed')
          AND ${t.resolvedAt} IS NOT NULL
          AND ${t.resolutionOperationId} IS NOT NULL
          AND ${t.registrationId} IS NULL
        )
      `
    ),
  ]
);

export const registrationStatusEvents = pgTable(
  "registration_status_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id").references(
      () => registrations.id,
      { onDelete: "set null" }
    ),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    fromStatus: registrationStatusEnum("from_status"),
    toStatus: registrationStatusEnum("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    operationId: uuid("operation_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("registration_status_events_team_operation_unique").on(
      t.tournamentId,
      t.teamId,
      t.operationId
    ),
    index("registration_status_events_tournament_id_idx").on(t.tournamentId),
    index("registration_status_events_registration_id_idx").on(
      t.registrationId
    ),
    index("registration_status_events_team_id_idx").on(t.teamId),
    index("registration_status_events_actor_user_id_idx").on(t.actorUserId),
    index("registration_status_events_operation_id_idx").on(t.operationId),
  ]
);

export const registrationPayments = pgTable("registration_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  registrationId: uuid("registration_id")
    .references(() => registrations.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  tournamentId: uuid("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: registrationPaymentStatusEnum("status").default("unpaid").notNull(),
  submittedMethod: registrationPaymentMethodEnum("submitted_method"),
  submittedNote: text("submitted_note"),
  submittedByUserId: uuid("submitted_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  submittedAt: timestamp("submitted_at"),
  confirmedByUserId: uuid("confirmed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  confirmedAt: timestamp("confirmed_at"),
  waivedByUserId: uuid("waived_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  waivedAt: timestamp("waived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tournamentWaivers = pgTable(
  "tournament_waivers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    storagePath: text("storage_path").notNull(),
    fileName: text("file_name").notNull(),
    version: integer("version").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tournament_waivers_tournament_version_unique").on(
      t.tournamentId,
      t.version
    ),
  ]
);

/** Co-hosts and staff who share host ops with the tournament organizer. */
export const tournamentStaff = pgTable(
  "tournament_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").$type<"co_host" | "staff">().default("co_host").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("tournament_staff_tournament_user_unique").on(
      t.tournamentId,
      t.userId
    ),
    index("tournament_staff_tournament_id_idx").on(t.tournamentId),
    index("tournament_staff_user_id_idx").on(t.userId),
    index("tournament_staff_created_by_user_id_idx").on(t.createdByUserId),
    check(
      "tournament_staff_role_check",
      sql`${t.role} IN ('co_host', 'staff')`
    ),
  ]
);

export const waiverCompletions = pgTable(
  "waiver_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    waiverId: uuid("waiver_id")
      .references(() => tournamentWaivers.id, { onDelete: "cascade" })
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id")
      .references(() => teams.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    method: waiverCompletionMethodEnum("method").notNull(),
    signedName: text("signed_name"),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
    attestedByUserId: uuid("attested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    waivedByUserId: uuid("waived_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (t) => [
    uniqueIndex("waiver_completions_waiver_user_unique").on(
      t.waiverId,
      t.userId
    ),
  ]
);

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: userNotificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    tournamentId: uuid("tournament_id").references(() => tournaments.id, {
      onDelete: "cascade",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("user_notifications_user_created_idx").on(t.userId, t.createdAt),
  ]
);

export const userPushTokens = pgTable(
  "user_push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    deviceName: text("device_name"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_push_tokens_token_uidx").on(t.token),
    index("user_push_tokens_user_id_idx").on(t.userId),
  ]
);

export const userWebPushSubscriptions = pgTable(
  "user_web_push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_web_push_subscriptions_endpoint_uidx").on(t.endpoint),
    index("user_web_push_subscriptions_user_id_idx").on(t.userId),
  ]
);

export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    kind: userNotificationKindEnum("kind").notNull(),
    pushEnabled: boolean("push_enabled").default(true).notNull(),
    emailEnabled: boolean("email_enabled").default(false).notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.kind] })]
);

export const memberInvites = pgTable(
  "member_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    schoolId: uuid("school_id").references(() => schools.id, {
      onDelete: "cascade",
    }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    title: text("title"),
    invitedByUserId: uuid("invited_by_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    token: text("token").notNull(),
    status: memberInviteStatusEnum("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("member_invites_token_uidx").on(t.token),
    index("member_invites_email_pending_idx").on(t.email, t.status),
  ]
);

export const tournamentPostingAnnouncements = pgTable(
  "tournament_posting_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    gender: teamGenderEnum("gender").notNull(),
    regions: teamRegionEnum("regions").array().notNull(),
    sendEmail: boolean("send_email").default(true).notNull(),
    recipientCount: integer("recipient_count").notNull(),
    skippedNoCaptainCount: integer("skipped_no_captain_count")
      .default(0)
      .notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tournament_posting_announcements_tournament_idx").on(
      t.tournamentId,
      t.sentAt
    ),
  ]
);

export const tournamentEmailSends = pgTable("tournament_email_sends", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  sentByUserId: uuid("sent_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  kind: tournamentEmailKindEnum("kind").notNull(),
  audience: tournamentEmailAudienceEnum("audience").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientCount: integer("recipient_count").notNull(),
  skippedNoCaptainCount: integer("skipped_no_captain_count")
    .default(0)
    .notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const tournamentChatChannels = pgTable(
  "tournament_chat_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    kind: tournamentChatChannelKindEnum("kind").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("tournament_chat_channels_tournament_kind_unique").on(
      t.tournamentId,
      t.kind
    ),
  ]
);

export const tournamentChatMessages = pgTable(
  "tournament_chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id")
      .references(() => tournamentChatChannels.id, { onDelete: "cascade" })
      .notNull(),
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    authorUserId: uuid("author_user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    teamId: uuid("team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  }
);

export const tournamentChatReadCursors = pgTable(
  "tournament_chat_read_cursors",
  {
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    channelId: uuid("channel_id")
      .references(() => tournamentChatChannels.id, { onDelete: "cascade" })
      .notNull(),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.channelId] }),
  ]
);

export const pools = pgTable("pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  divisionId: uuid("division_id")
    .references(() => divisions.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const poolTeams = pgTable("pool_teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .references(() => pools.id, { onDelete: "cascade" })
    .notNull(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  seed: integer("seed"),
});

export const brackets = pgTable("brackets", {
  id: uuid("id").primaryKey().defaultRandom(),
  divisionId: uuid("division_id")
    .references(() => divisions.id, { onDelete: "cascade" })
    .notNull(),
  bracketType: bracketTypeEnum("bracket_type")
    .default("single_elimination")
    .notNull(),
  seedCount: integer("seed_count").notNull(),
  /** Display name, e.g. Gold / Silver / Bronze. */
  name: text("name"),
  /** 0 = Gold, 1 = Silver, 2 = Bronze. */
  tier: integer("tier").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const courts = pgTable("courts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tournamentId: uuid("tournament_id")
    .references(() => tournaments.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
});

/** Many-to-many: a court may serve multiple divisions; courts with no rows here are shared for scheduling */
export const courtDivisions = pgTable(
  "court_divisions",
  {
    courtId: uuid("court_id")
      .references(() => courts.id, { onDelete: "cascade" })
      .notNull(),
    divisionId: uuid("division_id")
      .references(() => divisions.id, { onDelete: "cascade" })
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.courtId, t.divisionId] })]
);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Denormalized for slug uniqueness and tournament-scoped queries. */
    tournamentId: uuid("tournament_id")
      .references(() => tournaments.id, { onDelete: "cascade" })
      .notNull(),
    /** URL segment under `/tournaments/{slug}/matches/…`, unique per tournament. */
    slug: text("slug").notNull(),
    poolId: uuid("pool_id").references(() => pools.id, { onDelete: "set null" }),
    bracketId: uuid("bracket_id").references(() => brackets.id, {
      onDelete: "set null",
    }),
    courtId: uuid("court_id").references(() => courts.id, {
      onDelete: "set null",
    }),
    teamAId: uuid("team_a_id").references(() => teams.id),
    teamBId: uuid("team_b_id").references(() => teams.id),
    /** Working team responsible for reffing this match. Defaults to a lower-seeded
     * pool team that is not playing; host can override. */
    refTeamId: uuid("ref_team_id").references(() => teams.id, {
      onDelete: "set null",
    }),
    bracketRound: integer("bracket_round"),
    bracketPosition: integer("bracket_position"),
    scheduledTime: timestamp("scheduled_time"),
    status: matchStatusEnum("status").default("upcoming").notNull(),
    /** Set when the ref/host starts the pre-match warmup. Drives the warmup
     * countdown; the match is in its "warmup" phase while this is set and
     * `startedAt` / a non-upcoming status are not. */
    warmupStartedAt: timestamp("warmup_started_at"),
    /** Set when play actually begins (distinct from `scheduledTime`, which is the
     * planned start). */
    startedAt: timestamp("started_at"),
    winnerId: uuid("winner_id").references(() => teams.id),
    /** Active point keeper for this match; must hold a scorekeeper crew slot. */
    pointKeeperUserId: uuid("point_keeper_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("matches_tournament_slug_unique").on(t.tournamentId, t.slug),
  ]
);

export const sets = pgTable(
  "sets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    setNumber: integer("set_number").notNull(),
    teamAScore: integer("team_a_score").default(0).notNull(),
    teamBScore: integer("team_b_score").default(0).notNull(),
  },
  (t) => [
    uniqueIndex("sets_match_set_number_unique").on(t.matchId, t.setNumber),
  ]
);

export const matchRefCrew = pgTable(
  "match_ref_crew",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matchId: uuid("match_id")
      .references(() => matches.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    role: matchRefCrewRoleEnum("role").notNull(),
    claimedAt: timestamp("claimed_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("match_ref_crew_match_role_unique").on(t.matchId, t.role),
    uniqueIndex("match_ref_crew_match_user_unique").on(t.matchId, t.userId),
  ]
);

/**
 * Records text that tripped the content filter so admins can review false
 * positives / actual abuse from the admin panel. The original `text` is
 * stored verbatim because the offending word alone isn't enough context.
 */
export const contentFlags = pgTable("content_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  area: text("area").notNull(),
  text: text("text").notNull(),
  blockedWord: text("blocked_word").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  schoolMemberships: many(schoolMembers),
  organizedTournaments: many(tournaments),
  tournamentStaffMemberships: many(tournamentStaff),
  notifications: many(userNotifications),
  pushTokens: many(userPushTokens),
  webPushSubscriptions: many(userWebPushSubscriptions),
  notificationPreferences: many(userNotificationPreferences),
  sentMemberInvites: many(memberInvites, { relationName: "memberInviteSender" }),
  acceptedMemberInvites: many(memberInvites, {
    relationName: "memberInviteAcceptor",
  }),
  postingAnnouncements: many(tournamentPostingAnnouncements),
  schoolJoinRequests: many(schoolJoinRequests),
  resolvedSchoolJoinRequests: many(schoolJoinRequests, {
    relationName: "schoolJoinRequestResolvedBy",
  }),
}));

export const schoolsRelations = relations(schools, ({ one, many }) => ({
  members: many(schoolMembers),
  joinRequests: many(schoolJoinRequests),
  teams: many(teams),
  hostedTournaments: many(tournaments),
  verifiedBy: one(users, {
    fields: [schools.verifiedByUserId],
    references: [users.id],
  }),
}));

export const schoolMembersRelations = relations(schoolMembers, ({ one }) => ({
  school: one(schools, {
    fields: [schoolMembers.schoolId],
    references: [schools.id],
  }),
  user: one(users, {
    fields: [schoolMembers.userId],
    references: [users.id],
  }),
}));

export const schoolJoinRequestsRelations = relations(
  schoolJoinRequests,
  ({ one }) => ({
    school: one(schools, {
      fields: [schoolJoinRequests.schoolId],
      references: [schools.id],
    }),
    user: one(users, {
      fields: [schoolJoinRequests.userId],
      references: [users.id],
    }),
    resolvedBy: one(users, {
      fields: [schoolJoinRequests.resolvedByUserId],
      references: [users.id],
      relationName: "schoolJoinRequestResolvedBy",
    }),
  })
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  members: many(teamMembers),
  registrations: many(registrations),
  poolTeams: many(poolTeams),
  school: one(schools, {
    fields: [teams.schoolId],
    references: [schools.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const tournamentsRelations = relations(tournaments, ({ one, many }) => ({
  organizer: one(users, {
    fields: [tournaments.organizerId],
    references: [users.id],
  }),
  hostSchool: one(schools, {
    fields: [tournaments.hostSchoolId],
    references: [schools.id],
  }),
  divisions: many(divisions),
  registrations: many(registrations),
  courts: many(courts),
  waivers: many(tournamentWaivers),
  staff: many(tournamentStaff),
  emailSends: many(tournamentEmailSends),
  chatChannels: many(tournamentChatChannels),
  chatMessages: many(tournamentChatMessages),
  notifications: many(userNotifications),
  postingAnnouncements: many(tournamentPostingAnnouncements),
}));

export const tournamentStaffRelations = relations(tournamentStaff, ({ one }) => ({
  tournament: one(tournaments, {
    fields: [tournamentStaff.tournamentId],
    references: [tournaments.id],
  }),
  user: one(users, {
    fields: [tournamentStaff.userId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [tournamentStaff.createdByUserId],
    references: [users.id],
    relationName: "tournamentStaffCreatedBy",
  }),
}));

export const tournamentWaiversRelations = relations(
  tournamentWaivers,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentWaivers.tournamentId],
      references: [tournaments.id],
    }),
    uploadedBy: one(users, {
      fields: [tournamentWaivers.uploadedByUserId],
      references: [users.id],
    }),
    completions: many(waiverCompletions),
  })
);

export const waiverCompletionsRelations = relations(
  waiverCompletions,
  ({ one }) => ({
    waiver: one(tournamentWaivers, {
      fields: [waiverCompletions.waiverId],
      references: [tournamentWaivers.id],
    }),
    tournament: one(tournaments, {
      fields: [waiverCompletions.tournamentId],
      references: [tournaments.id],
    }),
    team: one(teams, {
      fields: [waiverCompletions.teamId],
      references: [teams.id],
    }),
    user: one(users, {
      fields: [waiverCompletions.userId],
      references: [users.id],
    }),
    attestedBy: one(users, {
      fields: [waiverCompletions.attestedByUserId],
      references: [users.id],
      relationName: "waiverAttestedBy",
    }),
    waivedBy: one(users, {
      fields: [waiverCompletions.waivedByUserId],
      references: [users.id],
      relationName: "waiverWaivedBy",
    }),
  })
);

export const userNotificationsRelations = relations(
  userNotifications,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotifications.userId],
      references: [users.id],
    }),
    tournament: one(tournaments, {
      fields: [userNotifications.tournamentId],
      references: [tournaments.id],
    }),
  })
);

export const userPushTokensRelations = relations(userPushTokens, ({ one }) => ({
  user: one(users, {
    fields: [userPushTokens.userId],
    references: [users.id],
  }),
}));

export const userWebPushSubscriptionsRelations = relations(
  userWebPushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [userWebPushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

export const userNotificationPreferencesRelations = relations(
  userNotificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationPreferences.userId],
      references: [users.id],
    }),
  })
);

export const memberInvitesRelations = relations(memberInvites, ({ one }) => ({
  school: one(schools, {
    fields: [memberInvites.schoolId],
    references: [schools.id],
  }),
  team: one(teams, {
    fields: [memberInvites.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [memberInvites.invitedByUserId],
    references: [users.id],
    relationName: "memberInviteSender",
  }),
  acceptedBy: one(users, {
    fields: [memberInvites.acceptedByUserId],
    references: [users.id],
    relationName: "memberInviteAcceptor",
  }),
}));

export const tournamentPostingAnnouncementsRelations = relations(
  tournamentPostingAnnouncements,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentPostingAnnouncements.tournamentId],
      references: [tournaments.id],
    }),
    sentBy: one(users, {
      fields: [tournamentPostingAnnouncements.sentByUserId],
      references: [users.id],
    }),
  })
);

export const tournamentEmailSendsRelations = relations(
  tournamentEmailSends,
  ({ one }) => ({
    tournament: one(tournaments, {
      fields: [tournamentEmailSends.tournamentId],
      references: [tournaments.id],
    }),
    sentBy: one(users, {
      fields: [tournamentEmailSends.sentByUserId],
      references: [users.id],
    }),
  })
);

export const tournamentChatChannelsRelations = relations(
  tournamentChatChannels,
  ({ one, many }) => ({
    tournament: one(tournaments, {
      fields: [tournamentChatChannels.tournamentId],
      references: [tournaments.id],
    }),
    messages: many(tournamentChatMessages),
    readCursors: many(tournamentChatReadCursors),
  })
);

export const tournamentChatMessagesRelations = relations(
  tournamentChatMessages,
  ({ one }) => ({
    channel: one(tournamentChatChannels, {
      fields: [tournamentChatMessages.channelId],
      references: [tournamentChatChannels.id],
    }),
    tournament: one(tournaments, {
      fields: [tournamentChatMessages.tournamentId],
      references: [tournaments.id],
    }),
    author: one(users, {
      fields: [tournamentChatMessages.authorUserId],
      references: [users.id],
    }),
    team: one(teams, {
      fields: [tournamentChatMessages.teamId],
      references: [teams.id],
    }),
  })
);

export const tournamentChatReadCursorsRelations = relations(
  tournamentChatReadCursors,
  ({ one }) => ({
    user: one(users, {
      fields: [tournamentChatReadCursors.userId],
      references: [users.id],
    }),
    channel: one(tournamentChatChannels, {
      fields: [tournamentChatReadCursors.channelId],
      references: [tournamentChatChannels.id],
    }),
  })
);

export const divisionsRelations = relations(divisions, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [divisions.tournamentId],
    references: [tournaments.id],
  }),
  registrations: many(registrations),
  pools: many(pools),
  brackets: many(brackets),
  courtDivisions: many(courtDivisions),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  team: one(teams, {
    fields: [registrations.teamId],
    references: [teams.id],
  }),
  tournament: one(tournaments, {
    fields: [registrations.tournamentId],
    references: [tournaments.id],
  }),
  division: one(divisions, {
    fields: [registrations.divisionId],
    references: [divisions.id],
  }),
  payment: one(registrationPayments, {
    fields: [registrations.id],
    references: [registrationPayments.registrationId],
  }),
}));

export const registrationPaymentsRelations = relations(
  registrationPayments,
  ({ one }) => ({
    registration: one(registrations, {
      fields: [registrationPayments.registrationId],
      references: [registrations.id],
    }),
    tournament: one(tournaments, {
      fields: [registrationPayments.tournamentId],
      references: [tournaments.id],
    }),
    team: one(teams, {
      fields: [registrationPayments.teamId],
      references: [teams.id],
    }),
    submittedBy: one(users, {
      fields: [registrationPayments.submittedByUserId],
      references: [users.id],
      relationName: "paymentSubmittedBy",
    }),
    confirmedBy: one(users, {
      fields: [registrationPayments.confirmedByUserId],
      references: [users.id],
      relationName: "paymentConfirmedBy",
    }),
    waivedBy: one(users, {
      fields: [registrationPayments.waivedByUserId],
      references: [users.id],
      relationName: "paymentWaivedBy",
    }),
  })
);

export const poolsRelations = relations(pools, ({ one, many }) => ({
  division: one(divisions, {
    fields: [pools.divisionId],
    references: [divisions.id],
  }),
  poolTeams: many(poolTeams),
  matches: many(matches),
}));

export const poolTeamsRelations = relations(poolTeams, ({ one }) => ({
  pool: one(pools, { fields: [poolTeams.poolId], references: [pools.id] }),
  team: one(teams, { fields: [poolTeams.teamId], references: [teams.id] }),
}));

export const bracketsRelations = relations(brackets, ({ one, many }) => ({
  division: one(divisions, {
    fields: [brackets.divisionId],
    references: [divisions.id],
  }),
  matches: many(matches),
}));

export const courtsRelations = relations(courts, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [courts.tournamentId],
    references: [tournaments.id],
  }),
  courtDivisions: many(courtDivisions),
  matches: many(matches),
}));

export const courtDivisionsRelations = relations(courtDivisions, ({ one }) => ({
  court: one(courts, {
    fields: [courtDivisions.courtId],
    references: [courts.id],
  }),
  division: one(divisions, {
    fields: [courtDivisions.divisionId],
    references: [divisions.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  tournament: one(tournaments, {
    fields: [matches.tournamentId],
    references: [tournaments.id],
  }),
  pool: one(pools, { fields: [matches.poolId], references: [pools.id] }),
  bracket: one(brackets, {
    fields: [matches.bracketId],
    references: [brackets.id],
  }),
  court: one(courts, { fields: [matches.courtId], references: [courts.id] }),
  teamA: one(teams, {
    fields: [matches.teamAId],
    references: [teams.id],
    relationName: "teamA",
  }),
  teamB: one(teams, {
    fields: [matches.teamBId],
    references: [teams.id],
    relationName: "teamB",
  }),
  winner: one(teams, {
    fields: [matches.winnerId],
    references: [teams.id],
    relationName: "winner",
  }),
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  match: one(matches, { fields: [sets.matchId], references: [matches.id] }),
}));

export const matchRefCrewRelations = relations(matchRefCrew, ({ one }) => ({
  match: one(matches, { fields: [matchRefCrew.matchId], references: [matches.id] }),
  user: one(users, { fields: [matchRefCrew.userId], references: [users.id] }),
}));
