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
import { signUpAccount } from "~/api/endpoints";
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
import { AppText, Banner, Button, haptics } from "~/ui";

const MIN_PASSWORD_LENGTH = 8;

export default function SignUpScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const exitAuthFlow = useExitAuthFlow();
  const { signIn } = useSession();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordTooShort = password.length < MIN_PASSWORD_LENGTH;
  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    !passwordTooShort &&
    !isSubmitting;

  async function onSubmit() {
    setPasswordTouched(true);
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await signUpAccount({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
      });
      await signIn(email.trim(), password);
      haptics.success();
      exitAuthFlow();
    } catch (cause) {
      haptics.error();
      setError(cause instanceof Error ? cause.message : "Could not create account.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen lead="Use your school or institutional email so teams and schools can find you.">
      {error ? (
        <Banner tone="error" title="Couldn't create account" message={error} />
      ) : null}

      <FormField label="Full name" colors={colors}>
        <AuthInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Jane Smith"
          accessibilityLabel="Full name"
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
      </FormField>

      <FormField
        label="School email"
        hint="Must be an institutional address, like a .edu email."
        colors={colors}
      >
        <AuthInput
          ref={emailRef}
          value={email}
          onChangeText={setEmail}
          placeholder="you@university.edu"
          accessibilityLabel="School email"
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

      <FormField
        label="Password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={
          passwordTouched && password.length > 0 && passwordTooShort
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : null
        }
        colors={colors}
      >
        <AuthInput
          ref={passwordRef}
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          invalid={passwordTouched && password.length > 0 && passwordTooShort}
          placeholder="Create a password"
          accessibilityLabel="Password"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          passwordRules={`minlength: ${MIN_PASSWORD_LENGTH};`}
          returnKeyType="done"
          onSubmitEditing={() => void onSubmit()}
        />
      </FormField>

      <AppText variant="footnote" tone="muted">
        You can add your gender, position, and jersey number later in Profile.
      </AppText>

      <AuthActions>
        <Button
          label="Create account"
          onPress={() => void onSubmit()}
          loading={isSubmitting}
          disabled={!canSubmit}
          fullWidth
        />
        <AuthLink
          label="Already have an account? Sign in"
          onPress={() => router.dismissTo("/sign-in")}
        />
      </AuthActions>
    </AuthScreen>
  );
}
