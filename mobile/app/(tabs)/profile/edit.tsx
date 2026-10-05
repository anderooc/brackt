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

import { Redirect, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { ApiClientError } from "~/api/client";
import {
  fetchViewer,
  removeProfileAvatar,
  updateProfile,
  uploadProfileAvatar,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  USER_PLAYER_GENDERS,
  USER_PLAYER_GENDER_LABELS,
  VOLLEYBALL_POSITIONS,
  VOLLEYBALL_POSITION_LABELS,
} from "~/lib/format";
import { goBackOrReplace } from "~/lib/navigation";
import { FormField, FormSubmitButton, FormTextInput } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  Chip,
  ChipRow,
  Icon,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  haptics,
  space,
} from "~/ui";

export default function EditProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [playerGender, setPlayerGender] = useState<string | null>(null);
  const [volleyballPosition, setVolleyballPosition] = useState<string | null>(
    null
  );
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [displayEmail, setDisplayEmail] = useState<string | null>(null);
  const [displaySchool, setDisplaySchool] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const viewer = await fetchViewer(signal);
    setFullName(viewer.fullName);
    setPlayerGender(viewer.playerGender);
    setVolleyballPosition(viewer.volleyballPosition);
    setJerseyNumber(
      viewer.jerseyNumber == null ? "" : String(viewer.jerseyNumber)
    );
    setDisplayEmail(viewer.displayEmail ?? viewer.email);
    setDisplaySchool(viewer.displaySchool ?? viewer.university);
    setAvatarUrl(viewer.avatarUrl);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Could not load your profile."
      );
    });
    return () => controller.abort();
  }, [session, load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!ready && !error) return <LoadingScreen />;
  if (!ready) {
    return (
      <ErrorScreen
        title="Couldn’t load your profile"
        message={error ?? "Please try again."}
        onRetry={() => {
          setError(null);
          void load().catch((cause: unknown) =>
            setError(messageFor(cause, "Could not load your profile."))
          );
        }}
      />
    );
  }

  async function onSave() {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({
        fullName: fullName.trim(),
        playerGender,
        volleyballPosition,
        jerseyNumber: jerseyNumber.trim() === "" ? null : jerseyNumber.trim(),
      });
      haptics.success();
      goBackOrReplace(router, "/profile");
    } catch (cause) {
      setError(messageFor(cause, "Could not save profile."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  async function onPickAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return;
      // Server caps avatars at 2 MB and only accepts JPEG/PNG/WebP.
      const context = ImageManipulator.manipulate(picked.assets[0].uri);
      context.resize({ width: 512 });
      const image = await context.renderAsync();
      const result = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.8,
        base64: true,
      });
      if (!result.base64) throw new Error("Could not read the selected photo.");
      const viewer = await uploadProfileAvatar({
        base64: result.base64,
        contentType: "image/jpeg",
      });
      setAvatarUrl(viewer.avatarUrl);
      haptics.success();
    } catch (cause) {
      setAvatarError(messageFor(cause, "Could not update profile photo."));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    setAvatarBusy(true);
    setAvatarError(null);
    try {
      await removeProfileAvatar();
      setAvatarUrl(null);
    } catch (cause) {
      setAvatarError(messageFor(cause, "Could not remove profile photo."));
    } finally {
      setAvatarBusy(false);
    }
  }

  function confirmRemoveAvatar() {
    Alert.alert("Remove profile photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => void onRemoveAvatar() },
    ]);
  }

  return (
    <ScreenScroll gap={space.xxl}>
      <View style={styles.avatarBlock}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            accessibilityLabel="Profile photo"
          />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.muted }]}>
            <Icon name="person" size={40} tone="muted" />
          </View>
        )}
        <View style={styles.avatarActions}>
          <Button
            label={avatarUrl ? "Change photo" : "Add photo"}
            icon="camera-outline"
            variant="outline"
            size="sm"
            loading={avatarBusy}
            disabled={busy}
            onPress={() => void onPickAvatar()}
          />
          {avatarUrl ? (
            <Button
              label="Remove"
              variant="ghost"
              size="sm"
              disabled={avatarBusy || busy}
              onPress={confirmRemoveAvatar}
            />
          ) : null}
        </View>
        {avatarError ? (
          <Banner tone="error" message={avatarError} onDismiss={() => setAvatarError(null)} />
        ) : null}
      </View>

      <Section title="Player details">
        <FormField label="Display name" colors={colors}>
          <FormTextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            autoComplete="name"
            textContentType="name"
            autoCapitalize="words"
            maxLength={120}
            colors={colors}
          />
        </FormField>

        <FormField label="Gender" colors={colors}>
          <ChipRow>
            <Chip
              label="Not set"
              selected={playerGender === null}
              onPress={() => setPlayerGender(null)}
            />
            {USER_PLAYER_GENDERS.map((value) => (
              <Chip
                key={value}
                label={USER_PLAYER_GENDER_LABELS[value]}
                selected={playerGender === value}
                onPress={() => setPlayerGender(value)}
              />
            ))}
          </ChipRow>
        </FormField>

        <FormField label="Position" colors={colors}>
          <ChipRow>
            <Chip
              label="Not set"
              selected={volleyballPosition === null}
              onPress={() => setVolleyballPosition(null)}
            />
            {VOLLEYBALL_POSITIONS.map((value) => (
              <Chip
                key={value}
                label={VOLLEYBALL_POSITION_LABELS[value]}
                selected={volleyballPosition === value}
                onPress={() => setVolleyballPosition(value)}
              />
            ))}
          </ChipRow>
        </FormField>

        <FormField
          label="Jersey number"
          hint="0–99. Shown on every team and school roster you join."
          colors={colors}
        >
          <FormTextInput
            value={jerseyNumber}
            onChangeText={setJerseyNumber}
            placeholder="e.g. 7"
            keyboardType="number-pad"
            maxLength={2}
            returnKeyType="done"
            colors={colors}
            style={styles.jersey}
          />
        </FormField>
      </Section>

      <Section title="Account" description="Your email and school are set by your account and school membership.">
        <ListGroup>
          <ListRow icon="mail-outline" iconTone="secondary" title={displayEmail ?? "No email"} subtitle="Email" />
          <ListRow icon="school-outline" iconTone="secondary" title={displaySchool ?? "No school"} subtitle="School" />
        </ListGroup>
      </Section>

      {error ? <Banner tone="error" message={error} onDismiss={() => setError(null)} /> : null}

      <FormSubmitButton
        label="Save profile"
        busy={busy}
        disabled={!fullName.trim() || avatarBusy}
        onPress={() => void onSave()}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { alignItems: "center", gap: space.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarActions: { flexDirection: "row", gap: space.sm },
  jersey: { width: 96 },
});
