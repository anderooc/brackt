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
  TournamentHostRegistrationContract,
  TournamentHostRegistrationsContract,
} from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useNavigation } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import {
  checkInTournamentHostRegistrations,
  bulkAssignTournamentHostRegistrations,
  confirmTournamentHostRegistrations,
  downloadRegistrationsCsv,
  fetchTournamentHostRegistrations,
  promoteTournamentHostWaitlist,
  removeTournamentHostRegistrations,
  removeTournamentHostWaitlistEntry,
  updateTournamentHostRegistration,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { formatFeeCents, paymentStatusLabel } from "~/lib/format";
import { shareDownloadedFile } from "~/lib/share-pdf";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  HIT_TARGET,
  HeaderButton,
  Icon,
  ScreenScroll,
  SegmentedControl,
  StatusBadge,
  Tappable,
  haptics,
  radius,
  space,
} from "~/ui";

type TabId = "checkin" | "pending" | "teams" | "waitlist";
type CheckInFilter = "all" | "ready" | "checked_in" | "blocked";
type RegistrationsResult = { registrations: TournamentHostRegistrationsContract };

function matchesSearch(row: TournamentHostRegistrationContract, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    row.teamName.toLowerCase().includes(needle) ||
    (row.schoolName?.toLowerCase().includes(needle) ?? false) ||
    (row.divisionName?.toLowerCase().includes(needle) ?? false)
  );
}

