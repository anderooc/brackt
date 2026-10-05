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

import type { TournamentPaymentSettingsContract } from "@/lib/api/contracts/tournament-ops";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  fetchTournamentHostPaymentSettings,
  updateTournamentHostPaymentSettings,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  Banner,
  BottomBar,
  Button,
  EmptyState,
  ListGroup,
  ScreenScroll,
  Section,
  SwitchRow,
  haptics,
  space,
} from "~/ui";

type PaymentDraft = {
  enabled: boolean;
  requiredBeforeConfirm: boolean;
  firstTeamFeeDollars: string;
  additionalTeamFeeDollars: string;
  venmoHandle: string;
  zelleHandle: string;
  cashappHandle: string;
  otherInstructions: string;
};

function centsToDollarInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

function draftFromSettings(settings: TournamentPaymentSettingsContract): PaymentDraft {
  return {
    enabled: settings.enabled,
    requiredBeforeConfirm: settings.requiredBeforeConfirm,
    firstTeamFeeDollars: centsToDollarInput(settings.firstTeamFeeCents),
    additionalTeamFeeDollars: centsToDollarInput(settings.additionalTeamFeeCents),
    venmoHandle: settings.venmoHandle ?? "",
    zelleHandle: settings.zelleHandle ?? "",
    cashappHandle: settings.cashappHandle ?? "",
    otherInstructions: settings.otherInstructions ?? "",
  };
}

function parseDollarToCents(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

function feeError(value: string): string | null {
  if (!value.trim()) return null;
  const cents = parseDollarToCents(value);
  return cents == null || cents < 0 ? "Enter an amount like 150 or 150.00." : null;
}

export default function PaymentSettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostPaymentSettings(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, poll } = usePublicLoader(
    load,
    "Could not load payment settings."
  );

  useEffect(() => {
    if (data) setDraft(draftFromSettings(data));
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
        title="Payment settings unavailable"
        message={error ?? "Only the tournament host can edit these settings."}
        onRetry={() => void refresh()}
      />
    );
  }

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(draftFromSettings(data));
  const firstFeeError = draft.enabled ? feeError(draft.firstTeamFeeDollars) : null;
  const additionalFeeError = draft.enabled
    ? feeError(draft.additionalTeamFeeDollars)
    : null;
  const invalid = Boolean(firstFeeError || additionalFeeError);

  function edit(patch: Partial<PaymentDraft>) {
    setSaved(false);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function onSave() {
    if (!draft || busy || invalid) return;
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      const firstTeamFeeCents = draft.enabled
        ? parseDollarToCents(draft.firstTeamFeeDollars)
        : null;
      const additionalTeamFeeCents = draft.enabled
        ? draft.additionalTeamFeeDollars
          ? parseDollarToCents(draft.additionalTeamFeeDollars)
          : firstTeamFeeCents
        : null;
      await updateTournamentHostPaymentSettings(slug!, {
        enabled: draft.enabled,
        requiredBeforeConfirm: draft.requiredBeforeConfirm,
        firstTeamFeeCents,
        additionalTeamFeeCents,
        venmoHandle: draft.venmoHandle,
        zelleHandle: draft.zelleHandle,
        cashappHandle: draft.cashappHandle,
        otherInstructions: draft.otherInstructions,
      });
      await poll();
      setSaved(true);
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not save payment settings."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        {error ? <Banner tone="error" message={error} /> : null}

        <Section
          title="Entry fees"
          description="Teams pay you directly. brackt tracks who has paid but doesn't process payments."
        >
          <ListGroup>
            <SwitchRow
              label="Collect entry fees"
              description="Show payment instructions and track status per registration."
              value={draft.enabled}
              onValueChange={(enabled) => edit({ enabled })}
            />
            {draft.enabled ? (
              <SwitchRow
                label="Block confirmation until paid"
                description="Teams stay pending until you mark them paid or waive the fee."
                value={draft.requiredBeforeConfirm}
                onValueChange={(requiredBeforeConfirm) =>
                  edit({ requiredBeforeConfirm })
                }
              />
            ) : null}
          </ListGroup>
        </Section>

        {draft.enabled ? (
          <Section title="Amounts">
            <View style={styles.fields}>
              <FormField
                label="First team fee ($)"
                error={firstFeeError}
                colors={colors}
              >
                <FormTextInput
                  value={draft.firstTeamFeeDollars}
                  onChangeText={(firstTeamFeeDollars) => edit({ firstTeamFeeDollars })}
                  keyboardType="decimal-pad"
                  placeholder="150"
                  accessibilityLabel="First team fee in dollars"
                  colors={colors}
                />
              </FormField>
              <FormField
                label="Additional team fee ($)"
                hint="For a school's second team onward. Leave blank to match the first team fee."
                error={additionalFeeError}
                colors={colors}
              >
                <FormTextInput
                  value={draft.additionalTeamFeeDollars}
                  onChangeText={(additionalTeamFeeDollars) =>
                    edit({ additionalTeamFeeDollars })
                  }
                  keyboardType="decimal-pad"
                  placeholder="Same as first team"
                  accessibilityLabel="Additional team fee in dollars"
                  colors={colors}
                />
              </FormField>
            </View>
          </Section>
        ) : null}

        {draft.enabled ? (
          <Section
            title="How teams pay"
            description="Shown to teams after they register. Fill in any that apply."
          >
            <View style={styles.fields}>
              <FormField label="Venmo" colors={colors}>
                <FormTextInput
                  value={draft.venmoHandle}
                  onChangeText={(venmoHandle) => edit({ venmoHandle })}
                  autoCapitalize="none"
                  placeholder="@handle"
                  accessibilityLabel="Venmo handle"
                  colors={colors}
                />
              </FormField>
              <FormField label="Zelle" colors={colors}>
                <FormTextInput
                  value={draft.zelleHandle}
                  onChangeText={(zelleHandle) => edit({ zelleHandle })}
                  autoCapitalize="none"
                  placeholder="Email or phone"
                  accessibilityLabel="Zelle email or phone"
                  colors={colors}
                />
              </FormField>
              <FormField label="Cash App" colors={colors}>
                <FormTextInput
                  value={draft.cashappHandle}
                  onChangeText={(cashappHandle) => edit({ cashappHandle })}
                  autoCapitalize="none"
                  placeholder="$cashtag"
                  accessibilityLabel="Cash App cashtag"
                  colors={colors}
                />
              </FormField>
              <FormField label="Other instructions" colors={colors}>
                <FormTextInput
                  value={draft.otherInstructions}
                  onChangeText={(otherInstructions) => edit({ otherInstructions })}
                  multiline
                  autoCapitalize="sentences"
                  placeholder="Check payable to…"
                  accessibilityLabel="Other payment instructions"
                  colors={colors}
                />
              </FormField>
            </View>
          </Section>
        ) : null}
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
            message="Payment settings saved."
            onDismiss={() => setSaved(false)}
          />
        ) : null}
        <Button
          label="Save changes"
          fullWidth
          loading={busy}
          disabled={!dirty || invalid}
          onPress={() => void onSave()}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center" },
  fields: { gap: space.lg },
});
