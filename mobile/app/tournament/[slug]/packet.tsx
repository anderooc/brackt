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

import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  downloadTournamentPacketPdf,
  fetchTournamentPacket,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { goBackOrReplace } from "~/lib/navigation";
import { shareDownloadedPdf } from "~/lib/share-pdf";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  Card,
  EmptyState,
  haptics,
  ScreenScroll,
  Section,
  space,
} from "~/ui";

export default function PacketScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentPacket(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load the tournament packet."
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <View style={[styles.fill, styles.centered, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="link-outline"
          title="Tournament unavailable"
          message="This packet link is missing its tournament."
          action={{
            label: "Go back",
            icon: "chevron-back",
            onPress: () => goBackOrReplace(router, "/"),
          }}
        />
      </View>
    );
  }
  if (data === null && error === null) return <LoadingScreen />;
  if (!data) {
    return (
      <ErrorScreen
        title="Packet unavailable"
        message={error ?? "Could not load the tournament packet."}
        onRetry={() => void refresh()}
      />
    );
  }

  async function onDownload() {
    setBusy(true);
    setActionError(null);
    try {
      await shareDownloadedPdf(
        () => downloadTournamentPacketPdf(slug!),
        `${slug}-packet.pdf`
      );
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not download the packet."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      <Card>
        <AppText variant="headline">Tournament packet</AppText>
        <AppText variant="subhead" tone="muted">
          Rules, schedule, and day-of logistics in one PDF.
        </AppText>
        <Button
          label="Download PDF"
          icon="download-outline"
          fullWidth
          loading={busy}
          onPress={() => void onDownload()}
          style={styles.download}
        />
      </Card>

      {actionError ? (
        <Banner
          tone="error"
          message={actionError}
          action={{ label: "Try again", onPress: () => void onDownload() }}
          onDismiss={() => setActionError(null)}
        />
      ) : null}

      {data.notes ? (
        <Section title="Logistics notes">
          <Card>
            <AppText>{data.notes}</AppText>
          </Card>
        </Section>
      ) : (
        <EmptyState
          compact
          icon="reader-outline"
          title="No logistics notes yet"
          message="The host hasn't posted day-of notes. Check back closer to the tournament."
        />
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: "center" },
  download: { marginTop: space.sm },
});
