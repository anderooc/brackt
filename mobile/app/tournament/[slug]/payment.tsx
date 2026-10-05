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

import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import {
  confirmTournamentPayment,
  fetchTournamentPayment,
  submitTournamentPayment,
  waiveTournamentPayment,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import {
  formatFeeCents,
  PAYMENT_METHODS,
  paymentMethodLabel,
  paymentStatusLabel,
} from "~/lib/format";
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
  haptics,
  ScreenScroll,
  Section,
  space,
  type BadgeTone,
} from "~/ui";

function paymentTone(status: string): BadgeTone {
  switch (status) {
    case "unpaid":
      return "warning";
    case "submitted":
      return "info";
    case "confirmed":
      return "success";
    default:
      return "neutral";
  }
}

export default function PaymentScreen() {
  const colors = useThemeColors();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [method, setMethod] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentPayment(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load payment details."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (data === null && error === null) return <LoadingScreen />;
  if (!data || !slug) {
    return (
      <ErrorScreen
        title="Payment unavailable"
        message={error ?? "Could not load payment details."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function run(
    key: string,
    success: string,
    action: () => Promise<void>
  ) {
    setBusyKey(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      await action();
      haptics.success();
      setActionSuccess(success);
      await refresh();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Something went wrong."));
    } finally {
      setBusyKey(null);
    }
  }

  function confirmWaive(teamSlug: string, teamName: string) {
    Alert.alert(
      `Waive fee for ${teamName}?`,
      "The team will be marked as not owing a fee.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Waive fee",
          style: "destructive",
          onPress: () =>
            void run(`waive-${teamSlug}`, `Fee waived for ${teamName}.`, async () => {
              await waiveTournamentPayment(slug!, teamSlug);
            }),
        },
      ]
    );
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <AppText variant="subhead" tone="muted">
        brackt tracks payment status. It does not process card charges.
      </AppText>

      {data.settings.instructionsText ? (
        <Section title="How to pay">
          <Card>
            <AppText>{data.settings.instructionsText}</AppText>
          </Card>
        </Section>
      ) : null}

      {actionError ? (
        <Banner
          tone="error"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      {actionSuccess ? (
        <Banner
          tone="success"
          message={actionSuccess}
          onDismiss={() => setActionSuccess(null)}
        />
      ) : null}

      {data.teams.length === 0 ? (
        <EmptyState
          icon="card-outline"
          title="No payments yet"
          message="Payment details appear here once one of your teams is registered for this tournament."
        />
      ) : (
        <Section title={data.isOrganizer ? "Teams" : "Your teams"}>
          {data.teams.map((team) => {
            const settled =
              team.status === "confirmed" || team.status === "waived";
            const canSubmit = team.isCaptain && team.status === "unpaid";
            const selected = method[team.teamSlug] ?? "venmo";
            const meta = [
              formatFeeCents(team.amountCents),
              team.submittedMethod
                ? paymentMethodLabel(team.submittedMethod)
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <Card key={team.teamSlug} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitle}>
                    <AppText variant="headline">{team.teamName}</AppText>
                    <AppText variant="footnote" tone="muted">
                      {meta}
                    </AppText>
                  </View>
                  <Badge
                    label={paymentStatusLabel(team.status)}
                    tone={paymentTone(team.status)}
                  />
                </View>

                {team.submittedNote ? (
                  <AppText variant="subhead" tone="muted">
                    Captain note: {team.submittedNote}
                  </AppText>
                ) : null}

                {canSubmit ? (
                  <View style={styles.form}>
                    <FormField label="Payment method" colors={colors}>
                      <ChipRow>
                        {PAYMENT_METHODS.map((value) => (
                          <Chip
                            key={value}
                            label={paymentMethodLabel(value)}
                            selected={selected === value}
                            onPress={() =>
                              setMethod((prev) => ({
                                ...prev,
                                [team.teamSlug]: value,
                              }))
                            }
                          />
                        ))}
                      </ChipRow>
                    </FormField>
                    <FormField
                      label="Note"
                      hint="Optional. For example, the name on the payment."
                      colors={colors}
                    >
                      <FormTextInput
                        value={note[team.teamSlug] ?? ""}
                        onChangeText={(value) =>
                          setNote((prev) => ({
                            ...prev,
                            [team.teamSlug]: value,
                          }))
                        }
                        placeholder="Optional note"
                        autoCapitalize="sentences"
                        maxLength={500}
                        colors={colors}
                      />
                    </FormField>
                    <Button
                      label="Mark payment sent"
                      icon="paper-plane-outline"
                      fullWidth
                      loading={busyKey === `submit-${team.teamSlug}`}
                      disabled={busyKey !== null}
                      onPress={() =>
                        void run(
                          `submit-${team.teamSlug}`,
                          `Payment for ${team.teamName} sent for host review.`,
                          async () => {
                            await submitTournamentPayment(slug, {
                              teamSlug: team.teamSlug,
                              method: selected,
                              note: note[team.teamSlug],
                            });
                          }
                        )
                      }
                    />
                  </View>
                ) : null}

                {data.isOrganizer && !settled ? (
                  <View style={styles.hostActions}>
                    <Button
                      label="Mark paid"
                      icon="checkmark"
                      size="sm"
                      variant={canSubmit ? "outline" : "primary"}
                      loading={busyKey === `confirm-${team.teamSlug}`}
                      disabled={busyKey !== null}
                      onPress={() =>
                        void run(
                          `confirm-${team.teamSlug}`,
                          `${team.teamName} marked paid.`,
                          async () => {
                            await confirmTournamentPayment(slug, team.teamSlug);
                          }
                        )
                      }
                    />
                    <Button
                      label="Waive fee"
                      size="sm"
                      variant="ghost"
                      loading={busyKey === `waive-${team.teamSlug}`}
                      disabled={busyKey !== null}
                      onPress={() => confirmWaive(team.teamSlug, team.teamName)}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })}
        </Section>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: space.md },
  cardTitle: { flex: 1, gap: space.xxs },
  form: { gap: space.lg },
  hostActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
});
