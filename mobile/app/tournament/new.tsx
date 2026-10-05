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
import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { createTournament, fetchCreateOptions } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  ChipPicker,
  FormField,
  FormSubmitButton,
  FormTextInput,
} from "~/components/create-form";
import {
  formatCalendarDate,
  GENDER_LABELS,
  PLAY_FORMAT_DESCRIPTIONS,
  PLAY_FORMAT_LABELS,
  PLAY_FORMAT_VALUES,
  REGION_LABELS,
  todayISO,
} from "~/lib/format";
import { useThemeColors } from "~/theme/colors";
import { MonthCalendar } from "~/tournament/month-calendar";
import { LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import {
  Banner,
  EmptyState,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  haptics,
} from "~/ui";

const NO_MARKS: ReadonlySet<string> = new Set();

function monthOf(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return { year: year!, monthIndex: month! - 1 };
}

export default function CreateTournamentScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading: sessionLoading } = useSession();
  const [ready, setReady] = useState(false);
  const [hostSchool, setHostSchool] = useState<
    Awaited<ReturnType<typeof fetchCreateOptions>>["hostingSchool"]
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [playFormat, setPlayFormat] = useState<string>("pool_to_bracket");
  const [date, setDate] = useState(todayISO);
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthOf(todayISO()));
  const today = useMemo(() => todayISO(), []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const options = await fetchCreateOptions(signal);
    setHostSchool(options.hostingSchool);
    setReady(true);
  }, []);

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

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!ready) return <LoadingScreen />;

  async function onSubmit() {
    if (!hostSchool) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createTournament({
        hostSchoolId: hostSchool.id,
        name: name.trim(),
        description: description.trim() || undefined,
        date: date.trim(),
        location: location.trim(),
        address: address.trim() || undefined,
        playFormat,
      });
      haptics.success();
      router.replace(`/tournament/${result.slug}`);
    } catch (cause) {
      setError(messageFor(cause, "Could not create tournament."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  if (!hostSchool) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.background }}>
        <EmptyState
          icon="school-outline"
          title="Join or create a school first"
          message="Tournaments are hosted by a school. Become a president or officer of your school, then come back to host an event."
          action={{ label: "Find your school", icon: "search", onPress: () => router.push("/schools") }}
        />
      </View>
    );
  }

  const valid =
    name.trim().length > 0 &&
    date.trim().length > 0 &&
    location.trim().length > 0;

  return (
    <ScreenScroll gap={24}>
      <ListGroup>
        <ListRow
          icon="school"
          iconTone="secondary"
          title={hostSchool.name}
          subtitle={`Hosting school · ${GENDER_LABELS[hostSchool.gender]} ${REGION_LABELS[hostSchool.region]}`}
        />
      </ListGroup>


      <Section title="Basics">
        <FormField label="Tournament name" colors={colors}>
          <FormTextInput
            value={name}
            onChangeText={setName}
            placeholder="Spring Invitational 2026"
            autoCapitalize="words"
            maxLength={120}
            colors={colors}
          />
        </FormField>

        <FormField label="Date" colors={colors}>
          <ListGroup>
            <ListRow
              icon="calendar-outline"
              title={date ? formatCalendarDate(date) : "Choose a date"}
              chevron={false}
              accessibilityHint={calendarOpen ? "Hides the calendar" : "Shows a calendar"}
              onPress={() => setCalendarOpen((open) => !open)}
            />
          </ListGroup>
          {calendarOpen ? (
            <MonthCalendar
              selectedDate={date}
              today={today}
              markedDates={NO_MARKS}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onSelectDate={(iso) => {
                setDate(iso);
                setCalendarOpen(false);
              }}
            />
          ) : null}
        </FormField>

        <FormField
          label="Format"
          hint={PLAY_FORMAT_DESCRIPTIONS[playFormat]}
          colors={colors}
        >
          <ChipPicker
            options={PLAY_FORMAT_VALUES}
            value={playFormat}
            onChange={setPlayFormat}
            colors={colors}
            labels={PLAY_FORMAT_LABELS}
          />
        </FormField>
      </Section>

      <Section title="Venue">
        <FormField label="Location" colors={colors}>
          <FormTextInput
            value={location}
            onChangeText={setLocation}
            placeholder="University Gym"
            autoCapitalize="words"
            colors={colors}
          />
        </FormField>

        <FormField label="Address" hint="Optional. Shown with a map link." colors={colors}>
          <FormTextInput
            value={address}
            onChangeText={setAddress}
            placeholder="123 Main St, City, ST 12345"
            textContentType="fullStreetAddress"
            autoComplete="street-address"
            colors={colors}
          />
        </FormField>
      </Section>

      <Section title="Details">
        <FormField label="Description" hint="Optional. Start time, fees, and anything teams should know." colors={colors}>
          <FormTextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Check-in at 8am, first serve at 9am…"
            multiline
            colors={colors}
          />
        </FormField>
      </Section>

      {error ? <Banner tone="error" message={error} /> : null}

      <FormSubmitButton
        label="Create tournament"
        busy={busy}
        disabled={!valid}
        onPress={() => void onSubmit()}
      />
    </ScreenScroll>
  );
}
