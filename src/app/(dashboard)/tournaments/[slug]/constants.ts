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

export const TOURNAMENT_TABS = [
  "overview",
  "setup",
  "packet",
  "waiver",
  "payment",
  "email",
  "chat",
  "teams",
  "pending",
  "my-matches",
  "pool-play",
  "bracket",
  "matches",
] as const;

export type TournamentTabId = (typeof TOURNAMENT_TABS)[number];

export const TOURNAMENT_TAB_LABELS: Record<TournamentTabId, string> = {
  overview: "Overview",
  setup: "Settings",
  packet: "Packet",
  waiver: "Waiver",
  payment: "Payment",
  email: "Email",
  chat: "Chat",
  teams: "Teams",
  pending: "Pending",
  "my-matches": "Your matches",
  "pool-play": "Pools",
  bracket: "Bracket",
  matches: "Matches",
};

/**
 * Top-level sections in the tournament tab bar. Each section owns one or more
 * views (the `?tab=` ids), so existing deep links keep resolving.
 */
export type TournamentSectionId =
  | "overview"
  | "teams"
  | "play"
  | "messages"
  | "settings";

export const TOURNAMENT_SECTION_ORDER = [
  "overview",
  "teams",
  "play",
  "messages",
  "settings",
] as const satisfies readonly TournamentSectionId[];

export const SECTION_BY_TAB: Record<TournamentTabId, TournamentSectionId> = {
  overview: "overview",
  teams: "teams",
  pending: "teams",
  "my-matches": "play",
  "pool-play": "play",
  bracket: "play",
  matches: "play",
  email: "messages",
  chat: "messages",
  setup: "settings",
  packet: "settings",
  waiver: "settings",
  payment: "settings",
};

export type TournamentTabItem = {
  id: TournamentTabId;
  label: string;
  count?: number;
  badge?: number;
};

export type TournamentSection = {
  id: TournamentSectionId;
  label: string;
  views: TournamentTabItem[];
};

/**
 * Groups visible views into sections. A section with a single view takes that
 * view's label so the tab bar never says "Messages" when only Chat exists.
 */
export function buildTournamentSections(
  views: TournamentTabItem[],
  sectionLabels: Record<TournamentSectionId, string>
): TournamentSection[] {
  const bySection = new Map<TournamentSectionId, TournamentTabItem[]>();
  for (const view of views) {
    const sectionId = SECTION_BY_TAB[view.id];
    const list = bySection.get(sectionId) ?? [];
    list.push(view);
    bySection.set(sectionId, list);
  }

  return TOURNAMENT_SECTION_ORDER.flatMap((sectionId) => {
    const sectionViews = bySection.get(sectionId);
    if (!sectionViews?.length) return [];
    return [
      {
        id: sectionId,
        label:
          sectionViews.length === 1
            ? sectionViews[0].label
            : sectionLabels[sectionId],
        views: sectionViews,
      },
    ];
  });
}

/** The view a section opens on: whichever needs attention, else the first. */
export function sectionEntryView(section: TournamentSection): TournamentTabItem {
  return (
    section.views.find((view) => view.badge !== undefined && view.badge > 0) ??
    section.views[0]
  );
}

export const DEFAULT_TOURNAMENT_TAB: TournamentTabId = "overview";

export function isTournamentTabId(
  value: string | undefined
): value is TournamentTabId {
  return (
    value !== undefined &&
    (TOURNAMENT_TABS as readonly string[]).includes(value)
  );
}

export function parseTournamentTab(
  tab: string | undefined,
  allowed: ReadonlySet<TournamentTabId>,
  fallback: TournamentTabId = DEFAULT_TOURNAMENT_TAB
): TournamentTabId {
  const normalized = tab === "messages" ? "email" : tab;
  if (isTournamentTabId(normalized) && allowed.has(normalized)) return normalized;
  if (allowed.has(fallback)) return fallback;
  return DEFAULT_TOURNAMENT_TAB;
}

/**
 * Tournament detail URL. Omitting `tab` lets the page pick a view from the
 * tournament's status, so explicit tabs (including overview) always set it.
 */
export function tournamentTabUrl(
  slug: string,
  tab?: TournamentTabId,
  opts?: { division?: string; pool?: string }
): string {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (opts?.division) params.set("division", opts.division);
  if (opts?.pool) params.set("pool", opts.pool);
  const q = params.toString();
  return q ? `/tournaments/${slug}?${q}` : `/tournaments/${slug}`;
}
