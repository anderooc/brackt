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
import { BracktMark } from "@/components/layout/brackt-mark";
import { COPYRIGHT_HOLDER, COPYRIGHT_YEAR } from "@/lib/metadata";

export function PublicSiteFooter({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <footer className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
      <BracktMark logoClassName="mx-auto h-5" />
      {showTagline ? (
        <p className="mt-2 text-xs">
          Tournament hub for collegiate club volleyball.
        </p>
      ) : null}
      <nav
        aria-label="Footer"
        className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
      >
        <Link href="/about" className="underline-offset-4 hover:underline">
          About
        </Link>
        <Link href="/explore" className="underline-offset-4 hover:underline">
          Explore
        </Link>
        <Link href="/privacy" className="underline-offset-4 hover:underline">
          Privacy
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:underline">
          Terms
        </Link>
      </nav>
      <p className="mt-3 text-xs">
        © {COPYRIGHT_YEAR} {COPYRIGHT_HOLDER}. Licensed under{" "}
        <Link
          href="https://www.gnu.org/licenses/gpl-3.0.html"
          className="underline-offset-4 hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          GNU GPL v3
        </Link>
        .
      </p>
    </footer>
  );
}
