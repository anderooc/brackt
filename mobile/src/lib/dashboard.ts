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
  DashboardAttentionContract,
  DashboardHostingContract,
} from "@/lib/api/contracts/dashboard";

function parseDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today", "Tomorrow", "In 5 days"; null for past dates or two+ weeks out. */
export function relativeDay(date: string, today: string): string | null {
  const days = Math.round(
    (parseDate(date).getTime() - parseDate(today).getTime()) / DAY_MS
  );
  if (days < 0 || days >= 14) return null;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function shortDate(iso: string): string {
  return parseDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** One-line status under the greeting: what needs you, and what's next. */
export function headlineSummary(
  attentionCount: number,
  next: { name: string; date: string } | null,
  today: string
): string {
  let nextPart = "Nothing on the calendar yet.";
  if (next) {
    const when = relativeDay(next.date, today);
    nextPart = `${next.name} is ${
      when ? when.toLowerCase() : `on ${shortDate(next.date)}`
    }.`;
  }
  if (attentionCount === 0) return `You’re all caught up. ${nextPart}`;
  return `${attentionCount} ${
    attentionCount === 1 ? "thing needs" : "things need"
  } you. ${nextPart}`;
}

/** App screen that resolves a Needs you item. */
export function attentionRoute(item: DashboardAttentionContract): string {
  const base = `/tournament/${item.tournament.slug}`;
  switch (item.target) {
    case "pending":
      return `${base}/host/registrations?tab=pending`;
    case "payment":
      return `${base}/payment`;
    case "waiver":
      return `${base}/waiver`;
  }
}

/** "12 of 16 teams · 3 pending · Closes Nov 12" for a hosted event. */
export function hostingFacts(hosting: DashboardHostingContract): string[] {
  const facts = [
    hosting.capacity != null
      ? `${hosting.teamCount} of ${hosting.capacity} teams`
      : `${hosting.teamCount} ${hosting.teamCount === 1 ? "team" : "teams"}`,
  ];
  if (hosting.pendingCount > 0) facts.push(`${hosting.pendingCount} pending`);
  if (hosting.status === "registration_open" && hosting.deadline) {
    facts.push(
      hosting.deadlinePassed
        ? "Deadline passed"
        : `Closes ${new Date(hosting.deadline).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}`
    );
  }
  return facts;
}

/** Share of capacity filled, 0–1, or null when there's no cap or it's a draft. */
export function hostingFill(hosting: DashboardHostingContract): number | null {
  if (hosting.capacity == null || hosting.status === "draft") return null;
  return Math.min(1, hosting.teamCount / hosting.capacity);
}
