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
import { useRef, useState } from "react";
import { Alert, type TextInput } from "react-native";
import { changePassword } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import { FormField, FormSubmitButton, FormTextInput } from "~/components/create-form";
import { goBackOrReplace } from "~/lib/navigation";
import { useThemeColors } from "~/theme/colors";
import { LoadingScreen } from "~/tournament/screen-state";
import { messageFor } from "~/tournament/use-public-loader";
import { AppText, Banner, ScreenScroll, haptics } from "~/ui";

export default function ChangePasswordScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session, isLoading } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const newRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  if (isLoading) return <LoadingScreen rows={3} />;
  if (!session) return <Redirect href="/sign-in" />;

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirmPassword.length > 0 && confirmPassword !== password;
  const canSubmit =
    currentPassword.length > 0 && password.length >= 8 && confirmPassword === password;

  async function onSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      await changePassword({ currentPassword, password, confirmPassword });
      haptics.success();
      Alert.alert("Password updated", "Use your new password next time you sign in.", [
        { text: "OK", onPress: () => goBackOrReplace(router, "/profile") },
      ]);
    } catch (cause) {
      setError(messageFor(cause, "Could not update password."));
      haptics.error();
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenScroll gap={20}>
      <AppText variant="callout" tone="muted">
        Enter your current password, then choose a new one.
      </AppText>


      <FormField label="Current password" colors={colors}>
        <FormTextInput
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          autoComplete="current-password"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => newRef.current?.focus()}
          colors={colors}
        />
      </FormField>
      <FormField
        label="New password"
        hint="At least 8 characters."
        error={tooShort ? "Use at least 8 characters." : null}
        colors={colors}
      >
        <FormTextInput
          ref={newRef}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
          colors={colors}
        />
      </FormField>
      <FormField
        label="Confirm new password"
        error={mismatch ? "Passwords don’t match." : null}
        colors={colors}
      >
        <FormTextInput
          ref={confirmRef}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          autoComplete="new-password"
          returnKeyType="done"
          onSubmitEditing={() => void onSubmit()}
          colors={colors}
        />
      </FormField>

      {error ? <Banner tone="error" message={error} /> : null}

      <FormSubmitButton
        label="Update password"
        busy={busy}
        disabled={!canSubmit}
        onPress={() => void onSubmit()}
      />
    </ScreenScroll>
  );
}