function poolLabel(divisionName: string | null) {
  if (!divisionName) return null;
  return /^pool\b/i.test(divisionName) ? divisionName : `Pool ${divisionName}`;
}

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function TournamentHostRegistrationsScreen() {
  const navigation = useNavigation();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug, tab: tabParam } = useLocalSearchParams<{
    slug: string;
    tab?: string;
  }>();
  const [tab, setTab] = useState<TabId>("pending");
  const [registrations, setRegistrations] =
    useState<TournamentHostRegistrationsContract | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const promoteOperationId = useRef<string | null>(null);
  const initialTabSet = useRef(false);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostRegistrations(slug ?? "", signal),
    [slug]
  );
  const { data, error, refreshError, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load registrations."
  );

  useEffect(() => {
    if (data) setRegistrations(data.registrations);
  }, [data]);

  const [exporting, setExporting] = useState(false);
  const exportCsv = useCallback(async () => {
    if (!slug) return;
    setExporting(true);
    try {
      await shareDownloadedFile(
        () => downloadRegistrationsCsv(slug),
        `${slug}-registrations.csv`,
        "csv"
      );
    } catch (cause) {
      Alert.alert("Couldn't export", messageFor(cause, "Could not export registrations."));
    } finally {
      setExporting(false);
    }
  }, [slug]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: registrations
        ? () => (
            <HeaderButton
              label={exporting ? "Exporting…" : "Export"}
              accessibilityLabel="Export registrations as CSV"
              disabled={exporting}
              onPress={() => void exportCsv()}
            />
          )
        : undefined,
    });
  }, [navigation, registrations, exporting, exportCsv]);

  useEffect(() => {
    if (!registrations || initialTabSet.current) return;
    initialTabSet.current = true;
    if (registrations.canCheckIn && (tabParam === "checkin" || !tabParam)) {
      setTab("checkin");
    } else if (!registrations.registrations.some((row) => row.status === "pending")) {
      setTab("teams");
    }
  }, [registrations, tabParam]);

  const pending = useMemo(
    () => registrations?.registrations.filter((row) => row.status === "pending") ?? [],
    [registrations]
  );
  const teams = useMemo(
    () =>
      registrations?.registrations.filter(
        (row) => row.status === "confirmed" || row.status === "checked_in"
      ) ?? [],
    [registrations]
  );
  const readyToCheckIn = useMemo(
    () =>
      teams.filter(
        (row) => row.status === "confirmed" && !(row.waiver?.blocksCheckIn ?? false)
      ),
    [teams]
  );

  const runAction = useCallback(
    async (id: string, action: () => Promise<RegistrationsResult>) => {
      setBusyId(id);
      setActionError(null);
      try {
        const result = await action();
        setRegistrations(result.registrations);
        haptics.success();
      } catch (cause) {
        setActionError(messageFor(cause, "Could not update registration."));
        haptics.error();
      } finally {
        setBusyId(null);
      }
    },
    []
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
  if (error && !registrations) {
    return (
      <ErrorScreen
        title="Registrations unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );
  }
  if (!registrations) return <LoadingScreen rows={5} />;

  const locked = !registrations.canManage;
  const activeTab = tab === "checkin" && !registrations.canCheckIn ? "pending" : tab;
  const tabs = [
    ...(registrations.canCheckIn
      ? [{ id: "checkin" as const, label: "Check-in", count: readyToCheckIn.length }]
      : []),
    { id: "pending" as const, label: "Pending", count: pending.length },
    { id: "teams" as const, label: "Teams", count: teams.length },
    { id: "waitlist" as const, label: "Waitlist", count: registrations.waitlist.length },
  ];

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <SegmentedControl
        options={tabs}
        value={activeTab}
        onChange={setTab}
        accessibilityLabel="Registration views"
      />

      {locked ? (
        <Banner
          tone="info"
          message="Registrations are read-only at this stage of the tournament."
        />
      ) : null}
      {refreshError ? <Banner tone="warning" message={refreshError} /> : null}
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {activeTab === "checkin" ? (
        <CheckInTab
          rows={teams}
          readyCount={readyToCheckIn.length}
          waiverRequired={registrations.waiverRequiredBeforeCheckIn}
          showWaiver={registrations.waiverEnabled}
          busyId={busyId}
          onCheckIn={(id) =>
            void runAction(id, () =>
              updateTournamentHostRegistration(slug, id, { status: "checked_in" })
            )
          }
          onUndoCheckIn={(id, teamName) =>
            Alert.alert("Undo check-in?", `${teamName} will be marked as not checked in.`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Undo check-in",
                style: "destructive",
                onPress: () =>
                  void runAction(id, () =>
                    updateTournamentHostRegistration(slug, id, { status: "confirmed" })
                  ),
              },
            ])
          }
          onCheckInAll={() => {
            const ids = readyToCheckIn.map((row) => row.id);
            if (ids.length === 0) return;
            Alert.alert(
              "Check in all ready teams?",
              `${plural(ids.length, "team")} will be checked in.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Check in all",
                  onPress: () =>
                    void runAction("bulk-checkin", () =>
                      checkInTournamentHostRegistrations(slug, ids)
                    ),
                },
              ]
            );
          }}
        />
      ) : null}

      {activeTab === "pending" ? (
        <PendingTab
          rows={pending}
          locked={locked}
          busyId={busyId}
          showPayment={registrations.paymentEnabled}
          showWaiver={registrations.waiverEnabled}
          onConfirm={(id) =>
            void runAction(id, () => confirmTournamentHostRegistrations(slug, [id]))
          }
          onReject={(id, teamName) =>
            Alert.alert(
              "Reject registration?",
              `${teamName} will be removed from the tournament.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Reject",
                  style: "destructive",
                  onPress: () =>
                    void runAction(id, () => removeTournamentHostRegistrations(slug, [id])),
                },
              ]
            )
          }
        />
      ) : null}

      {activeTab === "teams" ? (
        <TeamsTab
          rows={teams}
          divisions={registrations.divisions}
          locked={locked}
          busyId={busyId}
          showPayment={registrations.paymentEnabled}
          showWaiver={registrations.waiverEnabled}
          onAssignDivision={(id, divisionId) =>
            void runAction(id, () =>
              updateTournamentHostRegistration(slug, id, { divisionId })
            )
          }
          onBulkAssignDivision={(ids, divisionId) =>
            runAction("bulk", () =>
              bulkAssignTournamentHostRegistrations(slug, ids, divisionId)
            )
          }
        />
      ) : null}

      {activeTab === "waitlist" ? (
        <WaitlistTab
          rows={registrations.waitlist}
          locked={locked}
          busyId={busyId}
          onPromote={() => {
            if (!promoteOperationId.current) {
              promoteOperationId.current = Crypto.randomUUID();
            }
            const operationId = promoteOperationId.current;
            void runAction("promote", () =>
              promoteTournamentHostWaitlist(slug, operationId).then((result) => {
                promoteOperationId.current = null;
                return result;
              })
            );
          }}
          onRemove={(id, teamName) =>
            Alert.alert("Remove from waitlist?", `${teamName} will lose its place in line.`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: () =>
                  void runAction(id, () => removeTournamentHostWaitlistEntry(slug, id)),
              },
            ])
          }
        />
      ) : null}
    </ScreenScroll>
  );
}

