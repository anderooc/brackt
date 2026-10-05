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

import type { TournamentHostSetupContract } from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  addTournamentHostCourt,
  addTournamentHostDivision,
  fetchTournamentHostSetup,
  removeTournamentHostCourt,
  removeTournamentHostDivision,
  setTournamentHostDivisionCourts,
  updateTournamentHostRegistrationAvailability,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import { PLAY_FORMAT_LABELS } from "~/lib/format";
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
  haptics,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  space,
} from "~/ui";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function localDateOf(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function endOfLocalDayIso(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(year, month - 1, day, 23, 59, 59).toISOString();
}

export default function TournamentHostSetupScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [setup, setSetup] = useState<TournamentHostSetupContract | null>(null);
  const [divisionName, setDivisionName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [capacityText, setCapacityText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostSetup(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, reload } = usePublicLoader(
    load,
    "Could not load setup."
  );

  useEffect(() => {
    if (!data) return;
    setSetup(data.setup);
    setCapacityText(
      data.setup.registrationCapacity == null
        ? ""
        : String(data.setup.registrationCapacity)
    );
    setDeadline(localDateOf(data.setup.registrationDeadline));
  }, [data]);

  const runAction = useCallback(
    async (
      key: string,
      action: () => Promise<{ setup: TournamentHostSetupContract }>,
      success?: string
    ) => {
      setBusyKey(key);
      setActionError(null);
      setNotice(null);
      try {
        const result = await action();
        setSetup(result.setup);
        haptics.success();
        if (success) setNotice(success);
        return true;
      } catch (cause) {
        haptics.error();
        setActionError(messageFor(cause, "Could not save changes."));
        return false;
      } finally {
        setBusyKey(null);
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
        message="No tournament was specified. Go back and open it again."
        onRetry={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      />
    );
  }
  if (error && !setup) {
    return (
      <ErrorScreen
        title="Setup unavailable"
        message={error}
        onRetry={() => void reload()}
      />
    );
  }
  if (!setup) return <LoadingScreen />;

  const locked = !setup.canEdit;
  const savedCapacity =
    setup.registrationCapacity == null ? "" : String(setup.registrationCapacity);
  const availabilityDirty =
    capacityText.trim() !== savedCapacity ||
    deadline.trim() !== localDateOf(setup.registrationDeadline);
  const divisionNames = new Map(
    setup.divisions.map((division) => [division.id, division.name])
  );

  const saveAvailability = () => {
    const capacityValue = capacityText.trim();
    const deadlineValue = deadline.trim();
    if (capacityValue !== "" && !/^\d+$/.test(capacityValue)) {
      setActionError("Capacity must be a whole number, or blank for unlimited.");
      haptics.error();
      return;
    }
    if (deadlineValue !== "" && !DATE_PATTERN.test(deadlineValue)) {
      setActionError("Deadline must use YYYY-MM-DD, or be blank for no deadline.");
      haptics.error();
      return;
    }
    void runAction(
      "availability",
      () =>
        updateTournamentHostRegistrationAvailability(slug, {
          capacity: capacityValue === "" ? null : Number.parseInt(capacityValue, 10),
          deadline:
            deadlineValue === ""
              ? null
              : deadlineValue === localDateOf(setup.registrationDeadline)
                ? setup.registrationDeadline
                : endOfLocalDayIso(deadlineValue),
        }),
      "Registration availability saved."
    );
  };

  const addPool = () => {
    const name = divisionName.trim();
    if (!name) return;
    void runAction(
      "add-pool",
      async () => {
        const result = await addTournamentHostDivision(slug, name);
        setDivisionName("");
        return result;
      },
      `${name} added.`
    );
  };

  const addCourt = () => {
    const name = courtName.trim();
    if (!name) return;
    void runAction(
      "add-court",
      async () => {
        const result = await addTournamentHostCourt(slug, name);
        setCourtName("");
        return result;
      },
      `${name} added.`
    );
  };

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      {setup.preparationLockedReason ? (
        <Banner tone="info" message={setup.preparationLockedReason} />
      ) : null}
      {error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: () => void refresh() }}
        />
      ) : null}
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      {notice ? (
        <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <ListGroup>
        <ListRow
          title={PLAY_FORMAT_LABELS[setup.playFormat] ?? setup.playFormat}
          subtitle="Play format was chosen when the tournament was created and applies to every pool."
          icon="git-branch-outline"
          numberOfLines={3}
        />
      </ListGroup>

      <Section
        title="Registration"
        description={`${setup.registeredCount} active registration${setup.registeredCount === 1 ? "" : "s"}`}
      >
        <FormField label="Capacity" colors={colors} hint="Leave blank for unlimited teams.">
          <FormTextInput
            value={capacityText}
            onChangeText={setCapacityText}
            placeholder="Unlimited"
            colors={colors}
            keyboardType="numbers-and-punctuation"
            editable={!locked}
            accessibilityLabel="Team capacity"
          />
        </FormField>
        <FormField label="Deadline" colors={colors} hint="YYYY-MM-DD. Registration closes at 11:59 PM that day. Leave blank for no deadline.">
          <FormTextInput
            value={deadline}
            onChangeText={setDeadline}
            placeholder="No deadline"
            colors={colors}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            editable={!locked}
            accessibilityLabel="Registration deadline"
          />
        </FormField>
        {!locked ? (
          <Button
            label="Save registration"
            onPress={saveAvailability}
            loading={busyKey === "availability"}
            disabled={!availabilityDirty}
            fullWidth
          />
        ) : null}
      </Section>

      <Section title="Pools" description="Choose which courts each pool plays on.">
        {setup.divisions.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="grid-outline"
              title="No pools yet"
              message={locked ? "Pools can't be added at this stage." : "Add your first pool below."}
            />
          </Card>
        ) : (
          setup.divisions.map((division) => {
            const courtsBusy = busyKey === `courts-${division.id}`;
            return (
              <Card key={division.id}>
                <View style={styles.itemHeader}>
                  <AppText variant="headline" style={styles.flex}>
                    {division.name}
                  </AppText>
                  {!locked ? (
                    <Button
                      label="Remove"
                      variant="destructiveOutline"
                      size="sm"
                      icon="trash-outline"
                      accessibilityLabel={`Remove ${division.name}`}
                      loading={busyKey === `remove-pool-${division.id}`}
                      onPress={() =>
                        Alert.alert(
                          `Remove ${division.name}?`,
                          "This deletes the pool and can't be undone.",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () =>
                                void runAction(
                                  `remove-pool-${division.id}`,
                                  () => removeTournamentHostDivision(slug, division.id),
                                  `${division.name} removed.`
                                ),
                            },
                          ]
                        )
                      }
                    />
                  ) : null}
                </View>
                {setup.courts.length > 0 ? (
                  <View style={styles.courtPicker}>
                    <AppText variant="footnote" tone="muted">
                      {courtsBusy ? "Saving courts…" : "Courts"}
                    </AppText>
                    <ChipRow>
                      {setup.courts.map((court) => {
                        const selected = division.courtIds.includes(court.id);
                        return (
                          <Chip
                            key={court.id}
                            label={court.name}
                            selected={selected}
                            icon={selected ? "checkmark" : undefined}
                            disabled={locked || courtsBusy}
                            onPress={() => {
                              const next = selected
                                ? division.courtIds.filter((id) => id !== court.id)
                                : [...division.courtIds, court.id];
                              void runAction(`courts-${division.id}`, () =>
                                setTournamentHostDivisionCourts(slug, division.id, next)
                              );
                            }}
                          />
                        );
                      })}
                    </ChipRow>
                  </View>
                ) : (
                  <AppText variant="footnote" tone="muted">
                    Add courts below to assign them to this pool.
                  </AppText>
                )}
              </Card>
            );
          })
        )}
        {!locked ? (
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <FormTextInput
                value={divisionName}
                onChangeText={setDivisionName}
                placeholder="New pool name, e.g. Gold"
                colors={colors}
                autoCapitalize="words"
                accessibilityLabel="New pool name"
              />
            </View>
            <Button
              label="Add"
              icon="add"
              variant="outline"
              onPress={addPool}
              loading={busyKey === "add-pool"}
              disabled={!divisionName.trim()}
              accessibilityLabel="Add pool"
            />
          </View>
        ) : null}
      </Section>

      <Section title="Courts">
        {setup.courts.length === 0 ? (
          <Card>
            <EmptyState
              compact
              icon="map-outline"
              title="No courts yet"
              message={
                locked ? "Courts can't be added at this stage." : "Add the courts you'll play on below."
              }
            />
          </Card>
        ) : (
          <ListGroup>
            {setup.courts.map((court) => {
              const usedBy = court.divisionIds
                .map((id) => divisionNames.get(id))
                .filter(Boolean)
                .join(", ");
              return (
                <ListRow
                  key={court.id}
                  title={court.name}
                  subtitle={usedBy ? `Used by ${usedBy}` : "Not assigned to a pool"}
                  trailing={
                    !locked ? (
                      <Button
                        label="Remove"
                        variant="destructiveOutline"
                        size="sm"
                        accessibilityLabel={`Remove ${court.name}`}
                        loading={busyKey === `remove-court-${court.id}`}
                        onPress={() =>
                          Alert.alert(`Remove ${court.name}?`, "This can't be undone.", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Remove",
                              style: "destructive",
                              onPress: () =>
                                void runAction(
                                  `remove-court-${court.id}`,
                                  () => removeTournamentHostCourt(slug, court.id),
                                  `${court.name} removed.`
                                ),
                            },
                          ])
                        }
                      />
                    ) : null
                  }
                />
              );
            })}
          </ListGroup>
        )}
        {!locked ? (
          <View style={styles.addRow}>
            <View style={styles.flex}>
              <FormTextInput
                value={courtName}
                onChangeText={setCourtName}
                placeholder="New court name, e.g. Court 1"
                colors={colors}
                autoCapitalize="words"
                accessibilityLabel="New court name"
              />
            </View>
            <Button
              label="Add"
              icon="add"
              variant="outline"
              onPress={addCourt}
              loading={busyKey === "add-court"}
              disabled={!courtName.trim()}
              accessibilityLabel="Add court"
            />
          </View>
        ) : null}
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.md,
  },
  courtPicker: { gap: space.sm },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
});
