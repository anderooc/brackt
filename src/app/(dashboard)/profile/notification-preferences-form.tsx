"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { notificationKindLabel } from "@/lib/notifications/display";
import {
  NOTIFICATION_KINDS,
  type NotificationPreference,
} from "@/lib/notifications/preferences-shared";
import type { UserNotificationKind } from "@/types";
import { updateNotificationPreferences } from "./actions";
import { WebPushOptIn } from "@/components/notifications/web-push-opt-in";

export function NotificationPreferencesForm({
  defaults,
}: {
  defaults: Record<UserNotificationKind, NotificationPreference>;
}) {
  const [prefs, setPrefs] = useState(defaults);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateKind(
    kind: UserNotificationKind,
    patch: Partial<NotificationPreference>
  ) {
    setPrefs((current) => ({
      ...current,
      [kind]: { ...current[kind], ...patch },
    }));
  }

  function onSave() {
    setMessage(null);
    startTransition(async () => {
      await updateNotificationPreferences(prefs);
      setMessage("Preferences saved.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification preferences</CardTitle>
        <CardDescription>
          Choose how brackt reaches you for each notification type. In-app
          notifications always appear in your notification center.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <WebPushOptIn />

        <div className="divide-y rounded-lg border">
          {NOTIFICATION_KINDS.map((kind) => (
            <div
              key={kind}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">
                  {notificationKindLabel(kind)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${kind}-push`}
                    checked={prefs[kind].pushEnabled}
                    onCheckedChange={(checked) =>
                      updateKind(kind, { pushEnabled: checked })
                    }
                  />
                  <Label htmlFor={`${kind}-push`} className="text-sm">
                    Push
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${kind}-email`}
                    checked={prefs[kind].emailEnabled}
                    onCheckedChange={(checked) =>
                      updateKind(kind, { emailEnabled: checked })
                    }
                  />
                  <Label htmlFor={`${kind}-email`} className="text-sm">
                    Email
                  </Label>
                </div>
              </div>
            </div>
          ))}
        </div>

        {message ? (
          <p
            className={
              message === "Preferences saved."
                ? "text-sm text-muted-foreground"
                : "text-sm text-destructive"
            }
            role="status"
          >
            {message}
          </p>
        ) : null}

        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
      </CardContent>
    </Card>
  );
}
