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

import type { CreateOptionsContract } from "@/lib/api/contracts/create-options";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createTeam, fetchCreateOptions } from "~/api/endpoints";
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
import { LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import { AppText, Banner, Card, Icon, ListGroup, ListRow, ScreenScroll, haptics } from "~/ui";

const STANDALONE = "__standalone__";

export default function CreateTeamScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { schoolSlug: preselectedSchoolSlug } = useLocalSearchParams<{
    schoolSlug?: string;
  }>();
  const { session, isLoading: sessionLoading } = useSession();
  const [options, setOptions] = useState<CreateOptionsContract | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState(STANDALONE);
  const [name, setName] = useState("");
  const [university, setUniversity] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const next = await fetchCreateOptions(signal);
    setOptions(next);
    if (
      preselectedSchoolSlug &&
      next.manageableSchools.some(
        (school) => school.slug === preselectedSchoolSlug
      )
    ) {
      const match = next.manageableSchools.find(
        (school) => school.slug === preselectedSchoolSlug
      );
      if (match) setSelectedSchoolId(match.id);
    }
    setReady(true);
  }, [preselectedSchoolSlug]);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    void load(controller.signal).catch((cause) => {
      if (controller.signal.aborted) return;
      setError(messageFor(cause, "Could not load create options."));
      setReady(true);
    });
    return () => controller.abort();
  }, [session, load]);

  const selectedSchool = useMemo(
    () =>
      selectedSchoolId === STANDALONE
        ? null
        : options?.manageableSchools.find(
            (school) => school.id === selectedSchoolId
          ) ?? null,
    [options, selectedSchoolId]
  );

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!ready) return <LoadingScreen />;

  async function onSubmit() {
    const teamGender = selectedSchool?.gender ?? gender;
    const teamRegion = selectedSchool?.region ?? region;
    if (!teamGender || !teamRegion) {
      setError("Select gender and region.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await createTeam({
        name: name.trim(),
        gender: teamGender,
        region: teamRegion,
        schoolId: selectedSchool?.id ?? null,
        university: selectedSchool ? undefined : university.trim(),
      });
      haptics.success();
      router.replace(`/teams/${result.slug}`);
    } catch (cause) {
      setError(messageFor(cause, "Could not create team."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  const valid =
    name.trim().length > 0 &&
    (selectedSchool != null ||
      (gender != null && region != null && university.trim().length > 0));

  return (
    <ScreenScroll gap={20}>
      <AppText variant="callout" tone="muted">
        You’ll be added as captain. Teams linked to a school use the school’s
        gender and region.
      </AppText>

      <FormField label="School" colors={colors}>
        {options?.manageableSchools.length === 0 ? (
          <AppText variant="subhead" tone="muted">
            You’re not a president or officer of any school yet. You can still
            create a standalone team by entering your university below.
          </AppText>
        ) : (
          <ListGroup>
            <SchoolOption
              label="No school (standalone team)"
              selected={selectedSchoolId === STANDALONE}
              onPress={() => setSelectedSchoolId(STANDALONE)}
            />
            {options?.manageableSchools.map((school) => (
              <SchoolOption
                key={school.id}
                label={school.name}
                selected={selectedSchoolId === school.id}
                onPress={() => setSelectedSchoolId(school.id)}
              />
            ))}
          </ListGroup>
        )}
      </FormField>

      <FormField label="Team name" colors={colors}>
        <FormTextInput
          value={name}
          onChangeText={setName}
          placeholder="Club Volleyball A"
          autoCapitalize="words"
          maxLength={120}
          colors={colors}
        />
      </FormField>

      {selectedSchool ? (
        <Card>
          <AppText variant="subhead" weight="600">
            {GENDER_LABELS[selectedSchool.gender]} · {REGION_LABELS[selectedSchool.region]}
          </AppText>
          <AppText variant="footnote" tone="muted">
            Gender and region come from {selectedSchool.name}.
          </AppText>
        </Card>
      ) : (
        <>
          <FormField label="University" colors={colors}>
            <FormTextInput
              value={university}
              onChangeText={setUniversity}
              placeholder="State University"
              autoCapitalize="words"
              maxLength={120}
              colors={colors}
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
          <Banner
            tone="info"
            message="Standalone teams need admin approval before they can register for tournaments."
          />
        </>
      )}

      {error ? <Banner tone="error" message={error} /> : null}

      <FormSubmitButton
        label="Create team"
        busy={busy}
        disabled={!valid}
        onPress={() => void onSubmit()}
      />
    </ScreenScroll>
  );
}

function SchoolOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <ListRow
      title={label}
      onPress={onPress}
      chevron={false}
      accessibilityLabel={`${label}${selected ? ", selected" : ""}`}
      trailing={
        <Icon
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          tone={selected ? "primary" : "muted"}
        />
      }
    />
  );
}
