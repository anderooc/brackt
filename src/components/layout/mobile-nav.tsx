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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navLinks, type NavLink } from "./nav-links";
import { SITE_TOP_LINKS, siteLinkActive } from "./header-nav";
import { BracktMark } from "./brackt-mark";
import { useState } from "react";

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

export function MobileNav({
  isAdmin = false,
  schoolsHref,
}: {
  isAdmin?: boolean;
  schoolsHref?: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleLinks = navLinks.filter((link) => !link.adminOnly || isAdmin);
  const siteLinks = SITE_TOP_LINKS.filter((link) => link.href !== "/dashboard");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 md:hidden"
            aria-label="Open menu"
          />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(100%,20rem)] gap-0 p-0">
        <div className="flex h-14 shrink-0 items-center border-b px-4 pr-14">
          <SheetTitle className="sr-only">App navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Links to dashboard sections and site pages
          </SheetDescription>
          <BracktMark
            href="/dashboard"
           
            onClick={() => setOpen(false)}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <nav className="space-y-1 p-3" aria-label="App">
            {visibleLinks.map((link) => {
              const Icon = link.icon;
              const href = navHref(link, schoolsHref);
              const active = navActive(link, pathname);
              return (
                <Link
                  key={link.label}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <p className="mb-2 px-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Site
            </p>
            <nav className="space-y-1" aria-label="Site">
              {siteLinks.map((link) => {
                const Icon = link.icon;
                const active = siteLinkActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
