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

import {
  LayoutDashboard,
  Trophy,
  Users,
  Building2,
  ShieldAlert,
  Bell,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Highlight when pathname equals or is nested under this prefix. */
  activePrefix?: string;
  /** Render only for admin users. */
  adminOnly?: boolean;
  /** Reachable from a header control, so the nav lists skip it. */
  hideInSidebar?: boolean;
}

export const navLinks: NavLink[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Tournaments", href: "/tournaments", icon: Trophy },
  { label: "Teams", href: "/teams", icon: Users },
  {
    label: "Schools",
    href: "/schools",
    icon: Building2,
    activePrefix: "/schools",
  },
  {
    label: "Notifications",
    href: "/notifications",
    icon: Bell,
    hideInSidebar: true,
  },
  { label: "Admin", href: "/admin", icon: ShieldAlert, adminOnly: true },
];
