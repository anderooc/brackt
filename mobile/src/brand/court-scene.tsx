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

import { useColorScheme, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

/*
 * The web's tournament cover scene (src/components/brand/cover-scene.tsx):
 * court, net, and a ball arcing off the tape. Geometry is copied verbatim so
 * both surfaces draw the same picture; shapes name an ink, and each palette
 * maps inks to colors.
 */
type Ink = "court" | "net" | "line" | "wash" | "mist" | "paper" | "chalk";

type Shape = {
  d: string;
  fill?: Ink;
  fillOpacity?: number;
  stroke?: Ink;
  strokeWidth?: number;
  transform?: string;
};

const VIEWBOX = "830 40 600 530";
export const COURT_SCENE_ASPECT = 600 / 530;

const SHAPES: Shape[] = [
  { d: "M846 385L1182 265L1406 425L1070 545L846 385Z", fill: "wash" },
  { d: "M846 365L1182 245L1406 405L1070 525L846 365Z", fill: "court" },
  {
    d: "M975 336L1175 470M1077 300L1277 434M875 372L1177 264L1377 398L1075 506L875 372Z",
    stroke: "chalk",
    strokeWidth: 3,
  },
  {
    d: "M1014 225L1238 385V443L1014 283V225Z",
    fill: "chalk",
    fillOpacity: 0.14,
    stroke: "line",
    strokeWidth: 2,
  },
  {
    d: "M1014 244.33L1238 404.33M1014 263.67L1238 423.67M1042 245V303M1070 265V323M1098 285V343M1126 305V363M1154 325V383M1182 345V403M1210 365V423",
    stroke: "line",
    strokeWidth: 2,
  },
  { d: "M1014 215V307M1238 375V457M1014 225L1238 385", stroke: "net", strokeWidth: 6 },
  { d: "M1130 250C1130 125 1200 80 1310 80", stroke: "line", strokeWidth: 3 },
  {
    d: "M1334.5 81C1334.5 94.531 1323.53 105.5 1310 105.5C1296.47 105.5 1285.5 94.531 1285.5 81C1285.5 67.469 1296.47 56.5 1310 56.5C1323.53 56.5 1334.5 67.469 1334.5 81Z",
    fill: "paper",
    stroke: "court",
    strokeWidth: 3,
  },
  {
    d: "M11.1 7.1a16.55 16.55 0 0 1 10.9 4M12 12a12.6 12.6 0 0 1-8.7 5M16.8 13.6a16.55 16.55 0 0 1-9 7.5M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5",
    stroke: "court",
    strokeWidth: 1.1,
    transform: "translate(1280.6 51.6) scale(2.45)",
  },
];

type Paint = { color: string; opacity?: number };
type Palette = Record<Ink, Paint>;

// The web's --art-* tokens, converted from OKLCH.
const COVER_LIGHT: Palette = {
  court: { color: "#315ca8" },
  net: { color: "#c92f45" },
  line: { color: "#b9cde9" },
  wash: { color: "#e1eaf7" },
  mist: { color: "#eff4fb" },
  paper: { color: "#ffffff" },
  chalk: { color: "#ffffff" },
};

const COVER_DARK: Palette = {
  court: { color: "#4773bd" },
  net: { color: "#e65964" },
  line: { color: "#394e6e" },
  wash: { color: "#21304a" },
  mist: { color: "#151e2f" },
  paper: { color: "#0c131f" },
  chalk: { color: "#f2f5fb" },
};

// Drawn in chalk over the court-blue hero, so the scene reads as texture.
const HERO: Palette = {
  court: { color: "#ffffff", opacity: 0.1 },
  net: { color: "#e65964" },
  line: { color: "#ffffff", opacity: 0.35 },
  wash: { color: "#000000", opacity: 0.12 },
  mist: { color: "#ffffff", opacity: 0 },
  paper: { color: "#ffffff" },
  chalk: { color: "#ffffff", opacity: 0.45 },
};

/** Cover palettes per theme, exposed so the cover can tint its own backdrop. */
export function useCoverInks() {
  return useColorScheme() === "dark" ? COVER_DARK : COVER_LIGHT;
}

export function CourtScene({
  variant = "cover",
  width,
  style,
}: {
  variant?: "cover" | "hero";
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const cover = useCoverInks();
  const palette = variant === "hero" ? HERO : cover;

  return (
    <Svg
      width={width}
      height={width / COURT_SCENE_ASPECT}
      viewBox={VIEWBOX}
      fill="none"
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {SHAPES.map((shape) => {
        const fill = shape.fill ? palette[shape.fill] : null;
        const stroke = shape.stroke ? palette[shape.stroke] : null;
        // The ball's seams sit on the ball, which is paper in every palette.
        const seam = variant === "hero" && shape.stroke === "court";
        return (
          <Path
            key={shape.d}
            d={shape.d}
            fill={fill ? fill.color : "none"}
            fillOpacity={
              fill ? (shape.fillOpacity ?? 1) * (fill.opacity ?? 1) : undefined
            }
            stroke={stroke ? (seam ? "#315ca8" : stroke.color) : undefined}
            strokeOpacity={stroke && !seam ? stroke.opacity : undefined}
            strokeWidth={shape.strokeWidth}
            strokeLinecap="round"
            transform={shape.transform}
          />
        );
      })}
    </Svg>
  );
}
