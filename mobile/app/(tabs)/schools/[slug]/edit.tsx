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
import { useCallback, useEffect, useState } from "react";

import { fetchSchool, updateSchool } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  ChipPicker,
  FormField,
  FormSubmitButton,
  FormTextInput,
} from "~/components/create-form";
import {
  GENDER_LABELS,
  REGION_LABELS,
  TEAM_GENDER_VALUES,
  TEAM_REGION_VALUES,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import { AppText, Banner, ScreenScroll, haptics } from "~/ui";

export default function EditSchoolScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session, isLoading: sessionLoading } = useSession();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [domainHint, setDomainHint] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    const school = await fetchSchool(slug ?? "", signal);
    if (!school.viewer.canManageSchool) {
      throw new Error("Only the school president can edit details.");
    }
    setName(school.name);
    setUniversity(school.university);
    setGender(school.gender);
    setRegion(school.region);
    setDomainHint(school.domainHint ?? "");
    setWebsiteUrl(school.websiteUrl ?? "");
    setDescription(school.description ?? "");
    setReady(true);
  }, [slug]);

  useEffect(() => {
    if (!session || !slug) return;
    const controller = new AbortController();
    void load(controller.signal).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(messageFor(cause, "Could not load school."));
      setReady(true);
    });
    return () => controller.abort();
  }, [session, slug, load]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!slug) {
    return (
      <ErrorScreen
        title="School unavailable"
        message="This link is missing the school. Go back and pick a school from the list."
      />
    );
  }
  if (!ready && !error) return <LoadingScreen />;
  if (error && !ready) {
    return (
      <ErrorScreen
        title="Could not edit school"
        message={error}
        onRetry={() => {
          setError(null);
          setReady(false);
          void load();
        }}
      />
    );
  }

  async function onSubmit() {
    if (!gender || !region) {
      setError("Select gender and region.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateSchool(slug!, {
        name: name.trim(),
        university: university.trim(),
        gender,
        region,
        domainHint: domainHint.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        description: description.trim() || null,
      });
      haptics.success();
      router.dismissTo(`/schools/${result.slug}`);
    } catch (cause) {
      setError(messageFor(cause, "Could not save changes."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  const valid =
    name.trim().length > 0 &&
    university.trim().length > 0 &&
    gender != null &&
    region != null;

  return (
    <ScreenScroll gap={20}>
      <AppText variant="callout" tone="muted">
        Renaming the school updates its URL. Existing teams keep their gender and
        region; only new teams inherit the values below.
      </AppText>

      <FormField label="School / club name" colors={colors}>
        <FormTextInput
          value={name}
          onChangeText={setName}
          placeholder="State University Volleyball Club"
          colors={colors}
          maxLength={120}
          autoCapitalize="words"
          returnKeyType="next"
        />
      </FormField>

      <FormField label="University" colors={colors}>
        <FormTextInput
          value={university}
          onChangeText={setUniversity}
          placeholder="State University"
          colors={colors}
          maxLength={120}
          autoCapitalize="words"
        />
      </FormField>

      <FormField label="Gender" colors={colors}>
        <ChipPicker
          options={TEAM_GENDER_VALUES}
          value={gender}
          onChange={setGender}
          colors={colors}
          labels={GENDER_LABELS}
        />
      </FormField>

      <FormField label="Region" colors={colors}>
        <ChipPicker
          options={TEAM_REGION_VALUES}
          value={region}
          onChange={setRegion}
          colors={colors}
          labels={REGION_LABELS}
        />
      </FormField>

      <FormField
        label="Institutional email domain"
        hint="Officers' emails ending with this domain will auto-flag your verification submission."
        colors={colors}
      >
        <FormTextInput
          value={domainHint}
          onChangeText={setDomainHint}
          placeholder="state.edu"
          colors={colors}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={120}
        />
      </FormField>

      <FormField label="Website (optional)" colors={colors}>
        <FormTextInput
          value={websiteUrl}
          onChangeText={setWebsiteUrl}
          placeholder="https://stateu-volleyball.org"
          colors={colors}
          keyboardType="url"
          autoCapitalize="none"
          maxLength={200}
        />
      </FormField>

      <FormField label="Description (optional)" colors={colors}>
        <FormTextInput
          value={description}
          onChangeText={setDescription}
          placeholder="A few sentences about your club…"
          colors={colors}
          multiline
          maxLength={2000}
        />
      </FormField>

      {error ? <Banner tone="error" message={error} /> : null}

      <FormSubmitButton
        label="Save changes"
        busy={busy}
        disabled={!valid}
        onPress={() => void onSubmit()}
        colors={colors}
      />
    </ScreenScroll>
  );
}
