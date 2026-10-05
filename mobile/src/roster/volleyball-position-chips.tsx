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
  VOLLEYBALL_POSITIONS,
  VOLLEYBALL_POSITION_LABELS,
} from "~/lib/format";
import type { ThemeColors } from "~/theme/colors";
import { Chip, ChipRow } from "~/ui";

export function VolleyballPositionChips({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  colors?: ThemeColors;
}) {
  return (
    <ChipRow>
      <Chip
        label="Not set"
        selected={value === null}
        disabled={disabled}
        onPress={() => {
          if (value !== null) onChange(null);
        }}
      />
      {VOLLEYBALL_POSITIONS.map((position) => {
        const selected = value === position;
        return (
          <Chip
            key={position}
            label={VOLLEYBALL_POSITION_LABELS[position] ?? position}
            selected={selected}
            icon={selected ? "checkmark" : undefined}
            disabled={disabled}
            onPress={() => {
              if (!selected) onChange(position);
            }}
          />
        );
      })}
    </ChipRow>
  );
}
