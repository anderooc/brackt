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
import type { TextInput } from "react-native";
import { confirmPasswordReset } from "~/api/endpoints";
import { useSession } from "~/auth/session";
import {
  AuthActions,
  AuthInput,
  AuthLink,
  AuthScreen,
  useExitAuthFlow,
} from "~/components/auth-screen";
import { FormField } from "~/components/create-form";
import { LoadingScreen } from "~/tournament/screen-state";
import { useThemeColors } from "~/theme/colors";
import { Banner, Button, haptics } from "~/ui";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const exitAuthFlow = useExitAuthFlow();
  const { session, isLoading } = useSession();
  const confirmRef = useRef<TextInput>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) return <LoadingScreen rows={2} />;
  if (!session) return <Redirect href="/forgot-password" />;

  const passwordError =
    passwordTouched && password.length > 0 && password.length < MIN_PASSWORD_LENGTH
      ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
      : null;
  const confirmError =
    confirmTouched && confirmPassword.length > 0 && confirmPassword !== password
      ? "Passwords don't match."
      : null;
  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === password &&
    !isSubmitting;

  async function onSubmit() {
    setPasswordTouched(true);
    setConfirmTouched(true);
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await confirmPasswordReset({ password, confirmPassword });
      haptics.success();
      exitAuthFlow();
    } catch (cause) {
      haptics.error();
      setError(
        cause instanceof Error ? cause.message : "Could not update password."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen lead="Choose a new password for your brackt account.">
      {error ? (
        <Banner tone="error" title="Couldn't update password" message={error} />
      ) : null}

      <FormField
        label="New password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={passwordError}
        colors={colors}
      >
        <AuthInput
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          invalid={passwordError != null}
          placeholder="New password"
          accessibilityLabel="New password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
      </FormField>

      <FormField label="Confirm new password" error={confirmError} colors={colors}>
        <AuthInput
          ref={confirmRef}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={() => setConfirmTouched(true)}
          invalid={confirmError != null}
          placeholder="Re-enter new password"
          accessibilityLabel="Confirm new password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={() => void onSubmit()}
        />
      </FormField>

      <AuthActions>
        <Button
          label="Update password"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={!canSubmit}
          fullWidth
        />
        <AuthLink
          label="Link expired? Request a new one"
          onPress={() => router.replace("/forgot-password")}
        />
      </AuthActions>
    </AuthScreen>
  );
}
