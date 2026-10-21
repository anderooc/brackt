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
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeaderNav } from "./header-nav";
import { BracktMark } from "./brackt-mark";
import { SiteMobileNav } from "./site-mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "./user-menu";
import { SkipLink } from "./skip-link";
import { NotificationBellSlot } from "@/components/notifications/notification-bell-slot";

export type SiteHeaderUser = {
  fullName: string;
  email: string;
  avatarUrl?: string | null;
};

export function SiteHeader({ user }: { user?: SiteHeaderUser | null }) {
  return (
    <>
      <SkipLink />
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur-sm transition-[background-color,backdrop-filter] duration-300 ease-out motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1">
        <div className="container mx-auto flex h-14 items-center gap-1 px-3 sm:gap-3 sm:px-4 md:gap-4">
          <div className="flex min-w-0 items-center gap-0.5 sm:gap-2">
            <SiteMobileNav signedIn={Boolean(user)} />
            <BracktMark href="/" />
            <HeaderNav className="min-w-0" />
          </div>

          <div className="flex-1" />

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <ThemeToggle />
            {user ? (
              <Suspense fallback={<span className="size-9" aria-hidden />}>
                <NotificationBellSlot />
              </Suspense>
            ) : null}
            {user ? (
              <UserMenu
                fullName={user.fullName}
                email={user.email}
                avatarUrl={user.avatarUrl}
              />
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "h-8 px-2.5 text-xs sm:px-3 sm:text-sm"
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "h-8 px-2.5 text-xs sm:px-3 sm:text-sm"
                  )}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
