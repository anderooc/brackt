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
import { BracktLogo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type BracktMarkProps = {
  /** If set, wraps the logo in a link */
  href?: string;
  className?: string;
  /** Sizing for the logo lockup; set a height and let width follow. */
  logoClassName?: string;
  onClick?: () => void;
};

/** Brand lockup (court symbol + "brackt" wordmark). Domain: brack-t.com */
export function BracktMark({
  href,
  className,
  logoClassName,
  onClick,
}: BracktMarkProps) {
  const logo = (
    <BracktLogo className={cn("block h-[1.375rem] w-auto", logoClassName)} />
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-label="brackt home"
        className={cn(
          "inline-flex shrink-0 items-center rounded-sm py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className
        )}
        onClick={onClick}
      >
        {logo}
      </Link>
    );
  }

  return <span className={cn("inline-flex", className)}>{logo}</span>;
}
