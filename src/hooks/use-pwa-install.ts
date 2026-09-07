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

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface PwaInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  promptInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  isDismissed: boolean;
}

const DISMISSED_KEY = "brackt_pwa_install_dismissed_until";
const DISMISSAL_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function usePwaInstall(): PwaInstallState {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Detect if already installed / standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(Boolean(isIosDevice && !isStandalone));

    // Check recent dismissal
    try {
      const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      } else {
        setIsDismissed(false);
      }
    } catch {
      setIsDismissed(false);
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(
        DISMISSED_KEY,
        String(Date.now() + DISMISSAL_DURATION_MS)
      );
    } catch {
      // Storage access disabled / private mode
    }
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) || (isIos && !isInstalled),
    isInstalled,
    isIos,
    promptInstall,
    dismissPrompt,
    isDismissed,
  };
}
