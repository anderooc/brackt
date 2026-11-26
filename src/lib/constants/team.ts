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

import type { TeamRegion, TeamVerificationStatus } from "@/types";

/** Database enum values for `team_gender`. */
export const TEAM_GENDERS = ["mens", "womens"] as const;

/** Database enum values for `team_region` (travel-oriented US map). */
export const TEAM_REGIONS = [
  "new_england",
  "northeast",
  "mid_atlantic",
  "southeast",
  "midwest",
  "south_central",
  "mountain",
  "pacific",
] as const;

export const TEAM_GENDER_LABELS: Record<
  (typeof TEAM_GENDERS)[number],
  string
> = {
  mens: "Men's",
  womens: "Women's",
};

export const TEAM_REGION_LABELS: Record<
  (typeof TEAM_REGIONS)[number],
  string
> = {
  new_england: "New England",
  northeast: "Northeast",
  mid_atlantic: "Mid-Atlantic",
  southeast: "Southeast",
  midwest: "Midwest",
  south_central: "South Central",
  mountain: "Mountain",
  pacific: "Pacific",
};

/**
 * US state / DC → travel region. Keys are uppercase postal codes.
 * Used to default school/team region from a known state.
 */
export const US_STATE_TO_REGION: Record<string, TeamRegion> = {
  ME: "new_england",
  NH: "new_england",
  VT: "new_england",
  MA: "new_england",
  RI: "new_england",
  CT: "new_england",
  NY: "northeast",
  NJ: "northeast",
  PA: "northeast",
  DE: "mid_atlantic",
  MD: "mid_atlantic",
  DC: "mid_atlantic",
  VA: "mid_atlantic",
  WV: "mid_atlantic",
  NC: "southeast",
  SC: "southeast",
  GA: "southeast",
  FL: "southeast",
  AL: "southeast",
  MS: "southeast",
  TN: "southeast",
  KY: "southeast",
  OH: "midwest",
  IN: "midwest",
  MI: "midwest",
  IL: "midwest",
  WI: "midwest",
  MN: "midwest",
  IA: "midwest",
  MO: "midwest",
  ND: "midwest",
  SD: "midwest",
  NE: "midwest",
  KS: "midwest",
  TX: "south_central",
  OK: "south_central",
  AR: "south_central",
  LA: "south_central",
  MT: "mountain",
  WY: "mountain",
  CO: "mountain",
  NM: "mountain",
  AZ: "mountain",
  UT: "mountain",
  NV: "mountain",
  ID: "mountain",
  CA: "pacific",
  OR: "pacific",
  WA: "pacific",
  AK: "pacific",
  HI: "pacific",
};

/** Resolve a US postal code (any case) to a travel region, or null if unknown. */
export function regionForUsState(state: string): TeamRegion | null {
  const code = state.trim().toUpperCase();
  return US_STATE_TO_REGION[code] ?? null;
}

export const TEAM_VERIFICATION_STATUS_LABELS: Record<
  TeamVerificationStatus,
  string
> = {
  pending: "Pending review",
  verified: "Verified",
  rejected: "Rejected",
};
