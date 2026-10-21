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
import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { BracktMark } from "./brackt-mark";
import { SITE_TOP_LINKS, siteLinkActive } from "./header-nav";

export function SiteMobileNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
      <SheetContent
        side="left"
        className="w-[min(100%,20rem)] gap-0 p-0"
      >
        <div className="flex h-14 shrink-0 items-center border-b px-4 pr-14">
          <SheetTitle className="sr-only">Site navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Links to main brackt pages
          </SheetDescription>
          <BracktMark
            href="/"
           
            onClick={() => setOpen(false)}
          />
        </div>

        <nav
          className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3"
          aria-label="Site"
        >
          {SITE_TOP_LINKS.map((link) => {
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

        {!signedIn ? (
          <div className="mt-auto shrink-0 space-y-2 border-t bg-muted/20 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 w-full"
              )}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants(), "h-11 w-full")}
            >
              Get Started
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
