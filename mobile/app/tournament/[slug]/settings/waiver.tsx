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

import type { TournamentWaiverSettingsContract } from "@/lib/api/contracts/tournament-ops";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  fetchTournamentWaiver,
  updateTournamentHostWaiverSettings,
  uploadTournamentHostWaiverPdf,
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
  ListRow,
  ScreenScroll,
  Section,
  SwitchRow,
  haptics,
} from "~/ui";

export default function WaiverSettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [draft, setDraft] = useState<TournamentWaiverSettingsContract | null>(
    null
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentWaiver(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh, poll } = usePublicLoader(
    load,
    "Could not load waiver settings."
  );

  useEffect(() => {
    if (!data || !data.isOrganizer) return;
    setDraft(data.settings);
    setFileName(data.fileName);
    setVersion(data.version);
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
  if (!data?.isOrganizer || !draft) {
    return (
      <ErrorScreen
        title="Waiver settings unavailable"
        message={error ?? "Only the tournament host can edit these settings."}
        onRetry={() => void refresh()}
      />
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  function edit(patch: Partial<TournamentWaiverSettingsContract>) {
    setNotice(null);
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function onUpload() {
    if (uploading) return;
    setUploading(true);
    setActionError(null);
    setNotice(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      const file = new File(asset.uri);
      const base64 = await file.base64();
      const result = await uploadTournamentHostWaiverPdf(slug!, {
        base64,
        fileName: asset.name,
      });
      setFileName(result.waiver.fileName);
      setVersion(result.waiver.version);
      setNotice(`Uploaded version ${result.waiver.version}.`);
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not upload waiver PDF."));
      haptics.error();
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    if (!draft || busy) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await updateTournamentHostWaiverSettings(slug!, draft);
      await poll();
      setNotice("Waiver settings saved.");
      haptics.success();
    } catch (cause) {
      setActionError(messageFor(cause, "Could not save waiver settings."));
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
          title="Waiver PDF"
          description="The document teams download, print, or sign."
        >
          <ListGroup>
            <ListRow
              icon="document-text-outline"
              title={fileName ?? "No waiver uploaded yet"}
              subtitle={
                fileName && version != null
                  ? `Version ${version}`
                  : "Upload a PDF so teams can review it."
              }
            />
          </ListGroup>
          <Button
            label={fileName ? "Upload new version" : "Upload PDF"}
            icon="cloud-upload-outline"
            variant="outline"
            size="sm"
            loading={uploading}
            disabled={busy}
            onPress={() => void onUpload()}
          />
        </Section>

        <Section title="Requirement">
          <ListGroup>
            <SwitchRow
              label="Require waiver"
              description="Registered teams must complete the waiver before play."
              value={draft.enabled}
              onValueChange={(enabled) => edit({ enabled })}
            />
            {draft.enabled ? (
              <SwitchRow
                label="Block check-in until complete"
                description="Teams can't check in until every player has signed."
                value={draft.requiredBeforeCheckIn}
                onValueChange={(requiredBeforeCheckIn) =>
                  edit({ requiredBeforeCheckIn })
                }
              />
            ) : null}
          </ListGroup>
        </Section>

        {draft.enabled ? (
          <Section
            title="How teams complete it"
            description="Turn on every method you accept."
          >
            <ListGroup>
              <SwitchRow
                label="In-app acknowledgment"
                description="Each player signs digitally in brackt."
                value={draft.allowDigitalAck}
                onValueChange={(allowDigitalAck) => edit({ allowDigitalAck })}
              />
              <SwitchRow
                label="Download and print"
                description="Teams print the PDF and bring signed copies."
                value={draft.allowDownloadPrint}
                onValueChange={(allowDownloadPrint) => edit({ allowDownloadPrint })}
              />
              <SwitchRow
                label="Third-party signing link"
                description="Send players to an outside signing service."
                value={draft.allowThirdParty}
                onValueChange={(allowThirdParty) => edit({ allowThirdParty })}
              />
            </ListGroup>
            {draft.allowThirdParty ? (
              <FormField
                label="Signing link"
                hint="Must start with https://"
                colors={colors}
              >
                <FormTextInput
                  value={draft.thirdPartyUrl ?? ""}
                  onChangeText={(thirdPartyUrl) => edit({ thirdPartyUrl })}
                  autoCapitalize="none"
                  keyboardType="url"
                  placeholder="https://…"
                  accessibilityLabel="Third-party signing link"
                  colors={colors}
                />
              </FormField>
            ) : null}
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
        {notice ? (
          <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
        ) : null}
        <Button
          label="Save changes"
          fullWidth
          loading={busy}
          disabled={!dirty || uploading}
          onPress={() => void onSave()}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: "center" },
});
