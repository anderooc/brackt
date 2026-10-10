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
  TournamentHostBulkMatchesRequestContract,
  TournamentHostScheduleContract,
  TournamentHostScheduleGroupContract,
  TournamentHostScheduleMatchContract,
} from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  applyTournamentHostScheduleFill,
  bulkUpdateTournamentHostMatches,
  fetchTournamentHostSchedule,
  updateTournamentHostMatchCourt,
  updateTournamentHostMatchRef,
  updateTournamentHostMatchSchedule,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  ChipPicker,
  FormField,
  FormSubmitButton,
  FormTextInput,
} from "~/components/create-form";
import { formatCalendarDate, formatMatchTime } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  SegmentedControl,
  StatusBadge,
  SwitchRow,
  haptics,
  space,
} from "~/ui";

const DEFAULT_INTERVAL = "60";

function parseClockOnTournamentDate(
  tournamentDate: string,
  clock: string
): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return null;
  const [year, month, day] = tournamentDate.split("-").map(Number);
  // Device-local, matching the web host tools and every match-time display.
  return new Date(year, month - 1, day, hours, mins, 0, 0).toISOString();
}

function scheduledTimeToClock(iso: string | null): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  const hours = parsed.getHours().toString().padStart(2, "0");
  const mins = parsed.getMinutes().toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function earliestScheduledClock(
  matches: TournamentHostScheduleMatchContract[]
): string {
  let earliestMs = Number.POSITIVE_INFINITY;
  let clock = "09:00";
  for (const match of matches) {
    if (!match.scheduledTime || match.isBye) continue;
    const ms = new Date(match.scheduledTime).getTime();
    if (Number.isNaN(ms) || ms >= earliestMs) continue;
    earliestMs = ms;
    clock = scheduledTimeToClock(match.scheduledTime);
  }
  return clock;
}

