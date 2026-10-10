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

import { useRouter } from "expo-router";
import { useState } from "react";
import { requestPasswordReset } from "~/api/endpoints";
import {
  MOBILE_PASSWORD_RESET_REDIRECT,
  setRecoveryState,
  useRecoveryState,
} from "~/auth/recovery-link";
import {
  AuthActions,
  AuthInput,
  AuthLink,
  AuthScreen,
} from "~/components/auth-screen";
import { FormField } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { Banner, Button, haptics } from "~/ui";

export default function ForgotPasswordScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recovery = useRecoveryState();

  const canSubmit = email.trim().length > 0 && !isSubmitting;

  async function onSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await requestPasswordReset({
        email: email.trim(),
        redirectTo: MOBILE_PASSWORD_RESET_REDIRECT,
      });
      haptics.success();
      setRecoveryState({ status: "idle" });
      setSuccessMessage(
        result.message ??
          "If an account exists for that email, we sent a link to reset your password."
      );
    } catch (cause) {
      haptics.error();
      setError(
        cause instanceof Error ? cause.message : "Could not send reset email."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const backToSignIn = () => router.dismissTo("/sign-in");

  if (successMessage) {
    return (
      <AuthScreen>
        <Banner tone="success" title="Check your email" message={successMessage} />
        <AuthActions>
          <Button label="Back to sign in" onPress={backToSignIn} fullWidth />
          <AuthLink
            label="Use a different email"
            onPress={() => setSuccessMessage(null)}
          />
        </AuthActions>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen lead="Enter your account email and we'll send you a link to choose a new password.">
      {recovery.status === "failed" && !error ? (
        <Banner tone="warning" title="Link expired" message={recovery.message} />
      ) : null}
      {error ? (
        <Banner tone="error" title="Couldn't send link" message={error} />
      ) : null}

      <FormField label="Email" colors={colors}>
        <AuthInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@university.edu"
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="send"
          onSubmitEditing={() => void onSubmit()}
        />
      </FormField>

      <AuthActions>
        <Button
          label="Send reset link"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={!canSubmit}
          fullWidth
        />
        <AuthLink label="Back to sign in" onPress={backToSignIn} />
      </AuthActions>
    </AuthScreen>
  );
}
