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

/** Trackpad pixels per date step: about one line, so a swipe tracks the finger. */
export const TRACKPAD_DELTA_PER_STEP = 44;

/** Fallback: single events at least this large are mouse-wheel notches. */
const WHEEL_NOTCH_MIN_DELTA = 50;

/**
 * True for a discrete mouse-wheel notch, false for trackpad pixels.
 * Mouse wheels report lines/pages (Firefox) or a legacy `wheelDeltaY` in
 * multiples of 120 (Chrome/Safari); trackpads report `wheelDeltaY` as
 * exactly -3 × `deltaY`.
 */
export function isWheelNotch(e: WheelEvent) {
  if (e.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) return true;
  const horizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  const delta = Math.abs(horizontal ? e.deltaX : e.deltaY);
  const legacyEvent = e as WheelEvent & {
    wheelDeltaX?: number;
    wheelDeltaY?: number;
  };
  const legacy = horizontal ? legacyEvent.wheelDeltaX : legacyEvent.wheelDeltaY;
  if (typeof legacy === "number" && legacy !== 0) {
    return (
      Math.abs(legacy) % 120 === 0 &&
      Math.abs(legacy) !== Math.round(delta * 3)
    );
  }
  return delta >= WHEEL_NOTCH_MIN_DELTA;
}

/**
 * Drains whole steps out of a running pixel total, leaving the remainder so
 * a slow trackpad swipe still adds up across events.
 */
export function takeSteps(accumulator: { current: number }, perStep: number) {
  let steps = 0;
  while (accumulator.current >= perStep) {
    steps += 1;
    accumulator.current -= perStep;
  }
  while (accumulator.current <= -perStep) {
    steps -= 1;
    accumulator.current += perStep;
  }
  return steps;
}
