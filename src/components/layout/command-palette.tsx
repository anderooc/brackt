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

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound, Trophy, type LucideIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { navLinks } from "@/components/layout/nav-links";
import { cn } from "@/lib/utils";

type PaletteItem = {
  id: string;
  label: string;
  href: string;
  keywords?: string;
  icon: LucideIcon;
  group: string;
};

export function CommandPalette({
  isAdmin = false,
  schoolsHref,
}: {
  isAdmin?: boolean;
  schoolsHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setOpen((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const items = useMemo(() => {
    const nav: PaletteItem[] = navLinks
      .filter((link) => !link.adminOnly || isAdmin)
      .map((link) => {
        const href =
          link.href === "/schools" && schoolsHref ? schoolsHref : link.href;
        return {
          id: `nav-${link.href}`,
          label: link.label,
          href,
          icon: link.icon,
          group: "Navigate",
          keywords: link.label,
        };
      });

    const actions: PaletteItem[] = [
      {
        id: "action-new-tournament",
        label: "Create tournament",
        href: "/tournaments/new",
        icon: Trophy,
        group: "Actions",
        keywords: "new host organize",
      },
      {
        id: "action-explore",
        label: "Explore tournaments",
        href: "/explore",
        icon: Search,
        group: "Actions",
        keywords: "public find browse",
      },
      {
        id: "action-profile",
        label: "Profile & notification prefs",
        href: "/profile",
        icon: UserRound,
        group: "Actions",
        keywords: "account settings push email",
      },
    ];

    return [...nav, ...actions];
  }, [isAdmin, schoolsHref]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [items]);

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-8 gap-2 px-2 text-muted-foreground sm:inline-flex",
          "border-border/70 bg-muted/30 hover:bg-muted/50"
        )}
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="text-xs">Search</span>
        <kbd className="pointer-events-none ml-1 hidden rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Command palette"
        description="Jump to pages and common actions"
      >
        <Command>
          <CommandInput placeholder="Search pages and actions…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {grouped.map(([group, groupItems], index) => (
              <div key={group}>
                {index > 0 ? <CommandSeparator /> : null}
                <CommandGroup heading={group}>
                  {groupItems.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={`${item.label} ${item.keywords ?? ""}`}
                      onSelect={() => run(item.href)}
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
