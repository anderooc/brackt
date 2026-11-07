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
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  CalendarClock,
  ChevronDown,
  ClipboardSignature,
  CreditCard,
  FileText,
  GitBranch,
  Inbox,
  LayoutGrid,
  Mail,
  MessageCircle,
  Settings2,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  tournamentTabUrl,
  type TournamentTabGroup,
  type TournamentTabId,
  type TournamentTabItem,
} from "./constants";
import { TournamentPanelSkeleton } from "./panels/panel-skeleton";

type SelectTab = (tab: TournamentTabId, href: string) => void;

export type { TournamentTabItem } from "./constants";

const TAB_ICONS: Record<TournamentTabId, LucideIcon> = {
  setup: Settings2,
  packet: FileText,
  waiver: ClipboardSignature,
  payment: CreditCard,
  email: Mail,
  chat: MessageCircle,
  teams: Users,
  pending: Inbox,
  "pool-play": LayoutGrid,
  bracket: GitBranch,
  matches: CalendarClock,
};

function findActiveTab(
  groups: TournamentTabGroup[],
  activeTab: TournamentTabId
): TournamentTabItem | undefined {
  for (const group of groups) {
    const match = group.tabs.find((tab) => tab.id === activeTab);
    if (match) return match;
  }
  return groups[0]?.tabs[0];
}

function TabNavLink({
  slug,
  tab,
  active,
  onSelect,
  onNavigate,
}: {
  slug: string;
  tab: TournamentTabItem;
  active: boolean;
  onSelect: SelectTab;
  onNavigate?: () => void;
}) {
  const Icon = TAB_ICONS[tab.id];
  const label =
    tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label;
  const href = tournamentTabUrl(slug, tab.id);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      onNavigate={(event) => {
        event.preventDefault();
        onSelect(tab.id, href);
      }}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0 transition-colors duration-150 ease-out",
          active
            ? "text-foreground"
            : "text-muted-foreground group-hover:text-foreground"
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {tab.badge !== undefined && tab.badge > 0 && (
        <Badge
          variant="default"
          className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs tabular-nums"
        >
          {tab.badge}
        </Badge>
      )}
    </Link>
  );
}

function SectionNav({
  slug,
  groups,
  activeTab,
  onSelect,
  onNavigate,
}: {
  slug: string;
  groups: TournamentTabGroup[];
  activeTab: TournamentTabId;
  onSelect: SelectTab;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-5" aria-label="Tournament sections">
      {groups.map((group) => (
        <div key={group.id} className="space-y-1">
          <p className="px-2.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.tabs.map((tab) => (
              <TabNavLink
                key={tab.id}
                slug={slug}
                tab={tab}
                active={tab.id === activeTab}
                onSelect={onSelect}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function MobileJumpNav({
  slug,
  groups,
  activeTab,
  onSelect,
}: {
  slug: string;
  groups: TournamentTabGroup[];
  activeTab: TournamentTabId;
  onSelect: SelectTab;
}) {
  const [open, setOpen] = useState(false);
  const current = findActiveTab(groups, activeTab);
  const Icon = current ? TAB_ICONS[current.id] : Settings2;
  const label = current
    ? current.count !== undefined
      ? `${current.label} (${current.count})`
      : current.label
    : "Section";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="h-11 w-full justify-between gap-3 px-3 font-medium"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{label}</span>
          {current?.badge !== undefined && current.badge > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-5 justify-center rounded-full px-1.5 text-xs tabular-nums"
            >
              {current.badge}
            </Badge>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
          <span className="text-xs font-medium">Jump to</span>
          <ChevronDown className="size-4" aria-hidden />
        </span>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0 p-0">
        <SheetHeader className="border-b px-4 py-3 pr-12">
          <SheetTitle>Jump to section</SheetTitle>
          <SheetDescription className="sr-only">
            Choose a tournament section to open
          </SheetDescription>
        </SheetHeader>
        <div className="max-h-[min(70vh,28rem)] overflow-y-auto p-3">
          <SectionNav
            slug={slug}
            groups={groups}
            activeTab={activeTab}
            onSelect={onSelect}
            onNavigate={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TournamentTabs({
  slug,
  activeTab,
  groups,
  children,
}: {
  slug: string;
  activeTab: TournamentTabId;
  groups: TournamentTabGroup[];
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

  if (groups.length === 0) {
    return <>{children}</>;
  }

  return (
    <div className="mt-2 flex flex-col gap-4 border-t border-border/80 pt-5 lg:mt-3 lg:flex-row lg:items-start lg:gap-0 lg:pt-6">
      <div className="lg:hidden">
        <MobileJumpNav
          slug={slug}
          groups={groups}
          activeTab={displayedTab}
          onSelect={selectTab}
        />
      </div>

      <aside className="hidden w-56 shrink-0 lg:block lg:border-r lg:border-border/80 lg:pr-6">
        <div className="sticky top-0 max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-y-contain rounded-xl bg-muted/45 p-2 ring-1 ring-border/50 [scrollbar-width:thin] dark:bg-muted/30">
          <SectionNav
            slug={slug}
            groups={groups}
            activeTab={displayedTab}
            onSelect={selectTab}
          />
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-8">
        {isPending && displayedTab !== activeTab ? (
          <TournamentPanelSkeleton />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
