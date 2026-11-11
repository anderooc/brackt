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
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_800ExtraBold_Italic,
  Archivo_900Black_Italic,
} from "@expo-google-fonts/archivo";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { StyleSheet, type StyleProp, type TextStyle } from "react-native";

/*
 * The web's pairing: Archivo for headings, Plus Jakarta Sans for everything
 * else. Each weight is its own font file, and setting `fontWeight` on a custom
 * family makes Android fall back to the system font, so styles name a family
 * token and a weight, and `resolveFont` swaps in the matching file.
 */
export const FONT_FAMILY = {
  heading: "Archivo",
  body: "PlusJakartaSans",
} as const;

export const FONT_SOURCES = {
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_800ExtraBold_Italic,
  Archivo_900Black_Italic,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

type LoadedFont = keyof typeof FONT_SOURCES;

const BODY: Record<number, LoadedFont> = {
  400: "PlusJakartaSans_400Regular",
  500: "PlusJakartaSans_500Medium",
  600: "PlusJakartaSans_600SemiBold",
  700: "PlusJakartaSans_700Bold",
  800: "PlusJakartaSans_800ExtraBold",
};

const HEADING: Record<number, LoadedFont> = {
  600: "Archivo_600SemiBold",
  700: "Archivo_700Bold",
  800: "Archivo_800ExtraBold",
};

const HEADING_ITALIC: Record<number, LoadedFont> = {
  800: "Archivo_800ExtraBold_Italic",
  900: "Archivo_900Black_Italic",
};

function weightOf(weight: TextStyle["fontWeight"]): number {
  if (weight == null || weight === "normal") return 400;
  if (weight === "bold") return 700;
  const n = typeof weight === "number" ? weight : Number(weight);
  return Number.isFinite(n) ? n : 400;
}

function nearest(table: Record<number, LoadedFont>, weight: number): LoadedFont {
  const weights = Object.keys(table).map(Number);
  const pick = weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best
  );
  return table[pick]!;
}

/** Flattens a text style and replaces family + weight with the loaded font file. */
export function resolveFont(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  const { fontFamily, fontWeight, fontStyle, ...rest } = flat;
  const family =
    fontFamily === FONT_FAMILY.heading
      ? "heading"
      : fontFamily == null || fontFamily === FONT_FAMILY.body
        ? "body"
        : null;
  // An explicit other family (e.g. a monospace accent) passes through as-is.
  if (family === null) return flat;

  const weight = weightOf(fontWeight);
  let file: LoadedFont;
  if (family === "heading") {
    file =
      fontStyle === "italic"
        ? nearest(HEADING_ITALIC, Math.max(weight, 800))
        : nearest(HEADING, Math.max(weight, 600));
  } else {
    file = nearest(BODY, weight);
  }
  return { ...rest, fontFamily: file };
}
