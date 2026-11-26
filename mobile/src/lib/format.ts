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

export const TOURNAMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  registration_open: "Registration open",
  registration_closed: "Registration closed",
  in_progress: "In progress",
  completed: "Completed",
};

export const TOURNAMENT_STATUS_VALUES = [
  "draft",
  "registration_open",
  "registration_closed",
  "in_progress",
  "completed",
] as const;

export const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked in",
};

export const TEAM_GENDER_VALUES = ["mens", "womens"] as const;
export const TEAM_REGION_VALUES = [
  "new_england",
  "northeast",
  "mid_atlantic",
  "southeast",
  "midwest",
  "south_central",
  "mountain",
  "pacific",
] as const;

export const GENDER_LABELS: Record<string, string> = {
  mens: "Men's",
  womens: "Women's",
};

export const SCHOOL_VERIFICATION_LABELS: Record<string, string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
};

export const SCHOOL_ROLE_LABELS: Record<string, string> = {
  president: "President",
  officer: "Officer",
  member: "Member",
};

export const TEAM_ROLE_LABELS: Record<string, string> = {
  captain: "Captain",
  player: "Player",
};

export const TEAM_VERIFICATION_LABELS: Record<string, string> = {
  pending: "Pending verification",
  verified: "Verified",
  rejected: "Rejected",
};

export const DASHBOARD_RELATION_LABELS: Record<string, string> = {
  pending: "Pending acceptance",
  signed_up: "Signed up",
  past: "Past",
  hosting: "Hosting",
};

export const PERSONAL_SCHEDULE_ROLE_LABELS: Record<string, string> = {
  playing: "Playing",
  reffing: "Reffing",
  crew: "Officiating",
  scorekeeping: "Scorekeeping",
};

export const USER_PLAYER_GENDERS = ["male", "female"] as const;

export const USER_PLAYER_GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
};

export const VOLLEYBALL_POSITIONS = [
  "outside_hitter",
  "middle_blocker",
  "opposite_hitter",
  "setter",
  "libero_ds",
] as const;

export const VOLLEYBALL_POSITION_LABELS: Record<string, string> = {
  outside_hitter: "Outside hitter",
  middle_blocker: "Middle blocker",
  opposite_hitter: "Opposite hitter",
  setter: "Setter",
  libero_ds: "Libero / DS",
};

export const REGION_LABELS: Record<string, string> = {
  new_england: "New England",
  northeast: "Northeast",
  mid_atlantic: "Mid-Atlantic",
  southeast: "Southeast",
  midwest: "Midwest",
  south_central: "South Central",
  mountain: "Mountain",
  pacific: "Pacific",
};

export const MATCH_PHASE_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  warmup: "Warmup",
  paused: "Paused",
  in_progress: "Live",
  completed: "Final",
};

export const MATCH_FORMAT_LABELS: Record<string, string> = {
  play_all_3: "Play all 3 sets",
  best_of_2: "Best of 2",
  two_with_tiebreak: "2 sets + tiebreak",
};

export const PLAY_FORMAT_VALUES = [
  "pool_to_bracket",
  "single_elimination",
  "double_elimination",
] as const;

export const PLAY_FORMAT_LABELS: Record<string, string> = {
  pool_to_bracket: "Group play to bracket",
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
};

export const PLAY_FORMAT_DESCRIPTIONS: Record<string, string> = {
  pool_to_bracket:
    "Teams play round-robin in pools, then top finishers advance to elimination brackets.",
  single_elimination:
    "Teams go straight into a single-elimination bracket; one loss eliminates a team.",
  double_elimination:
    "Teams play in winners and losers brackets; a team must lose twice to be eliminated.",
};

/** Today as `YYYY-MM-DD` in the device's local timezone. */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a `YYYY-MM-DD` calendar date as local midnight. */
export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isTournamentArchived(
  tournamentDate: string,
  today: string = todayISO()
): boolean {
  return tournamentDate < today;
}

export function tournamentListStatusLabel(
  status: string,
  tournamentDate: string,
  today: string = todayISO()
): string {
  if (isTournamentArchived(tournamentDate, today)) return "Archived";
  return TOURNAMENT_STATUS_LABELS[status] ?? status;
}

