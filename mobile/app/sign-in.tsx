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
import { useRef, useState } from "react";
import type { TextInput } from "react-native";
import { useSession } from "~/auth/session";
import {
  AuthActions,
  AuthInput,
  AuthLink,
  AuthScreen,
  useExitAuthFlow,
} from "~/components/auth-screen";
import { FormField } from "~/components/create-form";
import { useThemeColors } from "~/theme/colors";
import { Banner, Button, haptics } from "~/ui";

export default function SignInScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const exitAuthFlow = useExitAuthFlow();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function onSubmit() {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
      haptics.success();
      exitAuthFlow();
    } catch (cause) {
      haptics.error();
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen lead="Welcome back. Sign in with the email you used to create your brackt account.">
      {error ? (
        <Banner tone="error" title="Couldn't sign in" message={error} />
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
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      </FormField>

      <FormField label="Password" colors={colors}>
        <AuthInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          accessibilityLabel="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void onSubmit()}
        />
      </FormField>

      <AuthActions>
        <Button
          label="Sign in"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={!canSubmit}
          fullWidth
        />
        <AuthLink
          label="Forgot password?"
          onPress={() => router.push("/forgot-password")}
        />
        <AuthLink
          label="Create an account"
          onPress={() => router.push("/sign-up")}
        />
      </AuthActions>
    </AuthScreen>
  );
}
