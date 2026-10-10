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
import { StyleSheet, View } from "react-native";
import { openExternalUrl } from "~/lib/links";
import {
  acknowledgeTournamentWaiver,
  downloadTournamentWaiverPdf,
  fetchTournamentWaiver,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import { waiverMethodLabel } from "~/lib/format";
import { shareDownloadedPdf } from "~/lib/share-pdf";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  haptics,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  space,
  SwitchRow,
} from "~/ui";

export default function WaiverScreen() {
  const colors = useThemeColors();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [signedName, setSignedName] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentWaiver(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load waiver details."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (data === null && error === null) return <LoadingScreen />;
  if (!data || !slug) {
    return (
      <ErrorScreen
        title="Waiver unavailable"
        message={error ?? "Could not load waiver details."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function run(
    key: string,
    action: () => Promise<void>,
    success?: string
  ) {
    setBusyKey(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      await action();
      if (success) {
        haptics.success();
        setActionSuccess(success);
        await refresh();
      }
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Something went wrong."));
    } finally {
      setBusyKey(null);
    }
  }

  const canDownload = data.settings.allowDownloadPrint && data.hasPdf;
  const externalUrl =
    data.settings.allowThirdParty && data.settings.thirdPartyUrl
      ? data.settings.thirdPartyUrl
      : null;

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <Card>
        <AppText variant="headline">
          {data.hasPdf ? `Waiver version ${data.version}` : "No waiver posted"}
        </AppText>
        <AppText variant="subhead" tone="muted">
          {data.hasPdf
            ? (data.fileName ?? "Read the waiver before you sign.")
            : "The host has not uploaded a waiver PDF yet."}
        </AppText>
        {canDownload || externalUrl ? (
          <View style={styles.actions}>
            {canDownload ? (
              <Button
                label="Download PDF"
                icon="download-outline"
                size="sm"
                variant="outline"
                loading={busyKey === "download"}
                disabled={busyKey !== null}
                onPress={() =>
                  void run("download", async () => {
                    await shareDownloadedPdf(
                      () => downloadTournamentWaiverPdf(slug),
                      `${slug}-waiver.pdf`
                    );
                  })
                }
              />
            ) : null}
            {externalUrl ? (
              <Button
                label="Sign externally"
                icon="open-outline"
                size="sm"
                variant="outline"
                onPress={() => void openExternalUrl(externalUrl)}
              />
            ) : null}
          </View>
        ) : null}
      </Card>

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
          icon="document-text-outline"
          title="No teams to track"
          message="Waiver progress appears here once your team is registered for this tournament."
        />
      ) : (
        data.teams.map((team) => {
          const myRow = team.roster.find((member) => member.isViewer);
          const canAck =
            data.settings.allowDigitalAck && myRow && !myRow.completed;
          const name = signedName[team.teamSlug] ?? "";
          const hasAgreed = agreed[team.teamSlug] ?? false;
          const ackKey = `ack-${team.teamSlug}`;

          return (
            <Section
              key={team.teamSlug}
              title={team.teamName}
              description={`${team.completedCount} of ${team.totalCount} signed`}
            >
              {team.complete ? (
                <Badge label="Ready for check-in" tone="success" />
              ) : null}

              {canAck ? (
                <Card style={styles.ack}>
                  <AppText variant="headline">Sign digitally</AppText>
                  <FormField
                    label="Full legal name"
                    hint="Type your name as your digital signature."
                    colors={colors}
                  >
                    <FormTextInput
                      value={name}
                      onChangeText={(value) =>
                        setSignedName((prev) => ({
                          ...prev,
                          [team.teamSlug]: value,
                        }))
                      }
                      placeholder="Full legal name"
                      autoCapitalize="words"
                      maxLength={120}
                      colors={colors}
                    />
                  </FormField>
                  <ListGroup>
                    <SwitchRow
                      label="I agree to the waiver"
                      description="I have read the waiver and agree to its terms."
                      value={hasAgreed}
                      onValueChange={(value) =>
                        setAgreed((prev) => ({ ...prev, [team.teamSlug]: value }))
                      }
                    />
                  </ListGroup>
                  <Button
                    label="Sign waiver"
                    icon="create-outline"
                    fullWidth
                    loading={busyKey === ackKey}
                    disabled={!hasAgreed || !name.trim() || busyKey !== null}
                    onPress={() =>
                      void run(
                        ackKey,
                        async () => {
                          await acknowledgeTournamentWaiver(slug, {
                            teamSlug: team.teamSlug,
                            signedName: name.trim(),
                          });
                        },
                        `Waiver signed for ${team.teamName}.`
                      )
                    }
                  />
                </Card>
              ) : null}

              {team.roster.length > 0 ? (
                <ListGroup>
                  {team.roster.map((member) => (
                    <ListRow
                      key={member.userId}
                      title={
                        member.isViewer ? `${member.fullName} (you)` : member.fullName
                      }
                      subtitle={[
                        member.role === "captain" ? "Captain" : null,
                        member.completed ? waiverMethodLabel(member.method) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      trailing={
                        <Badge
                          label={member.completed ? "Signed" : "Not signed"}
                          tone={member.completed ? "success" : "warning"}
                        />
                      }
                    />
                  ))}
                </ListGroup>
              ) : null}
            </Section>
          );
        })
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
    marginTop: space.xs,
  },
  ack: { gap: space.lg },
});
