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

import type {
  ChatReportReasonContract,
  TournamentChatMessageContract,
} from "@/lib/api/contracts/tournament-ops";
import { useEffect, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { blockUser, reportTournamentChatMessage } from "~/api/endpoints";
import { useThemeColors } from "~/theme/colors";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Card,
  HeaderButton,
  ListGroup,
  ListRow,
  Section,
  haptics,
  space,
} from "~/ui";

const REASONS: { id: ChatReportReasonContract; label: string; detail: string }[] = [
  { id: "harassment", label: "Harassment or bullying", detail: "Targets or threatens someone" },
  { id: "inappropriate", label: "Inappropriate content", detail: "Offensive, explicit, or hateful" },
  { id: "spam", label: "Spam", detail: "Ads, scams, or repeated messages" },
  { id: "other", label: "Something else", detail: "Doesn't belong in this chat" },
];

/**
 * Report and block for someone else's chat message. Blocking hides all of that
 * person's messages from the viewer; both actions reach the admin flags queue.
 */
export function ChatMessageActionsSheet({
  slug,
  message,
  onClose,
  onBlocked,
}: {
  slug: string;
  message: TournamentChatMessageContract | null;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const colors = useThemeColors();
  const [step, setStep] = useState<"menu" | "reasons" | "reported">("menu");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (message) {
      setStep("menu");
      setError(null);
      setBusy(null);
    }
  }, [message]);

  if (!message) return null;
  const target = message;

  async function report(reason: ChatReportReasonContract) {
    setBusy(reason);
    setError(null);
    try {
      await reportTournamentChatMessage(slug, { messageId: target.id, reason });
      haptics.success();
      setStep("reported");
    } catch (cause) {
      haptics.error();
      setError(messageFor(cause, "Could not send your report."));
    } finally {
      setBusy(null);
    }
  }

  function confirmBlock() {
    Alert.alert(
      `Block ${target.authorName}?`,
      "You won't see their messages in any tournament chat. They aren't notified. You can unblock them from your profile.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Block", style: "destructive", onPress: () => void block() },
      ]
    );
  }

  async function block() {
    setBusy("block");
    setError(null);
    try {
      await blockUser(target.authorUserId);
      haptics.success();
      onBlocked();
      onClose();
    } catch (cause) {
      haptics.error();
      setError(messageFor(cause, "Could not block this person."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.sheet, { backgroundColor: colors.background }]}
        edges={["top", "bottom"]}
      >
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {step === "reasons" ? (
              <HeaderButton label="Back" onPress={() => setStep("menu")} />
            ) : null}
          </View>
          <AppText variant="headline" accessibilityRole="header">
            {step === "reasons" ? "Report message" : "Message"}
          </AppText>
          <View style={[styles.headerSide, styles.headerSideEnd]}>
            <HeaderButton
              label={step === "reported" ? "Done" : "Cancel"}
              emphasis={step === "reported"}
              onPress={onClose}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Card>
            <AppText variant="footnote" tone="muted" weight="600">
              {target.authorName}
            </AppText>
            <AppText numberOfLines={6}>{target.body}</AppText>
          </Card>

          {error ? (
            <Banner tone="error" message={error} onDismiss={() => setError(null)} />
          ) : null}

          {step === "menu" ? (
            <ListGroup>
              <ListRow
                title="Report message"
                subtitle="Send it to the brackt team for review"
                icon="flag-outline"
                chevron
                disabled={busy !== null}
                onPress={() => setStep("reasons")}
              />
              <ListRow
                title={`Block ${target.authorName}`}
                subtitle="Hide all of their chat messages from you"
                icon="hand-left-outline"
                destructive
                disabled={busy !== null}
                onPress={confirmBlock}
              />
            </ListGroup>
          ) : null}

          {step === "reasons" ? (
            <Section title="Why are you reporting this?">
              <ListGroup>
                {REASONS.map((reason) => (
                  <ListRow
                    key={reason.id}
                    title={reason.label}
                    subtitle={busy === reason.id ? "Sending…" : reason.detail}
                    disabled={busy !== null}
                    onPress={() => void report(reason.id)}
                  />
                ))}
              </ListGroup>
            </Section>
          ) : null}

          {step === "reported" ? (
            <>
              <Banner
                tone="success"
                message="Thanks. The brackt team reviews every report and removes content that breaks the rules."
              />
              <ListGroup>
                <ListRow
                  title={`Also block ${target.authorName}`}
                  subtitle="Hide all of their chat messages from you"
                  icon="hand-left-outline"
                  destructive
                  disabled={busy !== null}
                  onPress={confirmBlock}
                />
              </ListGroup>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  headerSide: { flex: 1, flexDirection: "row" },
  headerSideEnd: { justifyContent: "flex-end" },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
});
