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

import { WifiOff } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { PublicSiteFooter } from "@/components/layout/public-site-footer";
import { getCurrentAuthProfile } from "@/lib/auth";
import { pageMetadata } from "@/lib/metadata";
import { OfflineControls } from "./offline-controls";

export const metadata = pageMetadata(
  "Offline Mode",
  "Offline tournament resilience for brackt. View saved match schedules, scores, and gym connection tips.",
  { canonical: "/offline" }
);

export default async function OfflinePage() {
  let user = null;
  try {
    user = await getCurrentAuthProfile();
  } catch {
    // Gracefully handle auth error if database or network is unreachable
    user = null;
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      <SiteHeader user={user} />

      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex-1 overflow-x-hidden py-12 md:py-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 text-foreground/[0.05] bg-dot-grid [mask-image:linear-gradient(to_bottom,black,transparent)]"
        />

        <div className="container mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center space-y-3 mb-8">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-1">
              <WifiOff className="h-6 w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              You&apos;re offline
            </h1>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your device lost its internet connection. Any tournament pages or
              scores you previously viewed are still cached on this device.
            </p>
          </div>

          <OfflineControls />
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
