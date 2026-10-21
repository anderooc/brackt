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
import { BracktMark } from "@/components/layout/brackt-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Sticky top bar for login, signup, and password flows. */
export function AuthTopBar() {
  const pathname = usePathname();
  const onLogin = pathname === "/login";
  const onSignup = pathname === "/signup";

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <BracktMark href="/" />
        <div className="flex-1" />
        <ThemeToggle />
        {!onLogin ? (
          <Link
            href="/login"
            className={cn(
              buttonVariants({
                variant: onSignup ? "default" : "ghost",
                size: "sm",
              }),
              "h-8 px-2.5 text-xs sm:px-3 sm:text-sm"
            )}
          >
            Sign In
          </Link>
        ) : null}
        {!onSignup ? (
          <Link
            href="/signup"
            className={cn(
              buttonVariants({ size: "sm" }),
              "h-8 px-2.5 text-xs sm:px-3 sm:text-sm"
            )}
          >
            Get Started
          </Link>
        ) : null}
      </div>
    </header>
  );
}
