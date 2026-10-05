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

import type { TournamentPoolSettingsContract } from "@/lib/api/contracts/tournament-ops";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  UIManager,
  View,
} from "react-native";
import {
  fetchTournamentPoolSettings,
  updateTournamentPoolSettings,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  MATCH_FORMAT_OPTIONS,
  POOL_TIEBREAK_OPTIONS,
  WARMUP_FORMAT_OPTIONS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  BottomBar,
  Button,
  EmptyState,
  HIT_TARGET,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  haptics,
  radius,
  space,
  type IconName,
} from "~/ui";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateTiebreakReorder() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export default function PoolSettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [draft, setDraft] = useState<TournamentPoolSettingsContract | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentPoolSettings(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, poll } = usePublicLoader(
    load,
    "Could not load pool settings."
  );

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="alert-circle-outline"
          title="Tournament unavailable"
          message="This link is missing its tournament. Go back and open it again."
          action={{ label: "Go back", icon: "chevron-back", onPress: () => router.back() }}
        />
      </View>
    );
  }
  if ((data === null || draft === null) && error === null) {
    return <LoadingScreen />;
  }
  if (!data || !draft) {
    return (
      <ErrorScreen
        title="Pool settings unavailable"
        message={error ?? "Only the tournament host can edit these settings."}
        onRetry={() => void refresh()}
      />
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data);

  function edit(patch: Partial<TournamentPoolSettingsContract>) {
    setSaved(false);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function onSave() {
    if (!draft || busy) return;
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      const next = await updateTournamentPoolSettings(slug!, draft);
      setDraft(next);
      await poll();
      setSaved(true);
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not save pool settings."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  function moveCriterion(index: number, direction: -1 | 1) {
    if (!draft) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= draft.poolTiebreakCriteria.length) {
      return;
    }
    animateTiebreakReorder();
    setSaved(false);
    setDraft((prev) => {
      if (!prev) return prev;
      const criteria = [...prev.poolTiebreakCriteria];
      const [item] = criteria.splice(index, 1);
      criteria.splice(nextIndex, 0, item!);
      return { ...prev, poolTiebreakCriteria: criteria };
    });
  }

  const lastIndex = draft.poolTiebreakCriteria.length - 1;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        {error ? <Banner tone="error" message={error} /> : null}

        <Section title="Match format" description="How many sets each pool match plays.">
          <OptionList
            options={MATCH_FORMAT_OPTIONS}
            value={draft.matchFormat}
            onChange={(matchFormat) => edit({ matchFormat })}
          />
        </Section>

        <Section title="Scoring" description="Points for each set in pool play.">
          <ListGroup>
            <StepperRow
              label="Starting score"
              description="Score each set begins at."
              value={draft.setStartingScore}
              onChange={(value) => edit({ setStartingScore: value ?? 0 })}
            />
            <StepperRow
              label="Set target"
              description="Points needed to win a set."
              value={draft.setTargetScore}
              min={1}
              onChange={(value) => edit({ setTargetScore: value ?? 0 })}
            />
            <StepperRow
              label="Tiebreak set target"
              description="Points needed to win a deciding set."
              value={draft.tiebreakTargetScore}
              min={1}
              onChange={(value) => edit({ tiebreakTargetScore: value ?? 0 })}
            />
          </ListGroup>
        </Section>

        <Section title="Warmup">
          <OptionList
            options={WARMUP_FORMAT_OPTIONS}
            value={draft.warmupFormat}
            onChange={(warmupFormat) => edit({ warmupFormat })}
          />
        </Section>

        <Section
          title="Standings tie-breaks"
          description="Teams tied on the first rule are ranked by the next one down."
        >
          <ListGroup>
            {draft.poolTiebreakCriteria.map((criterion, index) => {
              const label =
                POOL_TIEBREAK_OPTIONS.find((item) => item.value === criterion)
                  ?.label ?? criterion;
              return (
                <ListRow
                  key={criterion}
                  title={`${index + 1}. ${label}`}
                  trailing={
                    <View style={styles.reorder}>
                      <SquareButton
                        icon="chevron-up"
                        accessibilityLabel={`Move ${label} up`}
                        disabled={index === 0}
                        onPress={() => moveCriterion(index, -1)}
                      />
                      <SquareButton
                        icon="chevron-down"
                        accessibilityLabel={`Move ${label} down`}
                        disabled={index === lastIndex}
                        onPress={() => moveCriterion(index, 1)}
                      />
                    </View>
                  }
                />
              );
            })}
          </ListGroup>
        </Section>
      </ScreenScroll>

      <BottomBar>
        {actionError ? (
          <Banner
            tone="error"
            message={actionError}
            onDismiss={() => setActionError(null)}
          />
        ) : null}
        {saved ? (
          <Banner
            tone="success"
            message="Pool settings saved."
            onDismiss={() => setSaved(false)}
          />
        ) : null}
        <Button
          label="Save changes"
          fullWidth
          loading={busy}
          disabled={!dirty}
          onPress={() => void onSave()}
        />
      </BottomBar>
    </View>
  );
}

function OptionList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ListGroup>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <ListRow
            key={option.value}
            title={option.label}
            accessibilityLabel={selected ? `${option.label}, selected` : option.label}
            chevron={false}
            trailing={
              selected ? <Icon name="checkmark" size={20} tone="primary" /> : null
            }
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(option.value);
            }}
          />
        );
      })}
    </ListGroup>
  );
}

function SquareButton({
  icon,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  icon: IconName;
  accessibilityLabel: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={({ pressed }) => [
        styles.squareButton,
        {
          backgroundColor: pressed ? colors.muted : "transparent",
          opacity: disabled ? 0.3 : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} tone="primary" />
    </Pressable>
  );
}

function StepperRow({
  label,
  description,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  description?: string;
  value: number;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.stepperRow}>
      <View style={styles.stepperText}>
        <AppText variant="callout" weight="600">
          {label}
        </AppText>
        {description ? (
          <AppText variant="footnote" tone="muted">
            {description}
          </AppText>
        ) : null}
      </View>
      <SquareButton
        icon="remove"
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <TextInput
        value={String(value)}
        onChangeText={(text) => {
          const parsed = Number.parseInt(text, 10);
          onChange(Number.isNaN(parsed) ? null : Math.min(max, parsed));
        }}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={2}
        accessibilityLabel={label}
        style={[
          styles.stepperInput,
          {
            color: colors.foreground,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      />
      <SquareButton
        icon="add"
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center" },
  reorder: { flexDirection: "row", gap: space.xxs },
  squareButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    minHeight: HIT_TARGET + 12,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  stepperText: { flex: 1, gap: space.xxs, marginRight: space.sm },
  stepperInput: {
    width: 52,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radius.sm,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
