"use client";

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
  useEffect,
  useOptimistic,
  useRef,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SECTION_BY_TAB,
  sectionEntryView,
  tournamentTabUrl,
  type TournamentSection,
  type TournamentTabId,
  type TournamentTabItem,
} from "./constants";
import { TournamentPanelSkeleton } from "./panels/panel-skeleton";

type SelectTab = (tab: TournamentTabId, href: string) => void;

export type { TournamentTabItem } from "./constants";

function CountPill({ value, emphasis }: { value: number; emphasis: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
        emphasis
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      )}
    >
      {value}
    </span>
  );
}

function sectionBadge(section: TournamentSection): number {
  return section.views.reduce((sum, view) => sum + (view.badge ?? 0), 0);
}

function SectionBar({
  slug,
  sections,
  activeTab,
  onSelect,
}: {
  slug: string;
  sections: TournamentSection[];
  activeTab: TournamentTabId;
  onSelect: SelectTab;
}) {
  const activeSection = SECTION_BY_TAB[activeTab];
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeSection]);

  return (
    <nav
      aria-label="Tournament sections"
      className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-2"
    >
      {sections.map((section) => {
        const active = section.id === activeSection;
        const entry = sectionEntryView(section);
        const href = tournamentTabUrl(slug, entry.id);
        const badge = sectionBadge(section);
        return (
          <Link
            key={section.id}
            ref={active ? activeRef : undefined}
            href={href}
            aria-current={active ? "page" : undefined}
            onNavigate={(event) => {
              event.preventDefault();
              if (!active) onSelect(entry.id, href);
            }}
            className={cn(
              "relative flex h-11 shrink-0 items-center gap-2 px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out",
              "rounded-t-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors after:duration-150",
              active
                ? "text-foreground after:bg-primary"
                : "text-muted-foreground after:bg-transparent hover:text-foreground"
            )}
          >
            {section.label}
            {badge > 0 ? <CountPill value={badge} emphasis /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function ViewSwitcher({
  slug,
  views,
  activeTab,
  onSelect,
}: {
  slug: string;
  views: TournamentTabItem[];
  activeTab: TournamentTabId;
  onSelect: SelectTab;
}) {
  return (
    <nav
      aria-label="Section views"
      className="inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-0.5 [scrollbar-width:none]"
    >
      {views.map((view) => {
        const active = view.id === activeTab;
        const href = tournamentTabUrl(slug, view.id);
        const pill =
          view.badge !== undefined && view.badge > 0
            ? { value: view.badge, emphasis: true }
            : view.count !== undefined
              ? { value: view.count, emphasis: false }
              : null;
        return (
          <Link
            key={view.id}
            href={href}
            aria-current={active ? "page" : undefined}
            onNavigate={(event) => {
              event.preventDefault();
              if (!active) onSelect(view.id, href);
            }}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 ease-out",
              "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {view.label}
            {pill ? <CountPill {...pill} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function TournamentTabs({
  slug,
  activeTab,
  sections,
  children,
}: {
  slug: string;
  activeTab: TournamentTabId;
  sections: TournamentSection[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayedTab, setDisplayedTab] = useOptimistic(activeTab);

  // The page re-renders on the server for every tab, so switch the nav and
  // show the panel skeleton immediately instead of waiting on that round trip.
  const selectTab: SelectTab = (tab, href) => {
    startTransition(() => {
      setDisplayedTab(tab);
      router.push(href);
    });
  };

  if (sections.length === 0) {
    return <>{children}</>;
  }

  const displayedSection = sections.find(
    (section) => section.id === SECTION_BY_TAB[displayedTab]
  );
  const showViews = (displayedSection?.views.length ?? 0) > 1;

  return (
    <div className="space-y-6">
      <div className="sticky top-14 z-20 -mx-4 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm md:-top-6 md:-mx-6 md:px-6">
        <SectionBar
          slug={slug}
          sections={sections}
          activeTab={displayedTab}
          onSelect={selectTab}
        />
      </div>

      {showViews && displayedSection ? (
        <ViewSwitcher
          slug={slug}
          views={displayedSection.views}
          activeTab={displayedTab}
          onSelect={selectTab}
        />
      ) : null}

      <div className="min-w-0">
        {isPending && displayedTab !== activeTab ? (
          <TournamentPanelSkeleton />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
