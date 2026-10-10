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

import { Redirect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import {
  deleteTournament,
  duplicateTournament,
  fetchTournament,
  updateTournamentHostListing,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormSubmitButton, FormTextInput } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import {
  AppText,
  Banner,
  Button,
  Card,
  ScreenScroll,
  Section,
  haptics,
  space,
} from "~/ui";

export default function TournamentHostDetailsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session, isLoading: sessionLoading } = useSession();

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [dangerError, setDangerError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Name and listing" });
  }, [navigation]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const tournament = await fetchTournament(slug ?? "", signal);
      setOriginalName(tournament.name);
      setName(tournament.name);
      setLocation(tournament.location);
      setAddress(tournament.address ?? "");
      setDescription(tournament.description ?? "");
      setReady(true);
    },
    [slug]
  );

  useEffect(() => {
    if (!session || !slug) return;
    const controller = new AbortController();
    void load(controller.signal).catch((cause) => {
      if (controller.signal.aborted) return;
      setLoadError(messageFor(cause, "Could not load this tournament."));
    });
    return () => controller.abort();
  }, [session, slug, load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (loadError && !ready) {
    return (
      <ErrorScreen
        title="Tournament unavailable"
        message={loadError}
        onRetry={() => {
          setLoadError(null);
          void load().catch((cause) =>
            setLoadError(messageFor(cause, "Could not load this tournament."))
          );
        }}
      />
    );
  }
  if (!ready || !slug) return <LoadingScreen rows={4} />;

  async function onSave() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const result = await updateTournamentHostListing(slug!, {
        name: name.trim(),
        description,
        location,
        address,
      });
      haptics.success();
      setOriginalName(name.trim());
      if (result.slug !== slug) {
        // Renaming changes the URL; screens below still point at the old one.
        router.dismissAll();
        router.push(`/tournament/${result.slug}/host`);
        return;
      }
      setSaved(true);
    } catch (cause) {
      haptics.error();
      setSaveError(messageFor(cause, "Could not save changes."));
    } finally {
      setSaving(false);
    }
  }

  function confirmDuplicate() {
    Alert.alert(
      "Duplicate tournament?",
      "Creates a new draft with the same listing, pools, and courts. Teams, matches, payments, and the waiver file aren't copied.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Duplicate", onPress: () => void onDuplicate() },
      ]
    );
  }

  async function onDuplicate() {
    setDuplicating(true);
    setDangerError(null);
    try {
      const created = await duplicateTournament(slug!);
      haptics.success();
      router.push(`/tournament/${created.slug}/host`);
    } catch (cause) {
      haptics.error();
      setDangerError(messageFor(cause, "Could not duplicate this tournament."));
    } finally {
      setDuplicating(false);
    }
  }

  async function onDelete() {
    setDeleting(true);
    setDangerError(null);
    try {
      await deleteTournament(slug!, deleteText);
      haptics.success();
      router.dismissAll();
      router.navigate("/tournaments");
    } catch (cause) {
      haptics.error();
      setDangerError(messageFor(cause, "Could not delete this tournament."));
      setDeleting(false);
    }
  }

  const valid = name.trim().length > 0 && location.trim().length > 0;
  const deleteMatches = deleteText.trim() === originalName.trim();

  return (
    <ScreenScroll>
      <Section title="Listing" description="What teams see when they browse tournaments.">
        <FormField label="Tournament name" colors={colors}>
          <FormTextInput value={name} onChangeText={setName} colors={colors} />
        </FormField>
        <FormField label="Venue" hint="e.g. Recreation Center" colors={colors}>
          <FormTextInput value={location} onChangeText={setLocation} colors={colors} />
        </FormField>
        <FormField label="Address" hint="Used for the map link" colors={colors}>
          <FormTextInput value={address} onChangeText={setAddress} colors={colors} />
        </FormField>
        <FormField label="Description" colors={colors}>
          <FormTextInput
            value={description}
            onChangeText={setDescription}
            multiline
            colors={colors}
          />
        </FormField>
        {saveError ? <Banner tone="error" message={saveError} /> : null}
        {saved ? (
          <Banner tone="success" message="Saved." onDismiss={() => setSaved(false)} />
        ) : null}
        <FormSubmitButton
          label="Save changes"
          busy={saving}
          disabled={!valid}
          onPress={() => void onSave()}
        />
      </Section>

      <Section
        title="Run it again"
        description="Start next season's event from this one's setup."
      >
        <Button
          label="Duplicate as draft"
          icon="copy-outline"
          variant="outline"
          loading={duplicating}
          onPress={confirmDuplicate}
        />
      </Section>

      <Section title="Delete tournament">
        <Card style={styles.danger}>
          <AppText variant="subhead" tone="muted">
            Permanently removes the tournament, its registrations, matches, and
            results. This can&apos;t be undone. Type{" "}
            <AppText variant="subhead" weight="600">
              {originalName}
            </AppText>{" "}
            to confirm.
          </AppText>
          <FormTextInput
            value={deleteText}
            onChangeText={setDeleteText}
            placeholder={originalName}
            accessibilityLabel="Type the tournament name to confirm"
            autoCapitalize="none"
            autoCorrect={false}
            colors={colors}
          />
          <Button
            label="Delete tournament"
            variant="destructive"
            loading={deleting}
            disabled={!deleteMatches}
            onPress={() => void onDelete()}
          />
        </Card>
        {dangerError ? <Banner tone="error" message={dangerError} /> : null}
      </Section>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  danger: { gap: space.md },
});
