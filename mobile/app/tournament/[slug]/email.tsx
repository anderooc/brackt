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
  fetchTournamentEmail,
  previewTournamentEmail,
  sendTournamentEmail,
  sendTournamentWaiverReminder,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import { EMAIL_AUDIENCE_OPTIONS, formatRelativeTime } from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  BottomBar,
  Button,
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

function captainsLabel(count: number): string {
  return `${count} captain${count === 1 ? "" : "s"}`;
}

export default function EmailScreen() {
  const colors = useThemeColors();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [audience, setAudience] = useState<string>("captains_confirmed");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentEmail(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load email tools."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (data === null && error === null) return <LoadingScreen />;
  if (!data || !slug) {
    return (
      <ErrorScreen
        title="Email unavailable"
        message={error ?? "Could not load email tools."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function run(
    key: string,
    action: () => Promise<string | null>,
    refreshAfter = true
  ) {
    setBusy(key);
    setActionError(null);
    setActionSuccess(null);
    try {
      const success = await action();
      if (success) {
        haptics.success();
        setActionSuccess(success);
      }
      if (refreshAfter) await refresh();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Something went wrong."));
    } finally {
      setBusy(null);
    }
  }

  async function onPreview() {
    await run(
      "preview",
      async () => {
        const result = await previewTournamentEmail(slug!, audience);
        setPreview(
          `${result.recipientCount} recipient${result.recipientCount === 1 ? "" : "s"} · ${result.audienceLabel}`
        );
        return null;
      },
      false
    );
  }

  async function onSendPress() {
    setBusy("send");
    setActionError(null);
    setActionSuccess(null);
    let count: number;
    let audienceLabel: string;
    try {
      const result = await previewTournamentEmail(slug!, audience);
      count = result.recipientCount;
      audienceLabel = result.audienceLabel;
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not count recipients."));
      setBusy(null);
      return;
    }
    setBusy(null);

    if (count === 0) {
      haptics.warning();
      setActionError(`No captains match “${audienceLabel}”. Pick another audience.`);
      return;
    }

    Alert.alert(
      `Send to ${captainsLabel(count)}?`,
      `“${subject.trim()}” will be emailed to ${audienceLabel.toLowerCase()}. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () =>
            void run("send", async () => {
              const result = await sendTournamentEmail(slug!, {
                audience,
                subject,
                body,
              });
              setSubject("");
              setBody("");
              setPreview(null);
              return `Email sent to ${captainsLabel(result.recipientCount)}.`;
            }),
        },
      ]
    );
  }

  function onWaiverReminder() {
    Alert.alert(
      "Send waiver reminder?",
      "Captains of teams with unsigned waivers will get an email reminder.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send reminder",
          onPress: () =>
            void run("waiver", async () => {
              const result = await sendTournamentWaiverReminder(slug!);
              return `Waiver reminder sent to ${captainsLabel(result.recipientCount)}.`;
            }),
        },
      ]
    );
  }

  const locked = !data.canSend;
  const canSend =
    !locked && busy === null && subject.trim().length > 0 && body.trim().length > 0;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
        <AppText variant="subhead" tone="muted">
          Send updates to registered team captains. Daily send limits apply.
        </AppText>

        {locked && data.lockedReason ? (
          <Banner tone="warning" title="Sending paused" message={data.lockedReason} />
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

        <View style={styles.form}>
          <FormField
            label="Recipients"
            hint={preview ?? undefined}
            colors={colors}
          >
            <ChipRow>
              {EMAIL_AUDIENCE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={audience === option.value}
                  disabled={locked}
                  onPress={() => {
                    setAudience(option.value);
                    setPreview(null);
                  }}
                />
              ))}
            </ChipRow>
            <Button
              label="Count recipients"
              icon="people-outline"
              size="sm"
              variant="ghost"
              loading={busy === "preview"}
              disabled={locked || busy !== null}
              onPress={() => void onPreview()}
            />
          </FormField>

          <FormField label="Subject" colors={colors}>
            <FormTextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Check-in moved to 8:00 AM"
              autoCapitalize="sentences"
              maxLength={200}
              editable={!locked}
              accessibilityLabel="Subject"
              colors={colors}
            />
          </FormField>

          <FormField label="Message" colors={colors}>
            <FormTextInput
              value={body}
              onChangeText={setBody}
              placeholder="Write your update"
              multiline
              autoCapitalize="sentences"
              editable={!locked}
              accessibilityLabel="Message"
              colors={colors}
              style={styles.textarea}
            />
          </FormField>
        </View>

        {data.waiverEnabled ? (
          <Section
            title="Waiver reminder"
            description="Email captains whose teams still have unsigned waivers."
          >
            <Button
              label="Send waiver reminder"
              icon="document-text-outline"
              variant="outline"
              size="sm"
              loading={busy === "waiver"}
              disabled={locked || busy !== null}
              onPress={onWaiverReminder}
            />
          </Section>
        ) : null}

        <Section title="Recent sends">
          {data.history.length === 0 ? (
            <EmptyState
              compact
              icon="mail-outline"
              title="No emails sent yet"
              message="Emails you send from here will be listed with their recipient count."
            />
          ) : (
            <ListGroup>
              {data.history.map((row) => (
                <ListRow
                  key={row.id}
                  icon="mail-outline"
                  iconTone="muted"
                  title={row.subject}
                  numberOfLines={1}
                  subtitle={`${row.recipientCount} recipient${row.recipientCount === 1 ? "" : "s"} · ${formatRelativeTime(row.sentAt)}`}
                />
              ))}
            </ListGroup>
          )}
        </Section>
      </ScreenScroll>

      <BottomBar>
        <Button
          label="Send email"
          icon="paper-plane-outline"
          fullWidth
          loading={busy === "send"}
          disabled={!canSend}
          onPress={() => void onSendPress()}
        />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  form: { gap: space.xl },
  textarea: { minHeight: 160 },
});
