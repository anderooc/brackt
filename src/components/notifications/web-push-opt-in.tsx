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

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

type OptInState =
  | "loading"
  | "unsupported"
  | "unavailable"
  | "prompt"
  | "enabled"
  | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function fetchVapidPublicKey(): Promise<string | null> {
  const response = await fetch("/api/v1/me/web-push/vapid-public-key");
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => null)) as {
    data?: { publicKey?: string | null };
  } | null;
  const key = payload?.data?.publicKey?.trim();
  return key || null;
}

async function persistSubscription(
  subscription: PushSubscription
): Promise<boolean> {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  const response = await fetch("/api/v1/me/web-push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      },
      userAgent: navigator.userAgent,
    }),
  });

  return response.ok;
}

export function WebPushOptIn() {
  const [state, setState] = useState<OptInState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      if (!pushSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }

      const publicKey = await fetchVapidPublicKey();
      if (cancelled) return;
      if (!publicKey) {
        setState("unavailable");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (cancelled) return;

      if (existing && Notification.permission === "granted") {
        setState("enabled");
        return;
      }

      setState("prompt");
    }

    void detect().catch(() => {
      if (!cancelled) setState("unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (!pushSupported()) {
          setState("unsupported");
          return;
        }

        const publicKey = await fetchVapidPublicKey();
        if (!publicKey) {
          setState("unavailable");
          setMessage("Browser push is not configured on this server.");
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "prompt");
          setMessage("Notification permission was not granted.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            publicKey
          ) as BufferSource,
        });

        const saved = await persistSubscription(subscription);
        if (!saved) {
          setMessage("Could not save this browser for push notifications.");
          return;
        }

        setState("enabled");
        setMessage("Browser notifications enabled.");
      } catch {
        setMessage("Could not enable browser notifications.");
      }
    });
  }

  if (state === "loading" || state === "unavailable" || state === "unsupported") {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Browser notifications</p>
        <p className="text-sm text-muted-foreground">
          {state === "enabled"
            ? "This browser is subscribed for push notifications."
            : state === "denied"
              ? "Notifications are blocked in this browser. Enable them in site settings to opt in."
              : "Allow this browser to receive push alerts when you have push enabled above."}
        </p>
      </div>

      {state === "prompt" ? (
        <Button type="button" disabled={pending} onClick={enable}>
          {pending ? "Enabling…" : "Enable browser notifications"}
        </Button>
      ) : null}

      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
