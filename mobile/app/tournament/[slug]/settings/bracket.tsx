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

import type { TournamentBracketSettingsContract } from "@/lib/api/contracts/tournament-ops";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  fetchTournamentBracketSettings,
  regenerateTournamentHostBrackets,
  updateTournamentBracketSettings,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { BRACKET_COUNT_OPTIONS } from "~/lib/format";
import { FormField, FormTextInput } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  Banner,
  BottomBar,
  Button,
  Card,
  Icon,
  ListGroup,
  ListRow,
  Section,
  haptics,
  space,
  ScreenScroll,
} from "~/ui";

export default function BracketSettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [draft, setDraft] = useState<TournamentBracketSettingsContract | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) =>
      fetchTournamentBracketSettings(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load bracket settings."
  );

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <ErrorScreen
        title="Tournament unavailable"
        message="This link is missing the tournament. Go back and open it again."
      />
    );
  }
  if ((data === null || draft === null) && error === null) {
    return <LoadingScreen />;
  }
  if (!data || !draft) {
    return (
      <ErrorScreen
        title="Bracket settings unavailable"
        message={error ?? "Only the tournament host can edit these settings."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function onSave() {
    if (!draft || busy) return;
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      const next = await updateTournamentBracketSettings(slug!, {
        bracketCount: draft.bracketCount,
        goldTeamCount: draft.goldTeamCount,
        silverTeamCount: draft.silverTeamCount,
      });
      setDraft(next);
      setSaved(true);
      haptics.success();
      await refresh();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not save bracket settings."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  const locked = draft.locked && !draft.canRegenerate;
  const dirty =
    data.bracketCount !== draft.bracketCount ||
    data.goldTeamCount !== draft.goldTeamCount ||
    data.silverTeamCount !== draft.silverTeamCount;

  function updateCount(key: "goldTeamCount" | "silverTeamCount", text: string) {
    setSaved(false);
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            [key]: text.trim() === "" ? null : Number.parseInt(text, 10) || null,
          }
        : prev
    );
  }

  function confirmRegenerate() {
    haptics.warning();
    Alert.alert(
      "Regenerate brackets?",
      "This clears current bracket matches and re-seeds from pool standings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Regenerate",
          style: "destructive",
          onPress: () => {
            setRegenerating(true);
            setActionError(null);
            void regenerateTournamentHostBrackets(slug!)
              .then((result) => {
                setDraft(result.settings);
                setSaved(true);
                haptics.success();
                void refresh();
              })
              .catch((cause) => {
                setActionError(messageFor(cause, "Could not regenerate brackets."));
                haptics.error();
              })
              .finally(() => setRegenerating(false));
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        {!draft.hasPoolToBracket ? (
          <Card>
            <ListRow
              icon="grid-outline"
              title="Add pools first"
              subtitle="Bracket tiers need at least one pool that feeds into brackets. Pools are added in Setup."
              onPress={() => router.push(`/tournament/${slug}/host/setup`)}
            />
          </Card>
        ) : null}

        {locked ? (
          <Banner
            tone="warning"
            title="Locked"
            message={
              draft.regenerateBlockedReason ??
              "Bracket settings are locked while bracket play is in progress."
            }
          />
        ) : null}
        <Section
          title="Structure"
          description="How pool teams advance into gold, silver, and bronze after pool play."
        >
          <ListGroup>
            {BRACKET_COUNT_OPTIONS.map((option) => {
              const selected = draft.bracketCount === option.value;
              return (
                <ListRow
                  key={option.value}
                  title={option.label}
                  disabled={locked}
                  chevron={false}
                  accessibilityLabel={`${option.label}${selected ? ", selected" : ""}`}
                  trailing={
                    <Icon
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                      size={22}
                      tone={selected ? "primary" : "muted"}
                    />
                  }
                  onPress={() => {
                    setSaved(false);
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            bracketCount: option.value,
                            goldTeamCount:
                              option.value >= 2 ? (prev.goldTeamCount ?? 4) : null,
                            silverTeamCount:
                              option.value === 3 ? (prev.silverTeamCount ?? 4) : null,
                          }
                        : prev
                    );
                  }}
                />
              );
            })}
          </ListGroup>
        </Section>

        {draft.bracketCount >= 2 ? (
          <Section
            title="Teams per bracket"
            description={
              draft.totalBracketTeams > 0
                ? `${draft.totalBracketTeams} teams are in pool play feeding brackets.`
                : undefined
            }
          >
            <View style={styles.counts}>
              <View style={styles.countField}>
                <FormField label="Gold" colors={colors}>
                  <FormTextInput
                    editable={!locked}
                    keyboardType="number-pad"
                    value={draft.goldTeamCount == null ? "" : String(draft.goldTeamCount)}
                    onChangeText={(text) => updateCount("goldTeamCount", text)}
                    placeholder="e.g. 8"
                    accessibilityLabel="Gold bracket teams"
                    colors={colors}
                  />
                </FormField>
              </View>
              {draft.bracketCount === 3 ? (
                <View style={styles.countField}>
                  <FormField label="Silver" colors={colors}>
                    <FormTextInput
                      editable={!locked}
                      keyboardType="number-pad"
                      value={draft.silverTeamCount == null ? "" : String(draft.silverTeamCount)}
                      onChangeText={(text) => updateCount("silverTeamCount", text)}
                      placeholder="e.g. 8"
                      accessibilityLabel="Silver bracket teams"
                      colors={colors}
                    />
                  </FormField>
                </View>
              ) : null}
            </View>
          </Section>
        ) : null}

        {draft.canRegenerate ? (
          <Section
            title="Regenerate"
            description="Clears bracket matches and re-seeds from current pool standings."
          >
            <Button
              label="Regenerate brackets"
              icon="refresh"
              variant="destructiveOutline"
              fullWidth
              loading={regenerating}
              disabled={busy}
              onPress={confirmRegenerate}
            />
          </Section>
        ) : null}
      </ScreenScroll>

      <BottomBar>
        {actionError ? (
          <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
        ) : null}
        {saved && !dirty ? <Banner tone="success" message="Bracket settings saved." /> : null}
        <Button
          label="Save changes"
          fullWidth
          loading={busy}
          disabled={!dirty || locked || !draft.hasPoolToBracket || regenerating}
          onPress={() => void onSave()}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  counts: { flexDirection: "row", gap: space.md },
  countField: { flex: 1 },
});
