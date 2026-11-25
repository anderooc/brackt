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

import type {
  MatchConsoleContract,
  MatchConsoleRefCrewRole,
} from "@/lib/api/contracts/match-console";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  formatMatchTime,
  MATCH_FORMAT_LABELS,
  MATCH_PHASE_LABELS,
} from "~/lib/format";
import { type ThemeColors, useThemeColors, withAlpha } from "~/theme/colors";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Icon,
  ListGroup,
  Section,
  haptics,
  motion,
  radius,
  space,
  timingConfig,
  useReducedMotion,
  type BadgeTone,
} from "~/ui";

/** Court-side score pads: swipe up / tap = +1, swipe down = −1. */
const SWIPE_DISTANCE = 36;
const SWIPE_VELOCITY = 0.65;
const TAP_SLOP = 14;

const SAVE_DEBOUNCE_MS = 1000;

function phaseTone(phase: string): BadgeTone {
  switch (phase) {
    case "in_progress":
      return "live";
    case "paused":
      return "warning";
    case "warmup":
      return "info";
    case "completed":
      return "success";
    default:
      return "neutral";
  }
}

export function MatchConsolePanel({
  data,
  busy,
  onLifecycle,
  onSaveSet,
  onCrewAction,
}: {
  data: MatchConsoleContract;
  colors?: ThemeColors;
  busy: boolean;
  onLifecycle: (
    action: "warmup" | "start" | "pause" | "finalize" | "reopen",
    winnerSlug?: string | null
  ) => void;
  onSaveSet: (
    setNumber: number,
    teamAScore: number,
    teamBScore: number
  ) => Promise<void>;
  onCrewAction: (
    action: "claim" | "release" | "claim_point_keeper" | "release_point_keeper",
    role?: MatchConsoleRefCrewRole
  ) => void;
}) {
  const colors = useThemeColors();
  const [selectedSetNumber, setSelectedSetNumber] = useState(
    data.scoreState.currentSetNumber
  );
  const [sidesFlipped, setSidesFlipped] = useState(false);

  useEffect(() => {
    setSelectedSetNumber(data.scoreState.currentSetNumber);
  }, [data.scoreState.currentSetNumber, data.matchSlug]);

  const teamAName = data.teamA?.name ?? "Team A";
  const teamBName = data.teamB?.name ?? "Team B";
  const phase = data.derivedPhase;
  const canScore = data.permissions.canScore;
  const canRunLifecycle = data.permissions.canRunLifecycle;
  const canClaimCrewSlot = data.permissions.canClaimCrewSlot;
  const canBecomePointKeeper = data.permissions.canBecomePointKeeper;
  const crew = data.crew;
  const showCrewPanel =
    canClaimCrewSlot ||
    data.permissions.isOrganizer ||
    data.permissions.isRefMember ||
    crew.viewerSlot != null ||
    crew.pointKeeperUserId != null ||
    crew.slots.some((slot) => slot.userId != null);
  const activeEntry = data.scoreState.tracker[selectedSetNumber - 1];
  const activeTarget = activeEntry?.target ?? data.scoreState.currentTarget;
  const editingPastSet = selectedSetNumber < data.scoreState.currentSetNumber;
  const winnerName =
    data.winnerSlug === data.teamA?.slug
      ? teamAName
      : data.winnerSlug === data.teamB?.slug
        ? teamBName
        : null;

  const meta = [
    data.scheduledTime ? formatMatchTime(data.scheduledTime) : null,
    data.courtName,
    data.divisionName,
    MATCH_FORMAT_LABELS[data.settings.matchFormat] ?? data.settings.matchFormat,
  ]
    .filter(Boolean)
    .join(" · ");

  const waitingCopy =
    canClaimCrewSlot || crew.viewerSlot
      ? crew.viewerSlot &&
        ["scorekeeper_1", "scorekeeper_2", "scorekeeper_3"].includes(crew.viewerSlot) &&
        !crew.viewerIsPointKeeper
        ? "You’re checked in. Claim point keeper below to run scoring."
        : "Check in to a crew slot below to help run this match."
      : phase === "warmup"
        ? "Warmup in progress."
        : phase === "in_progress"
          ? "Match in progress. Scores update live."
          : phase === "paused"
            ? "Match is paused."
            : "Waiting for the ref crew or host to start the match.";

  return (
    <View style={styles.root}>
      <Card>
        <View style={styles.headerRow}>
          <Badge label={MATCH_PHASE_LABELS[phase] ?? phase} tone={phaseTone(phase)} />
          <AppText variant="subhead" weight="600" style={styles.setsWon}>
            Sets {data.scoreState.setsWonA}–{data.scoreState.setsWonB}
          </AppText>
        </View>
        <AppText variant="title">
          {teamAName} vs {teamBName}
        </AppText>
        {meta ? (
          <AppText variant="footnote" tone="muted">
            {meta}
          </AppText>
        ) : null}
        {data.refTeamName ? (
          <AppText variant="footnote" tone="muted">
            Reffing: {data.refTeamName}
          </AppText>
        ) : null}
      </Card>

      {data.isBye ? (
        <Banner tone="info" message="This is a bracket bye. No scoring is needed." />
      ) : phase === "completed" ? (
        <Card style={styles.centerCard}>
          <Icon name="trophy" size={28} tone="success" />
          <AppText variant="title" style={styles.centerText}>
            {winnerName ? `${winnerName} wins` : "Match complete"}
          </AppText>
          {data.permissions.isOrganizer ? (
            <Button
              label="Reopen for corrections"
              variant="outline"
              size="sm"
              disabled={busy}
              onPress={() => onLifecycle("reopen")}
              style={styles.centerButton}
            />
          ) : null}
        </Card>
      ) : !canRunLifecycle && !(canScore && phase === "in_progress") ? (
        <Banner tone="info" message={waitingCopy} />
      ) : phase === "paused" ? (
        <Card>
          <AppText variant="subhead" tone="muted">
            Match paused. Set scores are saved.
          </AppText>
          <Button label="Resume match" icon="play" fullWidth loading={busy} onPress={() => onLifecycle("start")} />
        </Card>
      ) : phase === "upcoming" ? (
        <Card>
          <Button label="Start warmup" icon="timer-outline" fullWidth disabled={busy} onPress={() => onLifecycle("warmup")} />
          <Button label="Skip to match start" variant="outline" fullWidth disabled={busy} onPress={() => onLifecycle("start")} />
        </Card>
      ) : phase === "warmup" ? (
        <Card>
          <AppText variant="subhead" tone="muted">
            Start the match when both teams are ready.
          </AppText>
          <Button label="Start match" icon="play" fullWidth disabled={busy} onPress={() => onLifecycle("start")} />
        </Card>
      ) : (
        <>
          {canScore ? (
            <Scorekeeper
              key={`${data.matchSlug}-${selectedSetNumber}`}
              setNumber={selectedSetNumber}
              target={activeTarget}
              initialA={activeEntry?.teamAScore ?? data.settings.setStartingScore}
              initialB={activeEntry?.teamBScore ?? data.settings.setStartingScore}
              teamAName={teamAName}
              teamBName={teamBName}
              sidesFlipped={sidesFlipped}
              onFlipSides={() => setSidesFlipped((value) => !value)}
              editingPastSet={editingPastSet}
              disabled={busy}
              onSave={onSaveSet}
            />
          ) : null}
          {canRunLifecycle ? (
            <Section title="Result" description="Pause play, or record the winner when the match ends.">
              <View style={styles.actionGrid}>
                {data.teamA ? (
                  <Button
                    label={`${teamAName} wins`}
                    icon="trophy-outline"
                    variant="outline"
                    fullWidth
                    disabled={busy}
                    onPress={() => onLifecycle("finalize", data.teamA!.slug)}
                  />
                ) : null}
                {data.teamB ? (
                  <Button
                    label={`${teamBName} wins`}
                    icon="trophy-outline"
                    variant="outline"
                    fullWidth
                    disabled={busy}
                    onPress={() => onLifecycle("finalize", data.teamB!.slug)}
                  />
                ) : null}
                {data.settings.matchFormat === "best_of_2" ? (
                  <Button label="Record tie" variant="outline" fullWidth disabled={busy} onPress={() => onLifecycle("finalize", null)} />
                ) : null}
                <Button label="Pause match" icon="pause" variant="ghost" fullWidth disabled={busy} onPress={() => onLifecycle("pause")} />
              </View>
            </Section>
          ) : null}
        </>
      )}

      <Section title="Sets">
        <ListGroup>
          {data.scoreState.tracker.map((entry) => {
            const selected = entry.setNumber === selectedSetNumber;
            const leftScore = sidesFlipped ? entry.teamBScore : entry.teamAScore;
            const rightScore = sidesFlipped ? entry.teamAScore : entry.teamBScore;
            const selectable = canScore && phase === "in_progress";
            return (
              <Pressable
                key={entry.setNumber}
                accessibilityRole={selectable ? "button" : undefined}
                accessibilityState={{ selected }}
                accessibilityLabel={`Set ${entry.setNumber}${entry.current ? ", live" : ""}: ${leftScore} to ${rightScore}, played to ${entry.target}`}
                disabled={!selectable}
                onPress={() => {
                  haptics.selection();
                  setSelectedSetNumber(entry.setNumber);
                }}
                style={({ pressed }) => [
                  styles.setRow,
                  {
                    backgroundColor: pressed
                      ? colors.muted
                      : selected && selectable
                        ? withAlpha(colors.primary, 0.06)
                        : "transparent",
                  },
                ]}
              >
                <View style={styles.setLabel}>
                  <AppText variant="subhead" weight={selected ? "600" : "400"}>
                    Set {entry.setNumber}
                  </AppText>
                  {entry.current ? <Badge label="Live" tone="live" /> : null}
                </View>
                <View style={styles.setScores}>
                  <AppText variant="headline" style={[styles.tabular, { color: colors.primary }]}>
                    {leftScore}
                  </AppText>
                  <AppText variant="headline" tone="muted" style={styles.tabular}>
                    –
                  </AppText>
                  <AppText variant="headline" style={[styles.tabular, { color: colors.live }]}>
                    {rightScore}
                  </AppText>
                </View>
                <AppText variant="caption" tone="muted" style={styles.target}>
                  to {entry.target}
                </AppText>
              </Pressable>
            );
          })}
        </ListGroup>
      </Section>

      {showCrewPanel ? (
        <Section title="Ref crew">
          {!crew.isCrewComplete ? (
            <Banner
              tone="warning"
              message={`Still needed: ${crew.missingRequiredRoles
                .map((role) => crew.slots.find((slot) => slot.role === role)?.label ?? role)
                .join(", ")}`}
            />
          ) : null}
          <ListGroup>
            {crew.slots.map((slot) => {
              const open = slot.userId == null;
              const mine = crew.viewerSlot === slot.role;
              return (
                <View key={slot.role} style={styles.crewRow}>
                  <Icon
                    name={open ? "ellipse-outline" : "checkmark-circle"}
                    size={20}
                    tone={open ? "muted" : "success"}
                  />
                  <View style={styles.crewText}>
                    <AppText variant="callout" weight="600">
                      {slot.label}
                      {slot.required ? (
                        <AppText variant="footnote" tone="muted">
                          {"  "}Required
                        </AppText>
                      ) : null}
                    </AppText>
                    <AppText variant="footnote" tone={open ? "muted" : "default"}>
                      {mine ? "You" : (slot.fullName ?? (open ? "Open" : "Taken"))}
                    </AppText>
                  </View>
                  {canClaimCrewSlot && open && !crew.viewerSlot ? (
                    <Button
                      label="Claim"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onPress={() => onCrewAction("claim", slot.role)}
                    />
                  ) : null}
                </View>
              );
            })}
            <View style={styles.crewRow}>
              <Icon
                name={crew.pointKeeperFullName ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                tone={crew.pointKeeperFullName ? "success" : "muted"}
              />
              <View style={styles.crewText}>
                <AppText variant="callout" weight="600">
                  Point keeper
                </AppText>
                <AppText variant="footnote" tone={crew.pointKeeperFullName ? "default" : "muted"}>
                  {crew.viewerIsPointKeeper
                    ? "You"
                    : (crew.pointKeeperFullName ?? "A checked-in scorekeeper must claim this to run scoring")}
                </AppText>
              </View>
            </View>
          </ListGroup>
          <View style={styles.crewActions}>
            {canBecomePointKeeper ? (
              <Button label="I’m keeping points" fullWidth disabled={busy} onPress={() => onCrewAction("claim_point_keeper")} />
            ) : null}
            {crew.viewerIsPointKeeper ? (
              <Button label="Step down as point keeper" variant="outline" fullWidth disabled={busy} onPress={() => onCrewAction("release_point_keeper")} />
            ) : null}
            {crew.viewerSlot ? (
              <Button label="Release my slot" variant="ghost" fullWidth disabled={busy} onPress={() => onCrewAction("release")} />
            ) : null}
          </View>
        </Section>
      ) : null}
    </View>
  );
}

function Scorekeeper({
  setNumber,
  target,
  initialA,
  initialB,
  teamAName,
  teamBName,
  sidesFlipped,
  onFlipSides,
  editingPastSet,
  disabled,
  onSave,
}: {
  setNumber: number;
  target: number;
  initialA: number;
  initialB: number;
  teamAName: string;
  teamBName: string;
  sidesFlipped: boolean;
  onFlipSides: () => void;
  editingPastSet: boolean;
  disabled: boolean;
  onSave: (setNumber: number, teamAScore: number, teamBScore: number) => Promise<void>;
}) {
  const colors = useThemeColors();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [saving, setSaving] = useState(false);
  const dirtyRef = useRef(false);
  const latest = useRef({ a: initialA, b: initialB });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = { a, b };

  useEffect(() => {
    // Server echoes must not overwrite points entered while a save was in flight.
    if (dirtyRef.current) return;
    setA(initialA);
    setB(initialB);
  }, [initialA, initialB, setNumber]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sent = { a, b };
      void (async () => {
        setSaving(true);
        try {
          await onSave(setNumber, sent.a, sent.b);
          if (latest.current.a === sent.a && latest.current.b === sent.b) {
            dirtyRef.current = false;
          }
        } finally {
          setSaving(false);
        }
      })();
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [a, b, onSave, setNumber]);

  function bump(team: "a" | "b", delta: number) {
    if (disabled) return;
    if (delta > 0) haptics.tap();
    else haptics.selection();
    dirtyRef.current = true;
    if (team === "a") setA((prev) => Math.max(0, prev + delta));
    else setB((prev) => Math.max(0, prev + delta));
  }

  const left = sidesFlipped
    ? { name: teamBName, value: b, team: "b" as const }
    : { name: teamAName, value: a, team: "a" as const };
  const right = sidesFlipped
    ? { name: teamAName, value: a, team: "a" as const }
    : { name: teamBName, value: b, team: "b" as const };

  return (
    <View style={styles.scorekeeper}>
      <View style={styles.headerRow}>
        <AppText variant="headline" style={styles.flex}>
          Set {setNumber}
          <AppText variant="subhead" tone="muted">
            {"  "}to {target}
          </AppText>
        </AppText>
        {saving ? (
          <View style={styles.saving}>
            <ActivityIndicator size="small" />
            <AppText variant="caption" tone="muted">
              Saving
            </AppText>
          </View>
        ) : null}
      </View>
      {editingPastSet ? (
        <Banner tone="warning" message={`Editing set ${setNumber}, a set that already finished.`} />
      ) : null}
      <View style={styles.scoreRow}>
        <TeamScorePad
          name={left.name}
          value={left.value}
          side="left"
          accent={colors.primary}
          onMinus={() => bump(left.team, -1)}
          onPlus={() => bump(left.team, 1)}
          disabled={disabled}
        />
        <TeamScorePad
          name={right.name}
          value={right.value}
          side="right"
          accent={colors.live}
          onMinus={() => bump(right.team, -1)}
          onPlus={() => bump(right.team, 1)}
          disabled={disabled}
        />
      </View>
      <AppText variant="caption" tone="muted" style={styles.scoreHint}>
        Swipe up or tap for a point · swipe down to undo
      </AppText>
      <Button
        label="Switch sides"
        icon="swap-horizontal"
        variant="ghost"
        size="sm"
        onPress={onFlipSides}
        style={styles.centerButton}
      />
    </View>
  );
}

function TeamScorePad({
  name,
  value,
  side,
  accent,
  onMinus,
  onPlus,
  disabled,
}: {
  name: string;
  value: number;
  side: "left" | "right";
  accent: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled: boolean;
}) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  const flashLabel = useSharedValue(0);
  const [flashText, setFlashText] = useState<"+1" | "−1" | null>(null);
  const scale = useSharedValue(1);
  const actions = useRef({
    onPlus,
    onMinus,
    disabled,
    value,
    reduceMotion,
  });
  actions.current = { onPlus, onMinus, disabled, value, reduceMotion };

  function applyDelta(delta: 1 | -1) {
    const current = actions.current;
    if (current.disabled) return;
    if (delta < 0 && current.value <= 0) return;
    if (delta > 0) current.onPlus();
    else current.onMinus();
    setFlashText(delta > 0 ? "+1" : "−1");
    flashLabel.value = 1;
    flashLabel.value = withTiming(0, timingConfig(motion.layout));
    if (current.reduceMotion) return;
    scale.value = 1.06;
    scale.value = withTiming(1, timingConfig(motion.state));
  }

  const applyDeltaRef = useRef(applyDelta);
  applyDeltaRef.current = applyDelta;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim the touch so the parent ScreenScroll does not steal vertical
        // swipes while the scorekeeper is adjusting a pad.
        onStartShouldSetPanResponder: () => !actions.current.disabled,
        onMoveShouldSetPanResponder: () => !actions.current.disabled,
        onPanResponderGrant: () => setPressed(true),
        onPanResponderTerminate: () => setPressed(false),
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (_, gesture) => {
          setPressed(false);
          if (actions.current.disabled) return;
          const isTap =
            Math.abs(gesture.dx) < TAP_SLOP && Math.abs(gesture.dy) < TAP_SLOP;
          if (isTap || gesture.dy < -SWIPE_DISTANCE || gesture.vy < -SWIPE_VELOCITY) {
            applyDeltaRef.current(1);
            return;
          }
          if (gesture.dy > SWIPE_DISTANCE || gesture.vy > SWIPE_VELOCITY) {
            applyDeltaRef.current(-1);
          }
        },
      }),
    []
  );

  const scoreStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashLabel.value,
    transform: [{ translateY: (1 - flashLabel.value) * -10 }],
  }));

  const wash = pressed ? 0.22 : 0.14;
  const border = withAlpha(accent, pressed ? 0.55 : 0.35);

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={`${name}, ${side} side`}
      accessibilityValue={{ text: String(value) }}
      accessibilityHint="Adjustable. Increment to add a point, decrement to undo."
      accessibilityActions={[
        { name: "increment", label: "Add a point" },
        { name: "decrement", label: "Remove a point" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") applyDelta(1);
        if (event.nativeEvent.actionName === "decrement") applyDelta(-1);
      }}
      style={[
        styles.scorePad,
        {
          backgroundColor: withAlpha(accent, wash),
          borderColor: border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[styles.sideChip, { backgroundColor: withAlpha(accent, 0.22) }]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <AppText variant="caption" weight="700" style={{ color: accent }}>
          {side === "left" ? "L" : "R"}
        </AppText>
      </View>
      <AppText
        variant="subhead"
        weight="700"
        numberOfLines={2}
        style={[styles.centerText, { color: colors.foreground }]}
      >
        {name}
      </AppText>
      <View style={styles.scoreStage}>
        <Animated.View style={scoreStyle}>
          <AppText style={[styles.bigScore, { color: accent }]}>{value}</AppText>
        </Animated.View>
        {flashText ? (
          <Animated.View style={[styles.flashBadge, flashStyle]} pointerEvents="none">
            <AppText variant="headline" weight="700" style={{ color: accent }}>
              {flashText}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.padHints} accessibilityElementsHidden importantForAccessibility="no">
        <Icon name="chevron-up" size={16} color={accent} />
        <AppText variant="caption" style={{ color: accent }}>
          Point
        </AppText>
        <Icon name="chevron-down" size={16} color={accent} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xxl },
  flex: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  setsWon: { flex: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  centerCard: { alignItems: "center", paddingVertical: space.xl },
  centerText: { textAlign: "center" },
  centerButton: { alignSelf: "center" },
  actionGrid: { gap: space.sm },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  setLabel: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.sm },
  setScores: { flexDirection: "row", alignItems: "center", gap: space.xs },
  tabular: { fontVariant: ["tabular-nums"] },
  target: { width: 44, textAlign: "right" },
  saving: { flexDirection: "row", alignItems: "center", gap: space.xs },
  scorekeeper: { gap: space.md },
  scoreRow: { flexDirection: "row", gap: space.sm },
  scorePad: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: radius.lg,
    minHeight: 220,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.sm,
    alignItems: "center",
    gap: space.sm,
  },
  sideChip: {
    alignSelf: "flex-start",
    minWidth: 28,
    height: 22,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreStage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 96,
    width: "100%",
  },
  bigScore: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  flashBadge: {
    position: "absolute",
    top: 4,
    right: 8,
  },
  padHints: {
    alignItems: "center",
    gap: 2,
    paddingBottom: space.xxs,
  },
  scoreHint: { textAlign: "center" },
  crewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  crewText: { flex: 1, minWidth: 0, gap: space.xxs },
  crewActions: { gap: space.sm },
});
