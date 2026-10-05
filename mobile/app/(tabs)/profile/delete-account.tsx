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
import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { deleteAccount } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormTextInput } from "~/components/create-form";
import { goBackOrReplace } from "~/lib/navigation";
import { useThemeColors } from "~/theme/colors";
import { LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import { AppText, Banner, Button, Card, Icon, ScreenScroll, haptics, space } from "~/ui";

export default function DeleteAccountScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading, signOut } = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) return <LoadingScreen rows={3} />;
  if (!session) return <Redirect href="/sign-in" />;

  const ready = password.length > 0 && confirmation === "DELETE";

  async function onDelete() {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({ password, confirmation });
      await signOut();
      router.replace("/sign-in");
    } catch (cause) {
      setError(messageFor(cause, "Could not delete account."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenScroll gap={20}>
      <Card style={{ borderColor: colors.destructive }}>
        <View style={styles.warningTitle}>
          <Icon name="warning-outline" size={20} tone="destructive" />
          <AppText variant="headline" tone="destructive">
            This can’t be undone
          </AppText>
        </View>
        <AppText variant="subhead">
          Your account is removed and you’re signed out everywhere. Teams and
          tournaments you created may stay, but your personal details are
          anonymized.
        </AppText>
      </Card>

      {error ? <Banner tone="error" message={error} /> : null}

      <FormField label="Password" colors={colors}>
        <FormTextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Your current password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          colors={colors}
        />
      </FormField>

      <FormField label="Type DELETE to confirm" colors={colors}>
        <FormTextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="DELETE"
          autoCapitalize="characters"
          autoCorrect={false}
          colors={colors}
        />
      </FormField>

      <View style={styles.actions}>
        <Button
          label="Delete my account"
          variant="destructive"
          fullWidth
          loading={busy}
          disabled={!ready}
          onPress={() => {
            haptics.warning();
            Alert.alert("Delete your account?", "This permanently removes your account.", [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => void onDelete() },
            ]);
          }}
        />
        <Button
          label="Cancel"
          variant="ghost"
          fullWidth
          disabled={busy}
          onPress={() => goBackOrReplace(router, "/profile")}
        />
      </View>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  warningTitle: { flexDirection: "row", alignItems: "center", gap: space.sm },
  actions: { gap: space.sm },
});
