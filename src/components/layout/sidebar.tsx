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

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { navLinks, type NavLink } from "./nav-links";
import { Button } from "@/components/ui/button";

const SIDEBAR_COLLAPSED_KEY = "brackt-sidebar-collapsed";

/** Tournament workspaces need the width, so the sidebar folds to icons there. */
function isFocusRoute(pathname: string): boolean {
  return /^\/tournaments\/(?!new(?:\/|$))[^/]+/.test(pathname);
}

function navHref(link: NavLink, schoolsHref?: string): string {
  if (link.activePrefix === "/schools" && schoolsHref) return schoolsHref;
  return link.href;
}

function navActive(link: NavLink, pathname: string): boolean {
  if (link.activePrefix) {
    return (
      pathname === link.activePrefix ||
      pathname.startsWith(`${link.activePrefix}/`)
    );
  }
  if (link.exact) return pathname === link.href;
  return pathname.startsWith(link.href);
}

export function Sidebar({
  isAdmin = false,
  schoolsHref,
}: {
  isAdmin?: boolean;
  schoolsHref?: string;
}) {
  const pathname = usePathname();
  const [storedCollapsed, setStoredCollapsed] = useState(false);
  const [focusExpanded, setFocusExpanded] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const visibleLinks = navLinks.filter(
    (link) => !link.hideInSidebar && (!link.adminOnly || isAdmin)
  );
  const focusRoute = isFocusRoute(pathname);
  const collapsed = focusRoute ? !focusExpanded : storedCollapsed;

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setStoredCollapsed(
          localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true"
        );
      } catch {
        /* ignore */
      }
      setHydrated(true);
    });
  }, []);

  function toggleCollapsed() {
    if (focusRoute) {
      setFocusExpanded((prev) => !prev);
      return;
    }
    setStoredCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "hidden min-h-0 md:flex md:min-h-0 md:flex-col md:border-r md:bg-sidebar md:transition-[width,transform,opacity] md:duration-300 md:ease-out motion-safe:md:animate-in motion-safe:md:fade-in-0 motion-safe:md:slide-in-from-left-1",
        collapsed ? "md:w-[4.25rem]" : "md:w-60"
      )}
    >
      <nav
        aria-label="Primary"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
      >
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const href = navHref(link, schoolsHref);
          const active = navActive(link, pathname);
          return (
            <Link
              key={link.label}
              href={href}
              aria-current={active ? "page" : undefined}
              title={hydrated && collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center px-2" : "px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={collapsed ? "sr-only" : "truncate"}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div
        className={cn(
          "flex shrink-0 border-t border-sidebar-border py-2",
          collapsed ? "justify-center px-1" : "justify-end px-2"
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}
