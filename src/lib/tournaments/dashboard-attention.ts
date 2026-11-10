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

import type { RegistrationPaymentStatus } from "@/types";

export type AttentionKind =
  | "approve_teams"
  | "review_payments"
  | "pay_fee"
  | "sign_waiver"
  | "collect_waivers";

export type AttentionTournament = {
  id: string;
  slug: string;
  name: string;
  date: string;
};

export type AttentionItem = {
  key: string;
  kind: AttentionKind;
  tournament: AttentionTournament;
  /** Teams to approve, payments to review, or teammates missing a waiver. */
  count?: number;
  teamName?: string;
  amountCents?: number;
};

export type AttentionHostedInput = {
  tournament: AttentionTournament;
  pendingCount: number;
  paymentsToReview: number;
};

export type AttentionRegistrationInput = {
  tournament: AttentionTournament;
  teamId: string;
  teamName: string;
  isCaptain: boolean;
  paymentStatus: RegistrationPaymentStatus | null;
  amountCents: number | null;
  waiverEnabled: boolean;
  waiverAllowDigitalAck: boolean;
};

export type AttentionInputs = {
  userId: string;
  hosted: AttentionHostedInput[];
  registrations: AttentionRegistrationInput[];
  /** tournamentId → id of the latest uploaded waiver version. */
  latestWaiverByTournament: Map<string, string>;
  /** Completions on any waiver version for the viewer and captained rosters. */
  completions: Array<{ waiverId: string; userId: string }>;
  /** teamId → roster user ids, for teams the viewer captains. */
  rosterByTeam: Map<string, string[]>;
};

const KIND_ORDER: Record<AttentionKind, number> = {
  approve_teams: 0,
  review_payments: 1,
  pay_fee: 2,
  sign_waiver: 3,
  collect_waivers: 4,
};

/**
 * Things the viewer can act on right now, soonest event first. Purely
 * informational states (e.g. an application awaiting host review) are left
 * out so the list only ever asks for something the viewer can do.
 */
export function collectAttentionItems(inputs: AttentionInputs): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const hosted of inputs.hosted) {
    if (hosted.pendingCount > 0) {
      items.push({
        key: `approve:${hosted.tournament.id}`,
        kind: "approve_teams",
        tournament: hosted.tournament,
        count: hosted.pendingCount,
      });
    }
    if (hosted.paymentsToReview > 0) {
      items.push({
        key: `payments:${hosted.tournament.id}`,
        kind: "review_payments",
        tournament: hosted.tournament,
        count: hosted.paymentsToReview,
      });
    }
  }

  const signedWaivers = new Map<string, Set<string>>();
  for (const completion of inputs.completions) {
    let users = signedWaivers.get(completion.waiverId);
    if (!users) {
      users = new Set();
      signedWaivers.set(completion.waiverId, users);
    }
    users.add(completion.userId);
  }
  const hasSigned = (waiverId: string, userId: string) =>
    signedWaivers.get(waiverId)?.has(userId) ?? false;

  const signPrompted = new Set<string>();

  for (const reg of inputs.registrations) {
    if (reg.isCaptain && reg.paymentStatus === "unpaid") {
      items.push({
        key: `pay:${reg.tournament.id}:${reg.teamId}`,
        kind: "pay_fee",
        tournament: reg.tournament,
        teamName: reg.teamName,
        amountCents: reg.amountCents ?? undefined,
      });
    }

    if (!reg.waiverEnabled) continue;
    const waiverId = inputs.latestWaiverByTournament.get(reg.tournament.id);
    if (!waiverId) continue;

    if (
      reg.waiverAllowDigitalAck &&
      !signPrompted.has(reg.tournament.id) &&
      !hasSigned(waiverId, inputs.userId)
    ) {
      signPrompted.add(reg.tournament.id);
      items.push({
        key: `sign:${reg.tournament.id}`,
        kind: "sign_waiver",
        tournament: reg.tournament,
      });
    }

    if (reg.isCaptain) {
      const roster = inputs.rosterByTeam.get(reg.teamId) ?? [];
      const missing = roster.filter(
        (userId) => userId !== inputs.userId && !hasSigned(waiverId, userId)
      ).length;
      if (missing > 0) {
        items.push({
          key: `collect:${reg.tournament.id}:${reg.teamId}`,
          kind: "collect_waivers",
          tournament: reg.tournament,
          teamName: reg.teamName,
          count: missing,
        });
      }
    }
  }

  return items.sort((a, b) => {
    if (a.tournament.date !== b.tournament.date) {
      return a.tournament.date.localeCompare(b.tournament.date);
    }
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}