export default function TournamentHostScheduleScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [schedule, setSchedule] = useState<TournamentHostScheduleContract | null>(
    null
  );
  const [groupId, setGroupId] = useState("");
  const [firstStart, setFirstStart] = useState("09:00");
  const [intervalText, setIntervalText] = useState(DEFAULT_INTERVAL);
  const [overwrite, setOverwrite] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [matchClocks, setMatchClocks] = useState<Record<string, string>>({});
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostSchedule(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load schedule."
  );

  useEffect(() => {
    if (!data) return;
    setSchedule(data.schedule);
    if (!groupId && data.schedule.groups[0]) {
      setGroupId(data.schedule.groups[0].id);
    }
  }, [data, groupId]);

  const groups = schedule?.groups ?? [];
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === groupId) ?? groups[0] ?? null,
    [groupId, groups]
  );

  useEffect(() => {
    if (!selectedGroup || !schedule) return;
    setFirstStart(earliestScheduledClock(selectedGroup.matches));
    const clocks: Record<string, string> = {};
    for (const match of selectedGroup.matches) {
      clocks[match.id] = scheduledTimeToClock(match.scheduledTime);
    }
    setMatchClocks(clocks);
  }, [schedule, selectedGroup?.id]);

  const groupLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const group of groups) {
      const label = group.label.replace(/^(pool\b.*) pools$/i, "$1");
      labels[group.id] = `${label} (${group.scheduledCount}/${group.totalCount})`;
    }
    return labels;
  }, [groups]);

  const runAction = useCallback(
    async <T,>(key: string, action: () => Promise<T>): Promise<T | null> => {
      setBusyKey(key);
      setActionError(null);
      try {
        const result = await action();
        haptics.success();
        return result;
      } catch (cause) {
        setActionError(messageFor(cause, "Could not update schedule."));
        haptics.error();
        return null;
      } finally {
        setBusyKey(null);
      }
    },
    []
  );

  const onApplyFill = useCallback(async () => {
    if (!slug || !schedule || !selectedGroup || !schedule.canSchedule) return;
    const firstStartIso = parseClockOnTournamentDate(schedule.date, firstStart);
    if (!firstStartIso) {
      setActionError("Enter a valid first start time (HH:MM).");
      return;
    }
    const intervalMinutes = Number(intervalText);
    if (!Number.isFinite(intervalMinutes) || intervalMinutes < 5) {
      setActionError("Interval must be at least 5 minutes.");
      return;
    }

    const result = await runAction("fill", () =>
      applyTournamentHostScheduleFill(slug, {
        scope: selectedGroup.scope,
        firstStartIso,
        intervalMinutes,
        overwrite,
      })
    );
    if (result) {
      setSchedule(result.schedule);
    }
  }, [
    firstStart,
    intervalText,
    overwrite,
    runAction,
    schedule,
    selectedGroup,
    slug,
  ]);

  const onSaveMatchTime = useCallback(
    async (match: TournamentHostScheduleMatchContract) => {
      if (!slug || !schedule?.canSchedule || match.isBye) return;
      const clock = matchClocks[match.id] ?? "";
      const scheduledTime =
        clock.trim() === ""
          ? null
          : parseClockOnTournamentDate(schedule.date, clock);
      if (clock.trim() !== "" && !scheduledTime) {
        setActionError("Enter a valid time (HH:MM) or leave blank to clear.");
        return;
      }

      const result = await runAction(`match-${match.id}`, () =>
        updateTournamentHostMatchSchedule(slug, match.id, scheduledTime)
      );
      if (result) setSchedule(result.schedule);
    },
    [matchClocks, runAction, schedule, slug]
  );

  const onAssignRef = useCallback(
    async (match: TournamentHostScheduleMatchContract, refTeamId: string | null) => {
      if (!slug || match.isBye) return;
      const result = await runAction(`ref-${match.id}`, () =>
        updateTournamentHostMatchRef(slug, match.id, refTeamId)
      );
      if (result) setSchedule(result.schedule);
    },
    [runAction, slug]
  );

  const onAssignCourt = useCallback(
    async (match: TournamentHostScheduleMatchContract, courtId: string | null) => {
      if (!slug || !match.canAssignCourt) return;
      const result = await runAction(`court-${match.id}`, () =>
        updateTournamentHostMatchCourt(slug, match.id, courtId)
      );
      if (result) setSchedule(result.schedule);
    },
    [runAction, slug]
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <ErrorScreen
        title="Missing tournament"
        message="This link is missing the tournament. Go back and open it again."
      />
    );
  }
  if (error && !schedule) {
    return (
      <ErrorScreen
        title="Schedule unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );
  }
  if (!schedule) return <LoadingScreen />;

  function confirmApplyFill() {
    if (!overwrite) {
      void onApplyFill();
      return;
    }
    Alert.alert(
      "Overwrite existing times?",
      `Every unlocked match in ${selectedGroup?.label ?? "this group"} gets a new start time.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Overwrite", style: "destructive", onPress: () => void onApplyFill() },
      ]
    );
  }

  function confirmBulk(
    body: TournamentHostBulkMatchesRequestContract,
    confirm: { title: string; message: string; destructive?: boolean }
  ) {
    Alert.alert(confirm.title, confirm.message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Apply",
        style: confirm.destructive ? "destructive" : "default",
        onPress: () => void onBulk(body),
      },
    ]);
  }

  async function onBulk(body: TournamentHostBulkMatchesRequestContract) {
    if (!slug) return;
    setBulkMessage(null);
    const result = await runAction("bulk", () =>
      bulkUpdateTournamentHostMatches(slug, body)
    );
    if (result) {
      setSchedule(result.schedule);
      setBulkMessage(result.message);
    }
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <ListGroup>
        <ListRow
          icon="calendar-outline"
          title={formatCalendarDate(schedule.date)}
          subtitle={schedule.canSchedule ? "Tournament day" : "Tournament day · view only"}
        />
        <ListRow
          icon="eye-outline"
          title="View public matches"
          subtitle="What teams see"
          onPress={() => router.push(`/tournament/${slug}?tab=matches`)}
        />
      </ListGroup>

      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {groups.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No matches to schedule yet"
          message="Release pools or generate brackets first, then set match times here."
        />
      ) : (
        <>
          <Section
            title="Pool or bracket"
            description="Each pool and bracket is timed on its own. Pick one to set its match times. The numbers show how many matches have a time."
          >
            <ChipPicker
              options={groups.map((group) => group.id)}
              value={selectedGroup?.id ?? ""}
              onChange={setGroupId}
              colors={colors}
              labels={groupLabels}
            />
          </Section>

          {selectedGroup && schedule.canSchedule ? (
            <BulkFillSection
              firstStart={firstStart}
              intervalText={intervalText}
              overwrite={overwrite}
              busy={busyKey === "fill"}
              onFirstStartChange={setFirstStart}
              onIntervalChange={setIntervalText}
              onOverwriteChange={setOverwrite}
              onApply={confirmApplyFill}
            />
          ) : null}

          {selectedGroup && schedule.canSchedule ? (
            <GameDayAdjustSection
              schedule={schedule}
              group={selectedGroup}
              busy={busyKey === "bulk"}
              onRun={confirmBulk}
            />
          ) : null}

          {bulkMessage ? (
            <Banner
              tone="success"
              message={bulkMessage}
              onDismiss={() => setBulkMessage(null)}
            />
          ) : null}

          {selectedGroup ? (
            <MatchListSection
              group={selectedGroup}
              courts={schedule.courts}
              canSchedule={schedule.canSchedule}
              matchClocks={matchClocks}
              busyKey={busyKey}
              onClockChange={(matchId, clock) =>
                setMatchClocks((current) => ({ ...current, [matchId]: clock }))
              }
              onSave={(match) => void onSaveMatchTime(match)}
              onAssignRef={(match, refTeamId) => void onAssignRef(match, refTeamId)}
              onAssignCourt={(match, courtId) => void onAssignCourt(match, courtId)}
            />
          ) : null}
        </>
      )}
    </ScreenScroll>
  );
}

function BulkFillSection({
  firstStart,
  intervalText,
  overwrite,
  busy,
  onFirstStartChange,
  onIntervalChange,
  onOverwriteChange,
  onApply,
}: {
  firstStart: string;
  intervalText: string;
  overwrite: boolean;
  busy: boolean;
  onFirstStartChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onOverwriteChange: (value: boolean) => void;
  onApply: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Section
      title="Fill times automatically"
      description="Assigns start times in waves at a fixed interval. Live and final matches are skipped."
    >
      <Card>
        <View style={styles.fillRow}>
          <View style={styles.flex}>
            <FormField label="First start" hint="24-hour, e.g. 09:00" colors={colors}>
              <FormTextInput
                value={firstStart}
                onChangeText={onFirstStartChange}
                placeholder="09:00"
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                colors={colors}
              />
            </FormField>
          </View>
          <View style={styles.flex}>
            <FormField label="Every (minutes)" colors={colors}>
              <FormTextInput
                value={intervalText}
                onChangeText={onIntervalChange}
                placeholder="60"
                keyboardType="number-pad"
                colors={colors}
              />
            </FormField>
          </View>
        </View>
      </Card>
      <ListGroup>
        <SwitchRow
          label="Overwrite existing times"
          description="When off, only matches without a time are filled."
          value={overwrite}
          onValueChange={onOverwriteChange}
        />
      </ListGroup>
      <FormSubmitButton label="Apply times" busy={busy} onPress={onApply} />
    </Section>
  );
}

type AdjustMode = "delay" | "move" | "clear";
const SHIFT_OPTIONS = [-15, 10, 15, 30, 60] as const;
const ALL_GROUP = "__group__";

function isAdjustable(match: TournamentHostScheduleMatchContract): boolean {
  return !match.isBye && match.status !== "completed" && match.status !== "in_progress";
}

function GameDayAdjustSection({
  schedule,
  group,
  busy,
  onRun,
}: {
  schedule: TournamentHostScheduleContract;
  group: TournamentHostScheduleGroupContract;
  busy: boolean;
  onRun: (
    body: TournamentHostBulkMatchesRequestContract,
    confirm: { title: string; message: string; destructive?: boolean }
  ) => void;
}) {
  const [mode, setMode] = useState<AdjustMode>("delay");
  const [delayScope, setDelayScope] = useState<string>(ALL_GROUP);
  const [minutes, setMinutes] = useState<number>(15);
  const [fromCourt, setFromCourt] = useState<string | null>(null);
  const [toCourt, setToCourt] = useState<string | null>(null);

  const allMatches = useMemo(
    () => schedule.groups.flatMap((item) => item.matches),
    [schedule.groups]
  );
  const groupTimed = group.matches.filter(
    (match) => isAdjustable(match) && match.scheduledTime
  );
  const courtTimed = (courtId: string) =>
    allMatches.filter(
      (match) => isAdjustable(match) && match.scheduledTime && match.courtId === courtId
    );
  const moveTargets = fromCourt
    ? allMatches.filter(
        (match) => isAdjustable(match) && match.canAssignCourt && match.courtId === fromCourt
      )
    : [];
  const groupClearable = group.matches.filter(
    (match) => isAdjustable(match) && (match.scheduledTime || match.courtId)
  );

  const delayCount =
    delayScope === ALL_GROUP ? groupTimed.length : courtTimed(delayScope).length;
  const courtName = (id: string | null) =>
    schedule.courts.find((court) => court.id === id)?.name ?? "court";
  const minutesLabel = minutes > 0 ? `+${minutes} min` : `${minutes} min`;

  return (
    <Section
      title="Game-day adjustments"
      description="Change many matches at once when play runs late or a court goes down. Live and final matches are never touched."
    >
      <SegmentedControl
        options={[
          { id: "delay", label: "Delay" },
          { id: "move", label: "Move court" },
          { id: "clear", label: "Clear" },
        ]}
        value={mode}
        onChange={setMode}
        accessibilityLabel="Adjustment type"
      />
      <Card>
        {mode === "delay" ? (
          <View style={styles.adjust}>
            <AppText variant="footnote" weight="600">
              Which matches
            </AppText>
            <ChipRow>
              <Chip
                label={group.label.replace(/^(pool\b.*) pools$/i, "$1")}
                selected={delayScope === ALL_GROUP}
                onPress={() => setDelayScope(ALL_GROUP)}
              />
              {schedule.courts.map((court) => (
                <Chip
                  key={court.id}
                  label={`${court.name} (all)`}
                  selected={delayScope === court.id}
                  onPress={() => setDelayScope(court.id)}
                />
              ))}
            </ChipRow>
            <AppText variant="footnote" weight="600">
              Shift by
            </AppText>
            <ChipRow>
              {SHIFT_OPTIONS.map((value) => (
                <Chip
                  key={value}
                  label={value > 0 ? `+${value} min` : `${value} min`}
                  selected={minutes === value}
                  onPress={() => setMinutes(value)}
                />
              ))}
            </ChipRow>
            <Button
              label={`Shift ${plural(delayCount, "match", "matches")} ${minutesLabel}`}
              loading={busy}
              disabled={delayCount === 0}
              onPress={() =>
                onRun(
                  delayScope === ALL_GROUP
                    ? {
                        action: "shift_time",
                        minutes,
                        matchIds: groupTimed.map((match) => match.id),
                      }
                    : { action: "shift_time", minutes, courtId: delayScope },
                  {
                    title: `Shift ${plural(delayCount, "match", "matches")}?`,
                    message: `Start times move ${minutesLabel}. Matches that would collide with another match on the same court are skipped.`,
                  }
                )
              }
            />
          </View>
        ) : null}

        {mode === "move" ? (
          schedule.courts.length < 2 ? (
            <AppText variant="subhead" tone="muted">
              Add a second court in setup to move matches between courts.
            </AppText>
          ) : (
            <View style={styles.adjust}>
              <AppText variant="footnote" weight="600">
                From
              </AppText>
              <ChipRow>
                {schedule.courts.map((court) => (
                  <Chip
                    key={court.id}
                    label={court.name}
                    selected={fromCourt === court.id}
                    onPress={() => {
                      setFromCourt(court.id);
                      if (toCourt === court.id) setToCourt(null);
                    }}
                  />
                ))}
              </ChipRow>
              <AppText variant="footnote" weight="600">
                To
              </AppText>
              <ChipRow>
                {schedule.courts
                  .filter((court) => court.id !== fromCourt)
                  .map((court) => (
                    <Chip
                      key={court.id}
                      label={court.name}
                      selected={toCourt === court.id}
                      onPress={() => setToCourt(court.id)}
                    />
                  ))}
              </ChipRow>
              <Button
                label={`Move ${plural(moveTargets.length, "match", "matches")}`}
                loading={busy}
                disabled={!fromCourt || !toCourt || moveTargets.length === 0}
                onPress={() =>
                  onRun(
                    {
                      action: "reassign_court",
                      courtId: toCourt,
                      matchIds: moveTargets.map((match) => match.id),
                    },
                    {
                      title: `Move to ${courtName(toCourt)}?`,
                      message: `${plural(moveTargets.length, "upcoming match", "upcoming matches")} on ${courtName(fromCourt)} move to ${courtName(toCourt)}, keeping their times. Any that would overlap are skipped.`,
                    }
                  )
                }
              />
            </View>
          )
        ) : null}

        {mode === "clear" ? (
          <View style={styles.adjust}>
            <AppText variant="subhead" tone="muted">
              Remove start times and courts from every upcoming match in{" "}
              {group.label.replace(/^(pool\b.*) pools$/i, "$1")}, so you can re-plan it
              with auto-fill.
            </AppText>
            <Button
              label={`Clear ${plural(groupClearable.length, "match", "matches")}`}
              variant="destructiveOutline"
              loading={busy}
              disabled={groupClearable.length === 0}
              onPress={() =>
                onRun(
                  {
                    action: "clear_schedule",
                    matchIds: groupClearable.map((match) => match.id),
                    clearTime: true,
                    clearCourt: true,
                  },
                  {
                    title: "Clear times and courts?",
                    message: `${plural(groupClearable.length, "match", "matches")} lose their start time and court.`,
                    destructive: true,
                  }
                )
              }
            />
          </View>
        ) : null}
      </Card>
    </Section>
  );
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function MatchListSection({
  group,
  courts,
  canSchedule,
  matchClocks,
  busyKey,
  onClockChange,
  onSave,
  onAssignRef,
  onAssignCourt,
}: {
  group: TournamentHostScheduleGroupContract;
  courts: { id: string; name: string }[];
  canSchedule: boolean;
  matchClocks: Record<string, string>;
  busyKey: string | null;
  onClockChange: (matchId: string, clock: string) => void;
  onSave: (match: TournamentHostScheduleMatchContract) => void;
  onAssignRef: (match: TournamentHostScheduleMatchContract, refTeamId: string | null) => void;
  onAssignCourt: (match: TournamentHostScheduleMatchContract, courtId: string | null) => void;
}) {
  const colors = useThemeColors();
  const playable = group.matches.filter((match) => !match.isBye);

  return (
    <Section
      title="Matches"
      description={`${group.scheduledCount} of ${group.totalCount} have a start time.`}
    >
      {playable.length === 0 ? (
        <AppText variant="subhead" tone="muted">
          No playable matches in this group.
        </AppText>
      ) : (
        playable.map((match) => {
          const timeBusy = busyKey === `match-${match.id}`;
          const refBusy = busyKey === `ref-${match.id}`;
          const courtBusy = busyKey === `court-${match.id}`;
          const locked = match.status === "completed" || match.status === "in_progress";
          const savedClock = scheduledTimeToClock(match.scheduledTime);
          const clock = matchClocks[match.id] ?? "";
          const details = [
            match.groupName,
            match.scheduledTime ? formatMatchTime(match.scheduledTime) : "No time yet",
            match.courtName,
            match.refTeamName ? `Reffing: ${match.refTeamName}` : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <Card key={match.id}>
              <View style={styles.matchHeader}>
                <AppText variant="callout" weight="600" style={styles.flex}>
                  {match.label}
                </AppText>
                <StatusBadge kind="match" status={match.status} />
              </View>
              <AppText variant="footnote" tone="muted">
                {details}
              </AppText>

              {locked ? (
                match.status === "in_progress" && canSchedule ? (
                  <AppText variant="footnote" tone="muted">
                    Time and assignments are locked while the match is live.
                  </AppText>
                ) : null
              ) : (
                <>
                  {canSchedule ? (
                    <View style={styles.timeRow}>
                      <View style={styles.flex}>
                        <FormTextInput
                          value={clock}
                          onChangeText={(value) => onClockChange(match.id, value)}
                          placeholder="HH:MM"
                          accessibilityLabel={`Start time for ${match.label}`}
                          keyboardType="numbers-and-punctuation"
                          autoCapitalize="none"
                          returnKeyType="done"
                          onSubmitEditing={() => onSave(match)}
                          colors={colors}
                        />
                      </View>
                      <Button
                        label="Save time"
                        variant="outline"
                        size="sm"
                        loading={timeBusy}
                        disabled={clock === savedClock}
                        onPress={() => onSave(match)}
                      />
                    </View>
                  ) : null}

                  {match.refOptions.length > 0 ? (
                    <View style={styles.assign}>
                      <AppText variant="footnote" weight="600">
                        Reffing team
                      </AppText>
                      <ChipRow>
                        <Chip
                          label="None"
                          selected={match.refTeamId === null}
                          disabled={refBusy}
                          onPress={() => onAssignRef(match, null)}
                        />
                        {match.refOptions.map((option) => (
                          <Chip
                            key={option.id}
                            label={option.name}
                            selected={match.refTeamId === option.id}
                            disabled={refBusy}
                            onPress={() => onAssignRef(match, option.id)}
                          />
                        ))}
                      </ChipRow>
                    </View>
                  ) : null}

                  {match.canAssignCourt && courts.length > 0 ? (
                    <View style={styles.assign}>
                      <AppText variant="footnote" weight="600">
                        Court{courtBusy ? "  ·  Saving…" : ""}
                      </AppText>
                      <ChipRow>
                        <Chip
                          label="No court"
                          selected={!match.courtId}
                          disabled={courtBusy}
                          onPress={() => onAssignCourt(match, null)}
                        />
                        {courts.map((court) => (
                          <Chip
                            key={court.id}
                            label={court.name}
                            selected={match.courtId === court.id}
                            disabled={courtBusy}
                            onPress={() => onAssignCourt(match, court.id)}
                          />
                        ))}
                      </ChipRow>
                    </View>
                  ) : null}
                </>
              )}
            </Card>
          );
        })
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fillRow: { flexDirection: "row", gap: space.md },
  matchHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  timeRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  assign: { gap: space.sm, marginTop: space.xs },
  adjust: { gap: space.sm },
});
