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

import type { BracketMatchContract } from "@/lib/api/contracts/tournament";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { bracketRoundLabel } from "~/lib/format";
import { useThemeColors, withAlpha, type ThemeColors } from "~/theme/colors";
import { radius, space, type } from "~/ui/tokens";

const MATCH_BLOCK = 84;
const TEAM_LINE = 44;
const STROKE = 2;
const CONNECTOR = 26;
const SLOT_WIDTH = 168;
const MATCH_WIDTH = SLOT_WIDTH + CONNECTOR * 2;
const CHAMPION_WIDTH = CONNECTOR + SLOT_WIDTH;
const LABEL_ROW = 32;

export function DrawnBracket({
  matches,
  onMatchPress,
}: {
  matches: BracketMatchContract[];
  onMatchPress: (matchSlug: string) => void;
}) {
  const colors = useThemeColors();
  const rounds = groupRounds(matches);
  if (rounds.length === 0) return null;

  const firstRoundCount = rounds[0].matches.length;
  const bracketHeight = firstRoundCount * MATCH_BLOCK;
  const totalRounds = rounds[rounds.length - 1].round;
  const final = rounds[rounds.length - 1].matches[0];
  const champion = championName(final);
  const championY = bracketHeight / 2;

  return (
    <View
      style={{
        width: rounds.length * MATCH_WIDTH + CHAMPION_WIDTH,
        height: LABEL_ROW + bracketHeight,
      }}
    >
      {rounds.map((column, index) => (
        <Text
          key={`label-${column.round}`}
          style={[
            styles.roundLabel,
            {
              color: colors.mutedForeground,
              left: index * MATCH_WIDTH,
              width: SLOT_WIDTH,
            },
          ]}
        >
          {bracketRoundLabel(column.round, totalRounds)}
        </Text>
      ))}
      <Text
        style={[
          styles.roundLabel,
          {
            color: colors.primary,
            left: rounds.length * MATCH_WIDTH + CONNECTOR,
            width: SLOT_WIDTH,
          },
        ]}
      >
        Champion
      </Text>

      {rounds.map((column, index) => {
        const blockHeight = MATCH_BLOCK * 2 ** index;
        return (
          <View
            key={column.round}
            style={{
              position: "absolute",
              top: LABEL_ROW,
              left: index * MATCH_WIDTH,
              width: MATCH_WIDTH,
              height: bracketHeight,
            }}
          >
            {column.matches.map((match) => (
              <View
                key={match.slug}
                style={{ height: blockHeight, width: MATCH_WIDTH }}
              >
                <MatchCell
                  match={match}
                  blockHeight={blockHeight}
                  colors={colors}
                  showAdvance
                  onPress={
                    isBye(match) ? undefined : () => onMatchPress(match.slug)
                  }
                />
              </View>
            ))}
          </View>
        );
      })}

      <View
        style={{
          position: "absolute",
          top: LABEL_ROW,
          left: rounds.length * MATCH_WIDTH,
          width: CHAMPION_WIDTH,
          height: bracketHeight,
        }}
      >
        <StrokeH
          x={0}
          y={championY}
          width={CHAMPION_WIDTH}
          color={champion ? colors.primary : colors.border}
        />
        <View
          style={{
            position: "absolute",
            top: championY - TEAM_LINE,
            left: CONNECTOR,
            width: SLOT_WIDTH,
            height: TEAM_LINE,
            justifyContent: "flex-end",
            paddingBottom: 6,
            paddingHorizontal: 4,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: champion ? colors.primary : colors.mutedForeground,
              fontSize: 15,
              fontWeight: champion ? "700" : "500",
            }}
          >
            {champion ?? "TBD"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function MatchCell({
  match,
  blockHeight,
  colors,
  showAdvance,
  onPress,
}: {
  match: BracketMatchContract;
  blockHeight: number;
  colors: ThemeColors;
  showAdvance: boolean;
  onPress?: () => void;
}) {
  const bye = isBye(match);
  const live = !bye && match.status === "in_progress";
  const complete = !bye && match.status === "completed";
  const scores = bye ? null : setsWon(match);
  const aWon = complete && match.winnerSlug === match.teamA?.slug;
  const bWon = complete && match.winnerSlug === match.teamB?.slug;
  const aName = match.teamA?.name ?? (bye && !match.teamA ? "Bye" : "TBD");
  const bName = match.teamB?.name ?? (bye && !match.teamB ? "Bye" : "TBD");

  const teamABottom = blockHeight * 0.25;
  const teamBBottom = blockHeight * 0.75;
  const midY = blockHeight * 0.5;
  const matchTop = teamABottom - TEAM_LINE;
  const matchHeight = teamBBottom - teamABottom + TEAM_LINE;
  const join = live || complete ? withAlpha(colors.foreground, 0.4) : colors.border;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${aName} versus ${bName}`}
          onPress={onPress}
          style={{
            position: "absolute",
            top: matchTop,
            left: 0,
            height: matchHeight,
            width: SLOT_WIDTH,
            borderRadius: 4,
            backgroundColor: live
              ? withAlpha(colors.primary, 0.06)
              : "transparent",
          }}
        />
      ) : null}
      {live ? (
        <View
          style={[
            styles.liveDot,
            { backgroundColor: colors.primary, top: midY - 3 },
          ]}
        />
      ) : null}
      <TeamLine
        name={aName}
        score={scores?.a}
        won={aWon}
        lost={complete && !aWon && Boolean(match.winnerSlug)}
        placeholder={!match.teamA}
        top={teamABottom - TEAM_LINE}
        colors={colors}
      />
      <TeamLine
        name={bName}
        score={scores?.b}
        won={bWon}
        lost={complete && !bWon && Boolean(match.winnerSlug)}
        placeholder={!match.teamB}
        top={teamBBottom - TEAM_LINE}
        colors={colors}
      />

      <StrokeH
        x={0}
        y={teamABottom}
        width={SLOT_WIDTH}
        color={underlineColor(colors, { live, complete, won: aWon, lost: complete && !aWon && Boolean(match.winnerSlug), bye })}
      />
      <StrokeH
        x={0}
        y={teamBBottom}
        width={SLOT_WIDTH}
        color={underlineColor(colors, { live, complete, won: bWon, lost: complete && !bWon && Boolean(match.winnerSlug), bye })}
      />
      <StrokeV
        x={SLOT_WIDTH}
        y={teamABottom}
        height={teamBBottom - teamABottom}
        color={join}
      />
      {showAdvance ? (
        <StrokeH x={SLOT_WIDTH} y={midY} width={CONNECTOR * 2} color={join} />
      ) : null}
    </View>
  );
}

function TeamLine({
  name,
  score,
  won,
  lost,
  placeholder,
  top,
  colors,
}: {
  name: string;
  score?: number;
  won: boolean;
  lost: boolean;
  placeholder: boolean;
  top: number;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.teamLine, { top }]} pointerEvents="none">
      <View style={styles.teamChip}>
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: won ? "700" : lost ? "500" : "600",
            color: lost || placeholder ? colors.mutedForeground : colors.foreground,
            fontStyle: placeholder ? "italic" : "normal",
          }}
        >
          {name}
        </Text>
        {score != null ? (
          <Text
            style={{
              fontSize: 15,
              lineHeight: 20,
              fontVariant: ["tabular-nums"],
              fontWeight: won ? "700" : "600",
              color: won ? colors.primary : colors.mutedForeground,
            }}
          >
            {score}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function StrokeH({
  x,
  y,
  width,
  color,
}: {
  x: number;
  y: number;
  width: number;
  color: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        top: y - STROKE / 2,
        width,
        height: STROKE,
        backgroundColor: color,
      }}
    />
  );
}

function StrokeV({
  x,
  y,
  height,
  color,
}: {
  x: number;
  y: number;
  height: number;
  color: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x - STROKE / 2,
        top: y,
        width: STROKE,
        height,
        backgroundColor: color,
      }}
    />
  );
}

function groupRounds(matches: BracketMatchContract[]): {
  round: number;
  matches: BracketMatchContract[];
}[] {
  const byRound = new Map<number, BracketMatchContract[]>();
  for (const match of matches) {
    const list = byRound.get(match.round) ?? [];
    list.push(match);
    byRound.set(match.round, list);
  }
  return [...byRound.keys()]
    .sort((a, b) => a - b)
    .map((round) => ({
      round,
      matches: (byRound.get(round) ?? [])
        .slice()
        .sort((a, b) => a.position - b.position),
    }));
}

function isBye(match: BracketMatchContract): boolean {
  return (
    match.round === 1 &&
    Boolean(match.teamA) !== Boolean(match.teamB)
  );
}

function championName(final: BracketMatchContract | undefined): string | null {
  if (!final?.winnerSlug) return null;
  if (final.winnerSlug === final.teamA?.slug) return final.teamA.name;
  if (final.winnerSlug === final.teamB?.slug) return final.teamB.name;
  return null;
}

function setsWon(
  match: BracketMatchContract
): { a: number; b: number } | null {
  if (match.sets.length === 0) return null;
  let a = 0;
  let b = 0;
  for (const set of match.sets) {
    if (set.teamAScore > set.teamBScore) a += 1;
    else if (set.teamBScore > set.teamAScore) b += 1;
  }
  if (a === 0 && b === 0) return null;
  return { a, b };
}

function underlineColor(
  colors: ThemeColors,
  state: {
    live: boolean;
    complete: boolean;
    won: boolean;
    lost: boolean;
    bye: boolean;
  }
): string {
  if (state.bye) return colors.border;
  if (state.live) return withAlpha(colors.primary, 0.55);
  if (state.complete && state.won) return colors.primary;
  if (state.complete && state.lost) return withAlpha(colors.border, 0.7);
  return colors.border;
}

/** sRGB hex + alpha. Theme tokens are already converted from OKLCH. */
const styles = StyleSheet.create({
  roundLabel: {
    position: "absolute",
    top: 4,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  liveDot: {
    position: "absolute",
    left: -5,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  teamLine: {
    position: "absolute",
    left: 0,
    width: SLOT_WIDTH,
    height: TEAM_LINE,
    justifyContent: "flex-end",
    paddingBottom: 3,
  },
  teamChip: {
    alignSelf: "flex-start",
    maxWidth: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderRadius: 8,
  },
});