function PendingTab({
  rows,
  locked,
  busyId,
  showPayment,
  showWaiver,
  onConfirm,
  onReject,
}: {
  rows: TournamentHostRegistrationContract[];
  locked: boolean;
  busyId: string | null;
  showPayment: boolean;
  showWaiver: boolean;
  onConfirm: (id: string) => void;
  onReject: (id: string, teamName: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="mail-unread-outline"
        title="No pending registrations"
        message="New registrations that need your approval show up here."
      />
    );
  }

  return (
    <View style={styles.list}>
      {rows.map((row) => {
        const busy = busyId === row.id;
        const paymentBlocks = row.payment?.blocksConfirm ?? false;
        return (
          <RegistrationCard
            key={row.id}
            row={row}
            showPayment={showPayment}
            showWaiver={showWaiver}
            footer={
              locked ? null : (
                <>
                  {paymentBlocks ? (
                    <AppText variant="footnote" tone="warning">
                      Payment must be received before confirming.
                    </AppText>
                  ) : null}
                  <View style={styles.actions}>
                    <Button
                      label="Confirm"
                      size="sm"
                      icon="checkmark"
                      loading={busy}
                      disabled={paymentBlocks || (busyId !== null && !busy)}
                      onPress={() => onConfirm(row.id)}
                      style={styles.flex}
                    />
                    <Button
                      label="Reject"
                      size="sm"
                      variant="destructiveOutline"
                      disabled={busyId !== null}
                      onPress={() => onReject(row.id, row.teamName)}
                      style={styles.flex}
                    />
                  </View>
                </>
              )
            }
          />
        );
      })}
    </View>
  );
}

