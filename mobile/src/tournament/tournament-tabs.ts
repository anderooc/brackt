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

export type TournamentTabId = "overview" | "teams" | "play";
export type PlayView = "mine" | "all";

export const TOURNAMENT_TABS: { id: TournamentTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams" },
  { id: "play", label: "Play" },
];

/**
 * Reads `?tab=` / `?view=` from a link. `matches` and `my-matches` are the
 * older tab ids still sent by notifications and earlier app builds. A null tab
 * means "no preference", so the screen picks a status-aware default.
 */
export function parseTournamentLink(
  tab: string | undefined,
  view: string | undefined
): { tab: TournamentTabId | null; view: PlayView | null } {
  const parsedView: PlayView | null =
    view === "mine" || view === "all" ? view : null;
  switch (tab) {
    case "overview":
    case "teams":
      return { tab, view: parsedView };
    case "play":
      return { tab: "play", view: parsedView };
    case "matches":
      return { tab: "play", view: parsedView ?? "all" };
    case "my-matches":
      return { tab: "play", view: "mine" };
    default:
      return { tab: null, view: parsedView };
  }
}

/** On event day, open straight to play; otherwise the overview. */
export function defaultTournamentTab(status: string): TournamentTabId {
  return status === "in_progress" ? "play" : "overview";
}

/** "Your matches" when the viewer has any here, else every match. */
export function resolvePlayView(
  requested: PlayView | null,
  hasMyMatches: boolean
): PlayView {
  if (!hasMyMatches) return "all";
  return requested ?? "mine";
}
