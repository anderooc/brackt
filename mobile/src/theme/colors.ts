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

import { useColorScheme } from "react-native";

/*
 * sRGB conversions of the OKLCH tokens in the web app's globals.css. React
 * Native cannot parse oklch(), so these are converted rather than re-picked by
 * eye — keeping the two surfaces from drifting apart. If a token changes on the
 * web, reconvert instead of guessing.
 */

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  muted: string;
  mutedForeground: string;
  border: string;
  destructive: string;
  success: string;
  warning: string;
  info: string;
  live: string;
}

const light: ThemeColors = {
  background: "#f8fdff",
  foreground: "#0d182b",
  card: "#fdffff",
  primary: "#cf1743",
  primaryForeground: "#f7fcff",
  secondary: "#00499c",
  muted: "#ebf3fc",
  mutedForeground: "#395170",
  border: "#bacce5",
  destructive: "#e7000b",
  success: "#137d41",
  warning: "#905d00",
  info: "#195bb0",
  live: "#cf1743",
};

const dark: ThemeColors = {
  background: "#0d1116",
  foreground: "#f1f5fc",
  card: "#15181f",
  primary: "#ff6879",
  primaryForeground: "#1d0c0d",
  secondary: "#73a6ef",
  muted: "#1e242e",
  mutedForeground: "#98a6b8",
  border: "#2a313d",
  destructive: "#ff6e70",
  success: "#61da92",
  warning: "#f3bd5c",
  info: "#73b6fa",
  live: "#ff6879",
};

export function useThemeColors(): ThemeColors {
  return useColorScheme() === "dark" ? dark : light;
}

export const themes: Record<"light" | "dark", ThemeColors> = { light, dark };

/** Append an 8-bit alpha channel to a `#rrggbb` token. */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  return `${hex}${Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0")}`;
}
