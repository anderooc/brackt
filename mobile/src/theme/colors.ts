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

/*
 * "Center Court" palette: court blue leads, net red is reserved for live play.
 * `secondary` is the web's `--secondary-foreground` (court ink), since native
 * only uses it as a text tone.
 */
const light: ThemeColors = {
  background: "#fafcff",
  foreground: "#17243c",
  card: "#ffffff",
  primary: "#315ca8",
  primaryForeground: "#fafcff",
  secondary: "#1e407c",
  muted: "#eff4fb",
  mutedForeground: "#47566f",
  border: "#cedaeb",
  destructive: "#e7000b",
  success: "#137d41",
  warning: "#905d00",
  info: "#315ca8",
  live: "#c92f45",
};

const dark: ThemeColors = {
  background: "#0c131f",
  foreground: "#f0f4f9",
  card: "#121b2a",
  primary: "#77a6ec",
  primaryForeground: "#0c1628",
  secondary: "#d0dff6",
  muted: "#1a2332",
  mutedForeground: "#9facbe",
  border: "#293345",
  destructive: "#ff6e70",
  success: "#61da92",
  warning: "#f3bd5c",
  info: "#88b3f0",
  live: "#f66b74",
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