export function formatScheduleHeading(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRailDate(iso: string): {
  weekday: string;
  monthDay: string;
} {
  const date = parseISODate(iso);
  return {
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    monthDay: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  };
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function registrationAvailabilityLabel(availability: {
  capacity: number | null;
  registeredCount: number;
  waitlistCount: number;
}): string {
  const registered =
    availability.capacity == null
      ? `${availability.registeredCount} registered`
      : `${availability.registeredCount} / ${availability.capacity} registered`;
  return `${registered} · ${availability.waitlistCount} waiting`;
}

export const DIVISION_FORMAT_LABELS: Record<string, string> = {
  pool_to_bracket: "Group play to bracket",
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
};

/** Formats a `YYYY-MM-DD` calendar date without shifting it across a timezone. */
export function formatCalendarDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;

  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  in_progress: "Live",
  completed: "Final",
};

export function formatMatchTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return rtf.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return rtf.format(days, "day");
  const weeks = Math.round(days / 7);
  if (Math.abs(weeks) < 5) return rtf.format(weeks, "week");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(days / 365), "year");
}

export function formatSetLine(
  sets: { setNumber: number; teamAScore: number; teamBScore: number }[]
): string | null {
  if (sets.length === 0) return null;
  return sets
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((set) => `${set.teamAScore}–${set.teamBScore}`)
    .join("  ");
}

export const BRACKET_TYPE_LABELS: Record<string, string> = {
  single_elimination: "Single elimination",
  double_elimination: "Double elimination",
};

export function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

export function bracketRoundLabel(round: number, totalRounds: number): string {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semis";
  if (round === totalRounds - 2) return "Quarters";
  return `Round ${round}`;
}

export function formatDeadline(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatFeeCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function paymentMethodLabel(method: string | null | undefined): string {
  switch (method) {
    case "venmo":
      return "Venmo";
    case "zelle":
      return "Zelle";
    case "cashapp":
      return "Cash App";
    case "check":
      return "Check";
    case "cash":
      return "Cash";
    case "other":
      return "Other";
    default:
      return "Not specified";
  }
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "unpaid":
      return "Unpaid";
    case "submitted":
      return "Pending review";
    case "confirmed":
      return "Paid";
    case "waived":
      return "Waived";
    default:
      return status;
  }
}

export function waiverMethodLabel(method: string | null): string {
  switch (method) {
    case "digital":
      return "Digital";
    case "captain_attested":
      return "Captain attested";
    case "host_override":
      return "Host waived";
    default:
      return "Pending";
  }
}

export const EMAIL_AUDIENCE_OPTIONS = [
  {
    value: "captains_confirmed",
    label: "Confirmed captains",
  },
  {
    value: "captains_all",
    label: "All registered captains",
  },
  {
    value: "captains_pending",
    label: "Pending captains",
  },
  {
    value: "captains_waiver_incomplete",
    label: "Captains with incomplete waivers",
  },
] as const;

export const PAYMENT_METHODS = [
  "venmo",
  "zelle",
  "cashapp",
  "check",
  "cash",
  "other",
] as const;

export const MATCH_FORMAT_OPTIONS = [
  { value: "two_with_tiebreak", label: "2 sets, 3rd if tied" },
  { value: "play_all_3", label: "Play all 3 sets" },
  { value: "best_of_2", label: "Best of 2 (ties allowed)" },
] as const;

export const WARMUP_FORMAT_OPTIONS = [
  { value: "three_three_one", label: "3–3–1 warmup" },
  { value: "none", label: "No warmup" },
] as const;

export const POOL_TIEBREAK_OPTIONS = [
  { value: "match_record", label: "Match record (W-L)" },
  { value: "set_record", label: "Set record" },
  { value: "point_diff", label: "Point differential" },
  { value: "head_to_head", label: "Head-to-head" },
] as const;

export const BRACKET_COUNT_OPTIONS = [
  { value: 1, label: "Single combined bracket" },
  { value: 2, label: "Gold and silver" },
  { value: 3, label: "Gold, silver, and bronze" },
] as const;
