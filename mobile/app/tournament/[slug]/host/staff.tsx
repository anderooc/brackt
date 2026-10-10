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

import type { TournamentHostStaffContract } from "@/lib/api/contracts/tournament-host";
import { Redirect, useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Alert } from "react-native";
import {
  addTournamentHostStaff,
  fetchTournamentHostStaff,
  removeTournamentHostStaff,
} from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormSubmitButton, FormTextInput } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { ErrorScreen, LoadingScreen } from "~/tournament/screen-state";
import { messageFor, usePublicLoader } from "~/tournament/use-public-loader";
import {
  Banner,
  Button,
  EmptyState,
  ListGroup,
  ListRow,
  ScreenScroll,
  Section,
  SegmentedControl,
  haptics,
} from "~/ui";

type Role = "co_host" | "staff";

const ROLE_LABELS: Record<Role, string> = {
  co_host: "Co-host",
  staff: "Staff",
};

const ROLE_HINT =
  "Both roles can use every host tool. The label just tells teams who's who.";

export default function TournamentHostStaffScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session, isLoading: sessionLoading } = useSession();
  const [staff, setStaff] = useState<TournamentHostStaffContract | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("co_host");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: "Staff" });
  }, [navigation]);

  const load = useCallback(
    (signal?: AbortSignal) => fetchTournamentHostStaff(slug ?? "", signal),
    [slug]
  );
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load staff."
  );

  useEffect(() => {
    if (data) setStaff(data);
  }, [data]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (error && !staff) {
    return (
      <ErrorScreen title="Staff unavailable" message={error} onRetry={() => void refresh()} />
    );
  }
  if (!staff || !slug) return <LoadingScreen rows={3} />;

  async function onAdd() {
    setBusy("add");
    setActionError(null);
    setNotice(null);
    try {
      const next = await addTournamentHostStaff(slug!, { email: email.trim(), role });
      setStaff(next);
      haptics.success();
      setNotice(`Added ${email.trim()} as ${ROLE_LABELS[role].toLowerCase()}.`);
      setEmail("");
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not add staff."));
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(userId: string, name: string) {
    Alert.alert(`Remove ${name}?`, "They lose access to host tools for this tournament.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => void onRemove(userId),
      },
    ]);
  }

  async function onRemove(userId: string) {
    setBusy(userId);
    setActionError(null);
    setNotice(null);
    try {
      setStaff(await removeTournamentHostStaff(slug!, userId));
      haptics.success();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not remove staff."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      {notice ? (
        <Banner tone="success" message={notice} onDismiss={() => setNotice(null)} />
      ) : null}

      <Section title="Current staff">
        {staff.staff.length === 0 ? (
          <EmptyState
            compact
            icon="people-outline"
            title="Just you so far"
            message="Add co-hosts or staff to share the work on game day."
          />
        ) : (
          <ListGroup>
            {staff.staff.map((member) => (
              <ListRow
                key={member.userId}
                title={member.fullName || member.email}
                subtitle={`${ROLE_LABELS[member.role]} · ${member.email}`}
                icon="person-circle-outline"
                trailing={
                  staff.canManage ? (
                    <Button
                      label="Remove"
                      size="sm"
                      variant="destructiveOutline"
                      loading={busy === member.userId}
                      disabled={busy !== null}
                      onPress={() =>
                        confirmRemove(member.userId, member.fullName || member.email)
                      }
                    />
                  ) : undefined
                }
              />
            ))}
          </ListGroup>
        )}
      </Section>

      {staff.canManage ? (
        <Section
          title="Add someone"
          description="They need a brackt account. Use the email they signed up with."
        >
          <FormField label="Email" colors={colors}>
            <FormTextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@university.edu"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              colors={colors}
            />
          </FormField>
          <FormField label="Role" hint={ROLE_HINT} colors={colors}>
            <SegmentedControl
              options={[
                { id: "co_host", label: ROLE_LABELS.co_host },
                { id: "staff", label: ROLE_LABELS.staff },
              ]}
              value={role}
              onChange={setRole}
              accessibilityLabel="Staff role"
            />
          </FormField>
          <FormSubmitButton
            label="Add to staff"
            busy={busy === "add"}
            disabled={!email.includes("@") || busy !== null}
            onPress={() => void onAdd()}
          />
        </Section>
      ) : (
        <Banner
          tone="info"
          message="Only the tournament owner can add or remove staff."
        />
      )}
    </ScreenScroll>
  );
}
