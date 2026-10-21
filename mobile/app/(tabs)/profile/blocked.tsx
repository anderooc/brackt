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

import type { BlockedUserContract } from "@/lib/api/contracts/tournament-ops";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { fetchBlockedUsers, unblockUser } from "~/api/endpoints";
import { useSession } from "~/auth/session";
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
  haptics,
} from "~/ui";

export default function BlockedUsersScreen() {
  const { session, isLoading: sessionLoading } = useSession();
  const [users, setUsers] = useState<BlockedUserContract[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback((signal?: AbortSignal) => fetchBlockedUsers(signal), []);
  const { data, error, isRefreshing, refresh } = usePublicLoader(
    load,
    "Could not load blocked users."
  );

  useEffect(() => {
    if (data) setUsers(data.users);
  }, [data]);

  if (sessionLoading) return <LoadingScreen />;
  if (!session) return <Redirect href="/sign-in" />;
  if (error && !users) {
    return (
      <ErrorScreen
        title="Blocked users unavailable"
        message={error}
        onRetry={() => void refresh()}
      />
    );
  }
  if (!users) return <LoadingScreen rows={3} />;

  function confirmUnblock(user: BlockedUserContract) {
    Alert.alert(
      `Unblock ${user.fullName}?`,
      "Their tournament chat messages will be visible to you again.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Unblock", onPress: () => void unblock(user.userId) },
      ]
    );
  }

  async function unblock(userId: string) {
    setBusy(userId);
    setActionError(null);
    try {
      setUsers((await unblockUser(userId)).users);
      haptics.success();
    } catch (cause) {
      haptics.error();
      setActionError(messageFor(cause, "Could not unblock this person."));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScreenScroll refreshing={isRefreshing} onRefresh={() => void refresh()}>
      {actionError ? (
        <Banner tone="error" message={actionError} onDismiss={() => setActionError(null)} />
      ) : null}
      {users.length === 0 ? (
        <EmptyState
          icon="hand-left-outline"
          title="No one is blocked"
          message="To block someone, press and hold one of their messages in a tournament chat."
        />
      ) : (
        <Section description="You won't see chat messages from these people. They aren't told you blocked them.">
          <ListGroup>
            {users.map((user) => (
              <ListRow
                key={user.userId}
                title={user.fullName}
                icon="person-circle-outline"
                iconTone="muted"
                trailing={
                  <Button
                    label="Unblock"
                    size="sm"
                    variant="outline"
                    loading={busy === user.userId}
                    disabled={busy !== null}
                    onPress={() => confirmUnblock(user)}
                  />
                }
              />
            ))}
          </ListGroup>
        </Section>
      )}
    </ScreenScroll>
  );
}
