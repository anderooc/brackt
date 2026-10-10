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

import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { registerAuthRefreshLifecycle, supabase } from "./supabase";

interface SessionState {
  session: Session | null;
  /** True until the persisted session has been read from the keychain. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

type BeforeSignOutHook = () => Promise<void>;
const beforeSignOutHooks = new Set<BeforeSignOutHook>();

/**
 * Runs while the access token is still valid, so cleanup that needs an
 * authenticated request (e.g. unregistering the push token) can succeed.
 */
export function registerBeforeSignOut(hook: BeforeSignOutHook): () => void {
  beforeSignOutHooks.add(hook);
  return () => {
    beforeSignOutHooks.delete(hook);
  };
}

async function runBeforeSignOutHooks(): Promise<void> {
  await Promise.all(
    [...beforeSignOutHooks].map((hook) => hook().catch(() => undefined))
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Reading from the keychain is async, so the first frame must not assume
    // the user is signed out or the app flashes the sign-in screen on launch.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    const stopRefreshLifecycle = registerAuthRefreshLifecycle();

    return () => {
      active = false;
      data.subscription.unsubscribe();
      stopRefreshLifecycle();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await runBeforeSignOutHooks();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo(
    () => ({ session, isLoading, signIn, signOut }),
    [session, isLoading, signIn, signOut]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used inside a SessionProvider");
  }
  return context;
}
