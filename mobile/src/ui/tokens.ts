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

import type { TextStyle } from "react-native";
import { FONT_FAMILY } from "~/ui/fonts";

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 999,
} as const;

/** Minimum touch target (Apple HIG). */
export const HIT_TARGET = 44;

export type TypeVariant =
  | "largeTitle"
  | "title"
  | "headline"
  | "body"
  | "callout"
  | "subhead"
  | "footnote"
  | "caption";

export const type: Record<TypeVariant, TextStyle> = {
  largeTitle: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  title: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  headline: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  body: { fontFamily: FONT_FAMILY.body, fontSize: 16, lineHeight: 22 },
  callout: { fontFamily: FONT_FAMILY.body, fontSize: 15, lineHeight: 20 },
  subhead: { fontFamily: FONT_FAMILY.body, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: FONT_FAMILY.body, fontSize: 13, lineHeight: 18 },
  caption: {
    fontFamily: FONT_FAMILY.body,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
};
