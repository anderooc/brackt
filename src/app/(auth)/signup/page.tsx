"use client";

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

import { useState, useTransition, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BracktSymbol } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const prefilledEmail = searchParams.get("email") ?? "";
  const inviteToken = searchParams.get("invite");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await signup(formData);
        if (result?.error) {
          setError(result.error);
        }
      } catch {
        // Successful signup triggers Next.js redirect — ignore.
      }
    });
  }

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] overflow-x-hidden px-4 py-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 text-foreground/[0.06] bg-court-lines [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]"
      />
      {isPending && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background/75 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner size={44} />
          <p className="text-sm font-medium text-foreground">
            Creating your account…
          </p>
        </div>
      )}
      <div className="relative z-[1] mx-auto w-full max-w-md">
        <Card className="shadow-xl shadow-primary/5">
          <CardHeader className="text-center">
          <BracktSymbol className="mx-auto mb-2 h-8 w-auto" />
            <CardTitle as="h1" className="text-2xl font-bold">
              Create account
            </CardTitle>
            <CardDescription>
              Create your brackt account with a school or institutional email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4" aria-busy={isPending}>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Jane Smith"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">School email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@university.edu"
                  defaultValue={prefilledEmail}
                  required
                  disabled={isPending || Boolean(prefilledEmail)}
                />
                <p className="text-xs text-muted-foreground">
                  Must be an institutional address (i.e. edu).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  minLength={8}
                  required
                  disabled={isPending}
                  autoComplete="new-password"
                />
              </div>
              {inviteToken ? (
                <p className="text-xs text-muted-foreground">
                  After creating your account, you&apos;ll be able to accept
                  your team or school invite.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  After signing up, add gender, position, and jersey number under
                  Profile.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <Spinner size={16} variant="onPrimary" className="mr-2" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
            <div className="mt-4 space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?
              </p>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