function TeamsTab({
  rows,
  divisions,
  locked,
  busyId,
  showPayment,
  showWaiver,
  onAssignDivision,
  onBulkAssignDivision,
}: {
  rows: TournamentHostRegistrationContract[];
  divisions: TournamentHostRegistrationsContract["divisions"];
  locked: boolean;
  busyId: string | null;
  showPayment: boolean;
  showWaiver: boolean;
  onAssignDivision: (id: string, divisionId: string | null) => void;
  onBulkAssignDivision: (ids: string[], divisionId: string | null) => Promise<void>;
}) {
  const canAssign = divisions.length > 0 && !locked;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const liveSelectedIds = useMemo(
    () => rows.map((row) => row.id).filter((id) => selectedIds.has(id)),
    [rows, selectedIds]
  );
  const selectedCount = liveSelectedIds.length;
  const allSelected = selectedCount > 0 && selectedCount === rows.length;

  const toggleRowSelected = useCallback((regId: string) => {
    haptics.selection();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  }, []);

  const bulkAssign = useCallback(
    async (divisionId: string | null) => {
      await onBulkAssignDivision(liveSelectedIds, divisionId);
      setSelectedIds(new Set());
    },
    [liveSelectedIds, onBulkAssignDivision]
  );

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No confirmed teams yet"
        message="Teams appear here once you confirm their registration."
      />
    );
  }

  const bulkBusy = busyId === "bulk";

  return (
    <View style={styles.list}>
      {canAssign ? (
        <Card>
          <View style={styles.bulkHeader}>
            <AppText variant="subhead" weight="600" style={styles.flex}>
              {selectedCount > 0 ? `${selectedCount} selected` : "Assign pools in bulk"}
            </AppText>
            <Button
              label={allSelected ? "Clear" : "Select all"}
              variant="ghost"
              size="sm"
              onPress={() =>
                setSelectedIds(allSelected ? new Set() : new Set(rows.map((row) => row.id)))
              }
            />
          </View>
          {selectedCount > 0 ? (
            <ChipRow>
              <Chip
                label="Unassigned"
                disabled={bulkBusy}
                onPress={() => void bulkAssign(null)}
              />
              {divisions.map((division) => (
                <Chip
                  key={division.id}
                  label={division.name}
                  disabled={bulkBusy}
                  onPress={() => void bulkAssign(division.id)}
                />
              ))}
            </ChipRow>
          ) : (
            <AppText variant="footnote" tone="muted">
              Select teams below, then pick a pool to move them all at once.
            </AppText>
          )}
        </Card>
      ) : null}

      {rows.map((row) => {
        const selected = selectedIds.has(row.id);
        const rowBusy = busyId === row.id;
        return (
          <RegistrationCard
            key={row.id}
            row={row}
            showPayment={showPayment}
            showWaiver={showWaiver}
            leading={
              canAssign ? (
                <SelectBox
                  checked={selected}
                  label={row.teamName}
                  onPress={() => toggleRowSelected(row.id)}
                />
              ) : null
            }
            footer={
              canAssign ? (
                <View style={styles.assign}>
                  <AppText variant="footnote" weight="600">
                    Pool{rowBusy ? "  ·  Saving…" : ""}
                  </AppText>
                  <ChipRow>
                    <Chip
                      label="Unassigned"
                      selected={!row.divisionId}
                      disabled={rowBusy}
                      onPress={() => onAssignDivision(row.id, null)}
                    />
                    {divisions.map((division) => (
                      <Chip
                        key={division.id}
                        label={division.name}
                        selected={row.divisionId === division.id}
                        disabled={rowBusy}
                        onPress={() => onAssignDivision(row.id, division.id)}
                      />
                    ))}
                  </ChipRow>
                </View>
              ) : null
            }
          />
        );
      })}
    </View>
  );
}

function SelectBox({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Tappable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`Select ${label}`}
      onPress={onPress}
      hitSlop={10}
      style={styles.selectHit}
    >
      <View
        style={[
          styles.selectBox,
          {
            borderColor: checked ? colors.primary : colors.border,
            backgroundColor: checked ? colors.primary : "transparent",
          },
        ]}
      >
        {checked ? <Icon name="checkmark" size={16} color={colors.primaryForeground} /> : null}
      </View>
    </Tappable>
  );
}

