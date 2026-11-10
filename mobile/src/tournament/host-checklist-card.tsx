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

import type { TournamentHostOverviewContract } from "@/lib/api/contracts/tournament-host";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { updateTournamentHostStatus } from "~/api/endpoints";
import { TOURNAMENT_STATUS_LABELS } from "~/lib/format";
import { useThemeColors, withAlpha } from "~/theme/colors";
import {
  stepAction,
  stepHint,
  statusConfirmMessage,
  type StepAction,
} from "~/tournament/host-checklist";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  haptics,
  ListGroup,
  ListRow,
  radius,
  space,
} from "~/ui";

/** Setup progress, the one next step, and every step linked to where it's done. */
export function HostChecklistCard({
  overview,
  onChanged,
}: {
  overview: TournamentHostOverviewContract;
  onChanged: () => Promise<void> | void;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = overview.checklist;
  const doneCount = steps.filter((s) => s.done).length;
  const nextIndex = steps.findIndex((s) => !s.done);
  const next = nextIndex >= 0 ? steps[nextIndex] : null;
  const nextAction = next ? stepAction(next, overview) : null;

  function run(action: StepAction) {
    if (!action) return;
    if (action.kind === "route") {
      router.push(action.path);
      return;
    }
    const label = TOURNAMENT_STATUS_LABELS[action.status] ?? action.status;
    Alert.alert(`Set status to ${label}?`, statusConfirmMessage(action.status), [
      { text: "Cancel", style: "cancel" },
      {
        text: "Set status",
        onPress: () => void applyStatus(action.status),
      },
    ]);
  }

  async function applyStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      await updateTournamentHostStatus(overview.slug, status);
      haptics.success();
      await onChanged();
    } catch (cause) {
      haptics.error();
      setError(messageFor(cause, "Could not update status."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: withAlpha(colors.primary, 0.06),
          },
        ]}
      >
        <AppText variant="footnote" tone="muted" style={styles.tabular}>
          {doneCount} of {steps.length} steps done
        </AppText>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Setup progress"
          accessibilityValue={{ min: 0, max: steps.length, now: doneCount }}
          style={[styles.track, { backgroundColor: colors.muted }]}
        >
          <View
            style={[
              styles.fill,
              {
                width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>
        {next ? (
          <View style={styles.next}>
            <AppText variant="headline" accessibilityRole="header">
              Next: {next.label}
            </AppText>
            {stepHint(next, overview) ? (
              <AppText variant="subhead" tone="muted">
                {stepHint(next, overview)}
              </AppText>
            ) : null}
            {nextAction ? (
              <Button
                label={nextAction.label}
                size="sm"
                loading={busy && nextAction.kind === "status"}
                onPress={() => run(nextAction)}
                style={styles.nextButton}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.next}>
            <AppText variant="headline" accessibilityRole="header">
              You’re all set
            </AppText>
            <AppText variant="subhead" tone="muted">
              Every step is done. Follow the action from Play.
            </AppText>
          </View>
        )}
      </View>

      {error ? (
        <Banner tone="error" message={error} onDismiss={() => setError(null)} />
      ) : null}

      <ListGroup>
        {steps.map((step, index) => {
          const action = stepAction(step, overview);
          const isNext = index === nextIndex;
          return (
            <ListRow
              key={step.id}
              title={step.label}
              icon={
                step.done
                  ? "checkmark-circle"
                  : isNext
                    ? "arrow-forward-circle"
                    : "ellipse-outline"
              }
              iconTone={step.done ? "success" : isNext ? "primary" : "muted"}
              accessibilityLabel={`${step.label}${step.done ? ", done" : isNext ? ", next" : ""}`}
              onPress={action && !(busy && action.kind === "status") ? () => run(action) : undefined}
            />
          );
        })}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.md },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  track: { height: 6, borderRadius: radius.full, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.full },
  next: { gap: space.sm, marginTop: space.sm },
  nextButton: { marginTop: space.xs },
  tabular: { fontVariant: ["tabular-nums"] },
});
