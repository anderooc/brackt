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

import type { TournamentPacketHostContract } from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  fetchTournamentHostPacket,
  updateTournamentHostPacket,
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
  ScreenScroll,
  Section,
  haptics,
  radius,
  space,
} from "~/ui";

const DEFAULT_COLOR = "#C93D2E";
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export default function PacketSettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [colorInput, setColorInput] = useState(DEFAULT_COLOR);
  const [savedColor, setSavedColor] = useState(DEFAULT_COLOR);
  const [canEdit, setCanEdit] = useState(true);
  const [lockedReason, setLockedReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostPacket(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load packet settings."
  );

  useEffect(() => {
    if (!data) return;
    applyPacket(data);
  }, [data]);

  function applyPacket(packet: TournamentPacketHostContract) {
    const nextNotes = packet.notes ?? "";
    const nextColor = packet.accentColor ?? DEFAULT_COLOR;
    setNotes(nextNotes);
    setSavedNotes(nextNotes);
    setColorInput(nextColor);
    setSavedColor(nextColor);
    setCanEdit(packet.canEdit);
    setLockedReason(packet.lockedReason);
  }

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
  if (data === null && error === null) {
    return <LoadingScreen />;
  }
  if (!data) {
    return (
      <ErrorScreen
        title="Packet settings unavailable"
        message={error ?? "Only the tournament host can edit these settings."}
        onRetry={() => void refresh()}
      />
    );
  }

  const trimmedColor = colorInput.trim();
  const colorValid = HEX_RE.test(trimmedColor);
  const notesDirty = notes !== savedNotes;
  const colorDirty = trimmedColor !== savedColor;
  const dirty = notesDirty || colorDirty;

  async function onSave() {
    if (!canEdit || busy || !dirty) return;
    if (colorDirty && !colorValid) {
      setActionError("Enter a 6-digit hex color, like #1A3F7D.");
      haptics.error();
      return;
    }
    setBusy(true);
    setActionError(null);
    setSaved(false);
    try {
      const next = await updateTournamentHostPacket(slug!, {
        ...(notesDirty ? { notes } : {}),
        ...(colorDirty ? { accentColor: trimmedColor } : {}),
      });
      applyPacket(next);
      setSaved(true);
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not save packet settings."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        {error ? <Banner tone="error" message={error} /> : null}
        {lockedReason ? (
          <Banner tone="info" title="Packet locked" message={lockedReason} />
        ) : null}

        <Section
          title="Logistics notes"
          description="Agenda, parking, food, and contacts printed in the downloadable team packet."
        >
          <FormField label="Day-of notes" colors={colors}>
            <FormTextInput
              value={notes}
              onChangeText={(next) => {
                setSaved(false);
                setNotes(next);
              }}
              multiline
              autoCapitalize="sentences"
              editable={canEdit && !busy}
              placeholder="Agenda, parking, food, check-in, contacts…"
              accessibilityLabel="Logistics and day-of notes"
              colors={colors}
              style={styles.notes}
            />
          </FormField>
        </Section>

        <Section
          title="Header color"
          description="Color of the header band on the packet PDF."
        >
          <FormField
            label="Hex color"
            error={
              colorDirty && trimmedColor.length >= 7 && !colorValid
                ? "Use a 6-digit hex color, like #1A3F7D."
                : null
            }
            colors={colors}
          >
            <View style={styles.colorRow}>
              <View
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[
                  styles.swatch,
                  {
                    borderColor: colors.border,
                    backgroundColor: colorValid ? trimmedColor : colors.muted,
                  },
                ]}
              />
              <FormTextInput
                value={colorInput}
                onChangeText={(next) => {
                  setSaved(false);
                  setColorInput(next);
                }}
                autoCapitalize="none"
                maxLength={7}
                editable={canEdit && !busy}
                placeholder={DEFAULT_COLOR}
                accessibilityLabel="Header color hex code"
                colors={colors}
                style={styles.colorInput}
              />
            </View>
          </FormField>
        </Section>
      </ScreenScroll>

      {canEdit ? (
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
              message="Packet settings saved."
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center" },
  notes: { minHeight: 180 },
  colorRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  colorInput: { flex: 1 },
});