function CheckInTab({
  rows,
  readyCount,
  waiverRequired,
  showWaiver,
  busyId,
  onCheckIn,
  onUndoCheckIn,
  onCheckInAll,
}: {
  rows: TournamentHostRegistrationContract[];
  readyCount: number;
  waiverRequired: boolean;
  showWaiver: boolean;
  busyId: string | null;
  onCheckIn: (id: string) => void;
  onUndoCheckIn: (id: string, teamName: string) => void;
  onCheckInAll: () => void;
}) {
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CheckInFilter>("all");

  const checkedInCount = rows.filter((row) => row.status === "checked_in").length;
  const blockedCount = rows.filter((row) => row.waiver?.blocksCheckIn ?? false).length;
  const progress = rows.length === 0 ? 0 : Math.round((checkedInCount / rows.length) * 100);

  const filtered = useMemo(() => {
    return rows
      .filter((row) => matchesSearch(row, query))
      .filter((row) => {
        if (filter === "ready") {
          return row.status === "confirmed" && !(row.waiver?.blocksCheckIn ?? false);
        }
        if (filter === "checked_in") return row.status === "checked_in";
        if (filter === "blocked") return row.waiver?.blocksCheckIn ?? false;
        return true;
      })
      .sort((a, b) => {
        if (a.status === b.status) return a.teamName.localeCompare(b.teamName);
        if (a.status === "checked_in") return 1;
        if (b.status === "checked_in") return -1;
        return a.teamName.localeCompare(b.teamName);
      });
  }, [filter, query, rows]);

  if (rows.length === 0) {
    return (
      <EmptyState
        icon="checkbox-outline"
        title="No teams to check in yet"
        message="Confirmed teams show up here on tournament day."
      />
    );
  }

  const filters: { id: CheckInFilter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "ready", label: "Ready", count: readyCount },
    { id: "checked_in", label: "Checked in", count: checkedInCount },
    ...(blockedCount > 0
      ? [{ id: "blocked" as const, label: "Blocked", count: blockedCount }]
      : []),
  ];

  return (
    <View style={styles.list}>
      <Card>
        <AppText variant="headline">
          {checkedInCount} of {plural(rows.length, "team")} checked in
        </AppText>
        <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: colors.primary, width: `${progress}%` },
            ]}
          />
        </View>
        {waiverRequired && showWaiver ? (
          <AppText variant="footnote" tone="muted">
            Teams need a complete waiver before they can check in.
          </AppText>
        ) : null}
        <Button
          label={readyCount > 0 ? `Check in all ready (${readyCount})` : "Everyone ready is checked in"}
          icon={readyCount > 0 ? "checkmark-done" : undefined}
          loading={busyId === "bulk-checkin"}
          disabled={readyCount === 0 || (busyId !== null && busyId !== "bulk-checkin")}
          onPress={onCheckInAll}
          fullWidth
        />
      </Card>

      <View style={[styles.search, { backgroundColor: colors.muted }]}>
        <Icon name="search" size={18} tone="muted" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search teams, schools, pools"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search teams"
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      <ChipRow>
        {filters.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            count={option.count}
            selected={filter === option.id}
            onPress={() => setFilter(option.id)}
          />
        ))}
      </ChipRow>

      {filtered.length === 0 ? (
        <EmptyState
          compact
          icon="search"
          title="No matching teams"
          message={query ? "Try a different search." : "No teams in this filter."}
        />
      ) : (
        filtered.map((row) => {
          const checkedIn = row.status === "checked_in";
          const blocked = row.waiver?.blocksCheckIn ?? false;
          const busy = busyId === row.id;
          const meta = [row.schoolName, poolLabel(row.divisionName)]
            .filter(Boolean)
            .join(" · ");
          return (
            <Card key={row.id}>
              <View style={styles.checkInRow}>
                <View style={styles.flex}>
                  <AppText variant="callout" weight="600">
                    {row.teamName}
                  </AppText>
                  {meta ? (
                    <AppText variant="footnote" tone="muted">
                      {meta}
                    </AppText>
                  ) : null}
                  {showWaiver && row.waiver ? (
                    <AppText
                      variant="footnote"
                      tone={row.waiver.complete ? "success" : blocked ? "warning" : "muted"}
                    >
                      Waivers {row.waiver.completedCount}/{row.waiver.totalCount}
                      {row.waiver.complete ? " · Complete" : blocked ? " · Required to check in" : ""}
                    </AppText>
                  ) : null}
                </View>
                {checkedIn ? (
                  <View style={styles.checkedIn}>
                    <View style={styles.checkedLabel}>
                      <Icon name="checkmark-circle" size={18} tone="success" />
                      <AppText variant="footnote" weight="600" tone="success">
                        Checked in
                      </AppText>
                    </View>
                    <Button
                      label="Undo"
                      variant="ghost"
                      size="sm"
                      loading={busy}
                      disabled={busyId !== null && !busy}
                      onPress={() => onUndoCheckIn(row.id, row.teamName)}
                    />
                  </View>
                ) : (
                  <Button
                    label="Check in"
                    size="sm"
                    loading={busy}
                    disabled={blocked || (busyId !== null && !busy)}
                    onPress={() => onCheckIn(row.id)}
                  />
                )}
              </View>
            </Card>
          );
        })
      )}
    </View>
  );
}

