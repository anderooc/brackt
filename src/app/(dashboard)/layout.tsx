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

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DashboardContentEnter } from "@/components/layout/dashboard-content-enter";
import { RouteFade } from "@/components/layout/route-fade";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getUserSchoolSummary } from "@/lib/schools/navigation";
import { profileAvatarPublicUrl } from "@/lib/profile/avatar-storage";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata("Dashboard", undefined, {
  noIndex: true,
});

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const admin = isAdmin(user);
  const mySchool = user ? await getUserSchoolSummary(user.id) : null;
  const schoolsHref = mySchool ? `/schools/${mySchool.slug}` : undefined;

  return (
    <div className="flex min-h-dvh flex-col md:h-dvh md:max-h-dvh md:overflow-hidden">
      <Header
        isAdmin={admin}
        schoolsHref={schoolsHref}
        user={
          user
            ? {
                fullName: user.fullName,
                email: user.email,
                avatarUrl: profileAvatarPublicUrl(user.avatarStoragePath),
              }
            : null
        }
      />
      <Suspense fallback={null}>
        <DashboardContentEnter>
          <Sidebar isAdmin={admin} schoolsHref={schoolsHref} />
          <main
            id="main-content"
            tabIndex={-1}
            className="min-w-0 flex-1 overflow-x-clip p-4 md:min-h-0 md:overflow-y-auto md:overscroll-y-contain md:p-6 md:[scrollbar-gutter:stable]"
          >
            <RouteFade>{children}</RouteFade>
          </main>
        </DashboardContentEnter>
      </Suspense>
      <Toaster />
    </div>
  );
}
