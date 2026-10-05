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

import type { ViewerContract } from "@/lib/api/contracts/viewer";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Image, Linking, StyleSheet, View } from "react-native";
import { API_BASE_URL } from "~/api/config";
import { ApiClientError } from "~/api/client";
import { fetchViewer } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  USER_PLAYER_GENDER_LABELS,
  VOLLEYBALL_POSITION_LABELS,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import {
  AppText,
  Badge,
  Banner,
  Button,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  Skeleton,
  haptics,
  radius,
  space,
} from "~/ui";

const AVATAR_SIZE = 72;

export default function ProfileScreen() {
  const router = useRouter();
  const { session, isLoading, signOut } = useSession();
  const [viewer, setViewer] = useState<ViewerContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      setViewer(await fetchViewer(signal));
    } catch (cause) {
      if (signal?.aborted) return;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not load your profile."
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const controller = new AbortController();
      void load(controller.signal);
      return () => controller.abort();
    }, [session, load])
  );

  if (isLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;

  if (!viewer && error) {
    return (
      <ErrorScreen
        title="Couldn't load your profile"
        message={error}
        onRetry={() => void load()}
      />
    );
  }

  function confirmSignOut() {
    Alert.alert(
      "Sign out?",
      "You'll need to sign in again to manage your teams and tournaments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            setIsSigningOut(true);
            try {
              await signOut();
            } catch {
              haptics.error();
              setIsSigningOut(false);
              Alert.alert("Couldn't sign out", "Check your connection and try again.");
            }
          },
        },
      ]
    );
  }

  const school = viewer ? (viewer.displaySchool ?? viewer.university) : null;

  return (
    <ScreenScroll
      refreshing={isRefreshing}
      onRefresh={async () => {
        setIsRefreshing(true);
        await load();
        setIsRefreshing(false);
      }}
    >
      {viewer ? (
        <View style={styles.hero}>
          <ProfileAvatar uri={viewer.avatarUrl} name={viewer.fullName} />
          <View style={styles.heroText}>
            <AppText variant="title" numberOfLines={2}>
              {viewer.fullName}
            </AppText>
            <AppText variant="subhead" tone="muted" numberOfLines={1}>
              {viewer.displayEmail ?? viewer.email}
            </AppText>
            {school ? (
              <AppText variant="subhead" tone="muted" numberOfLines={1}>
                {school}
              </AppText>
            ) : null}
            <View style={styles.heroBadges}>
              <Badge label={roleLabel(viewer.role)} tone="neutral" />
            </View>
          </View>
        </View>
      ) : (
        <HeroSkeleton />
      )}

      {viewer && error ? (
        <Banner
          tone="error"
          message={error}
          action={{ label: "Try again", onPress: () => void load() }}
          onDismiss={() => setError(null)}
        />
      ) : null}

      {viewer ? (
        <Section title="Player details">
          <ListGroup>
            <DetailRow
              label="Gender"
              value={
                viewer.playerGender
                  ? (USER_PLAYER_GENDER_LABELS[viewer.playerGender] ??
                    viewer.playerGender)
                  : null
              }
            />
            <DetailRow
              label="Position"
              value={
                viewer.volleyballPosition
                  ? (VOLLEYBALL_POSITION_LABELS[viewer.volleyballPosition] ??
                    viewer.volleyballPosition)
                  : null
              }
            />
            <DetailRow
              label="Jersey number"
              value={viewer.jerseyNumber?.toString() ?? null}
            />
          </ListGroup>
        </Section>
      ) : null}

      <Section title="Account">
        <ListGroup>
          <ListRow
            title="Edit profile"
            subtitle="Name, photo, and player details"
            icon="person-circle-outline"
            onPress={() => router.push("/profile/edit")}
          />
          <ListRow
            title="Change password"
            icon="key-outline"
            onPress={() => router.push("/profile/password")}
          />
        </ListGroup>
      </Section>

      <Section title="Activity">
        <ListGroup>
          <ListRow
            title="My schedule"
            subtitle="Your upcoming matches across tournaments"
            icon="calendar-outline"
            onPress={() => router.push("/my-schedule")}
          />
          <ListRow
            title="Notifications"
            icon="notifications-outline"
            onPress={() => router.push("/notifications")}
          />
        </ListGroup>
      </Section>

      <Section title="About">
        <ListGroup>
          <ListRow
            title="Privacy notice"
            icon="shield-checkmark-outline"
            iconTone="muted"
            accessibilityHint="Opens in your browser"
            trailing={<Icon name="open-outline" size={18} tone="muted" />}
            chevron={false}
            onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)}
          />
          <ListRow
            title="Terms of use"
            icon="document-text-outline"
            iconTone="muted"
            accessibilityHint="Opens in your browser"
            trailing={<Icon name="open-outline" size={18} tone="muted" />}
            chevron={false}
            onPress={() => void Linking.openURL(`${API_BASE_URL}/terms`)}
          />
        </ListGroup>
      </Section>

      <Section title="Danger zone">
        <ListGroup>
          <ListRow
            title="Delete account"
            subtitle="Permanently remove your account and personal data"
            icon="trash-outline"
            destructive
            onPress={() => router.push("/profile/delete-account")}
          />
        </ListGroup>
      </Section>

      <Button
        label="Sign out"
        icon="log-out-outline"
        variant="destructiveOutline"
        loading={isSigningOut}
        onPress={confirmSignOut}
        fullWidth
      />
    </ScreenScroll>
  );
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <ListRow
      title={label}
      trailing={
        <AppText variant="callout" tone={value ? "default" : "muted"}>
          {value ?? "Not set"}
        </AppText>
      }
    />
  );
}

function ProfileAvatar({ uri, name }: { uri: string | null; name: string }) {
  const colors = useThemeColors();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.avatar, { backgroundColor: colors.muted }]}
        accessibilityLabel="Profile photo"
      />
    );
  }
  return (
    <View
      style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.muted }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      <AppText variant="title" tone="muted">
        {initials(name)}
      </AppText>
    </View>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

function HeroSkeleton() {
  return (
    <View style={styles.hero} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <Skeleton width={AVATAR_SIZE} height={AVATAR_SIZE} rounded={radius.full} />
      <View style={styles.heroText}>
        <Skeleton width="60%" height={22} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="45%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: space.lg },
  heroText: { flex: 1, minWidth: 0, gap: space.xxs },
  heroBadges: { flexDirection: "row", marginTop: space.xs },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radius.full,
  },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
});