function WaitlistTab({
  rows,
  locked,
  busyId,
  onPromote,
  onRemove,
}: {
  rows: TournamentHostRegistrationsContract["waitlist"];
  locked: boolean;
  busyId: string | null;
  onPromote: () => void;
  onRemove: (id: string, teamName: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="hourglass-outline"
        title="Waitlist is empty"
        message="When the tournament is full, new registrations line up here."
      />
    );
  }

  const anyEligible = rows.some((row) => row.eligible);

  return (
    <View style={styles.list}>
      {!locked ? (
        <Button
          label="Promote next eligible team"
          icon="arrow-up-circle-outline"
          loading={busyId === "promote"}
          disabled={!anyEligible || (busyId !== null && busyId !== "promote")}
          onPress={onPromote}
          fullWidth
        />
      ) : null}
      {rows.map((row) => (
        <Card key={row.id}>
          <View style={styles.checkInRow}>
            <AppText variant="headline" tone="muted" style={styles.rank}>
              {row.queueRank}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="callout" weight="600">
                {row.teamName}
              </AppText>
              {row.schoolName ? (
                <AppText variant="footnote" tone="muted">
                  {row.schoolName}
                </AppText>
              ) : null}
            </View>
            <Badge
              label={row.eligible ? "Eligible" : "Not eligible"}
              tone={row.eligible ? "success" : "neutral"}
            />
          </View>
          {!locked ? (
            <Button
              label="Remove"
              variant="destructiveOutline"
              size="sm"
              loading={busyId === row.id}
              disabled={busyId !== null && busyId !== row.id}
              onPress={() => onRemove(row.id, row.teamName)}
              style={styles.selfStart}
            />
          ) : null}
        </Card>
      ))}
    </View>
  );
}

function RegistrationCard({
  row,
  showPayment,
  showWaiver,
  leading,
  footer,
}: {
  row: TournamentHostRegistrationContract;
  showPayment: boolean;
  showWaiver: boolean;
  leading?: ReactNode;
  footer?: ReactNode;
}) {
  const details = [
    poolLabel(row.divisionName),
    showWaiver && row.waiver
      ? `Waivers ${row.waiver.completedCount}/${row.waiver.totalCount}`
      : null,
    showPayment && row.payment
      ? `${paymentStatusLabel(row.payment.status)} · ${formatFeeCents(row.payment.amountCents)}`
      : null,
  ].filter(Boolean);

  return (
    <Card>
      <View style={styles.cardHeader}>
        {leading}
        <View style={styles.flex}>
          <AppText variant="callout" weight="600">
            {row.teamName}
          </AppText>
          {row.schoolName ? (
            <AppText variant="footnote" tone="muted">
              {row.schoolName}
            </AppText>
          ) : null}
        </View>
        <StatusBadge kind="registration" status={row.status} />
      </View>
      {details.length > 0 ? (
        <AppText variant="footnote" tone="muted">
          {details.join("  ·  ")}
        </AppText>
      ) : null}
      {footer}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  selfStart: { alignSelf: "flex-start" },
  list: { gap: space.md },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.xs },
  assign: { gap: space.sm, marginTop: space.xs },
  bulkHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.md },
  selectHit: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    marginVertical: -space.sm,
    marginLeft: -space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  selectBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: radius.sm - 2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: { height: 8, borderRadius: radius.full, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: radius.full },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: HIT_TARGET,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.md },
  checkInRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  checkedIn: { alignItems: "flex-end", gap: space.xxs },
  checkedLabel: { flexDirection: "row", alignItems: "center", gap: space.xs },
  rank: { minWidth: 24, textAlign: "center" },
});
