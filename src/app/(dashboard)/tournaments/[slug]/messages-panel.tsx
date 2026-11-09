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

import { useEffect, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TournamentPostingAnnouncementCard } from "./posting-announcement-card";
import type { TournamentEmailAudience } from "@/lib/tournaments/email-recipients";
import {
  previewTournamentEmailRecipients,
  sendTournamentCustomEmail,
  sendTournamentWaiverReminderEmail,
} from "./messages/actions";
import { formatTeamRegion } from "@/lib/labels/team";
import type { TeamGender, TeamRegion } from "@/types";

type EmailSendHistoryRow = {
  id: string;
  kind: string;
  audience: string;
  subject: string;
  recipientCount: number;
  skippedNoCaptainCount: number;
  sentAt: Date;
};

const AUDIENCE_OPTIONS: {
  value: TournamentEmailAudience;
  label: string;
  description: string;
}[] = [
  {
    value: "captains_confirmed",
    label: "Confirmed team captains",
    description: "Teams approved in Teams (confirmed or checked in).",
  },
  {
    value: "captains_all",
    label: "All registered team captains",
    description: "Every captain with a pending, confirmed, or checked-in registration.",
  },
  {
    value: "captains_pending",
    label: "Pending team captains",
    description: "Captains still waiting for you to approve their registration.",
  },
  {
    value: "captains_waiver_incomplete",
    label: "Captains with incomplete waivers",
    description: "Confirmed teams that still have roster members without a completed waiver.",
  },
];

const AUDIENCE_SELECT_CONTENT_CLASS =
  "min-w-(--anchor-width) w-max max-w-[min(24rem,calc(100vw-2rem))]";

function audienceOptionLabel(value: string | null): string {
  return (
    AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ??
    "Select who should receive this email"
  );
}

function kindLabel(kind: string): string {
  return kind === "waiver_reminder" ? "Waiver reminder" : "Custom message";
}

function audienceHistoryLabel(audience: string): string {
  const match = AUDIENCE_OPTIONS.find((option) => option.value === audience);
  return match?.label ?? audience;
}

type PostingHistoryRow = {
  id: string;
  subject: string;
  recipientCount: number;
  skippedNoCaptainCount: number;
  sendEmail: boolean;
  regions: TeamRegion[];
  sentAt: Date;
};

export function TournamentMessagesPanel({
  tournamentId,
  tournamentName,
  tournamentDate,
  location,
  gender,
  region,
  status,
  waiverEnabled,
  sendHistory,
  postingHistory,
  recentAnnouncementCount,
  canEdit,
  lockedReason,
}: {
  tournamentId: string;
  tournamentName: string;
  tournamentDate: string;
  location: string;
  gender: TeamGender;
  region: TeamRegion;
  status: string;
  waiverEnabled: boolean;
  sendHistory: EmailSendHistoryRow[];
  postingHistory: PostingHistoryRow[];
  recentAnnouncementCount: number;
  canEdit: boolean;
  lockedReason?: string | null;
}) {
  const router = useRouter();
  const [audience, setAudience] =
    useState<TournamentEmailAudience>("captains_confirmed");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [skippedNoCaptainCount, setSkippedNoCaptainCount] = useState(0);
  const [skippedTeams, setSkippedTeams] = useState<string[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) {
      setRecipientCount(null);
      setSkippedNoCaptainCount(0);
      setSkippedTeams([]);
      setPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    void previewTournamentEmailRecipients(tournamentId, audience).then(
      (result) => {
        if (cancelled) return;
        if ("success" in result && result.success) {
          setRecipientCount(result.recipientCount);
          setSkippedNoCaptainCount(result.skippedNoCaptainCount);
          setSkippedTeams(result.skippedNoCaptainTeamNames);
        } else {
          setRecipientCount(0);
          setSkippedNoCaptainCount(0);
          setSkippedTeams([]);
        }
        setPreviewLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [audience, tournamentId, canEdit]);

  async function handleSendCustom() {
    if (!canEdit) return;
    setSending(true);
    setError(null);
    setSuccess(null);
    const result = await sendTournamentCustomEmail(tournamentId, {
      audience,
      subject,
      body,
    });
    if ("error" in result && result.error) {
      setError(result.error);
      setSending(false);
      return;
    }
    if ("success" in result && result.success) {
      setSuccess(
        `Sent to ${result.recipientCount} captain${result.recipientCount === 1 ? "" : "s"}.` +
          (result.skippedNoCaptainCount > 0
            ? ` ${result.skippedNoCaptainCount} team(s) skipped with no captain.`
            : "")
      );
      setSubject("");
      setBody("");
      setSending(false);
      startTransition(() => router.refresh());
    } else {
      setSending(false);
    }
  }

  async function handleSendWaiverReminder() {
    if (!canEdit) return;
    setSendingReminder(true);
    setError(null);
    setSuccess(null);
    const result = await sendTournamentWaiverReminderEmail(tournamentId);
    if ("error" in result && result.error) {
      setError(result.error);
      setSendingReminder(false);
      return;
    }
    if ("success" in result && result.success) {
      setSuccess(
        `Waiver reminder sent to ${result.recipientCount} captain${result.recipientCount === 1 ? "" : "s"}.` +
          (result.skippedNoCaptainCount > 0
            ? ` ${result.skippedNoCaptainCount} team(s) skipped with no captain.`
            : "")
      );
      setSendingReminder(false);
      startTransition(() => router.refresh());
    } else {
      setSendingReminder(false);
    }
  }

  return (
    <div className="space-y-4">
      {lockedReason ? (
        <p className="text-sm text-muted-foreground">{lockedReason}</p>
      ) : null}
      <TournamentPostingAnnouncementCard
        tournamentId={tournamentId}
        tournamentName={tournamentName}
        tournamentDate={tournamentDate}
        location={location}
        gender={gender}
        region={region}
        status={status}
        canEdit={canEdit}
        recentAnnouncementCount={recentAnnouncementCount}
      />
      {canEdit ? (
        <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            Email team captains
          </CardTitle>
          <CardDescription>
            Send reminders and updates to registered team captains. Captains are
            responsible for sharing information with their rosters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-audience">Audience</Label>
            <Select
              value={audience}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setAudience(value as TournamentEmailAudience);
                }
              }}
            >
              <SelectTrigger
                id="email-audience"
                className="h-auto min-h-8 w-full whitespace-normal py-2 *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal"
              >
                <SelectValue>
                  {(value) => audienceOptionLabel(value)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent
                side="bottom"
                alignItemWithTrigger={false}
                className={AUDIENCE_SELECT_CONTENT_CLASS}
              >
                {AUDIENCE_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    multiline
                    title={option.description}
                  >
                    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                      <span className="leading-snug">{option.label}</span>
                      <span className="text-xs font-normal leading-snug text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {previewLoading
                ? "Counting recipients…"
                : `${recipientCount ?? 0} captain${recipientCount === 1 ? "" : "s"} will receive this email.`}
              {skippedNoCaptainCount > 0
                ? ` ${skippedNoCaptainCount} team(s) have no captain on file.`
                : ""}
            </p>
            {skippedTeams.length > 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No captain: {skippedTeams.join(", ")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Reminder: review the tournament packet before Saturday"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              placeholder={`Hi,

Quick update ahead of tournament day.

Please make sure your roster is set and your team has completed any required waivers. The tournament packet has parking, check-in, and schedule details.

Thank you,
Tournament staff`}
            />
            <p className="text-xs text-muted-foreground">
              Each captain receives their own copy with their name and team
              included automatically.
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {success ? (
            <p className="text-sm text-green-700 dark:text-green-400">
              {success}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={sending || !subject.trim() || !body.trim()}
              onClick={() => void handleSendCustom()}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              {sending ? "Sending…" : "Send email"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {waiverEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick reminders</CardTitle>
            <CardDescription>
              One-click email to captains whose teams still have incomplete
              waivers.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sendingReminder}
              onClick={() => void handleSendWaiverReminder()}
            >
              {sendingReminder ? "Sending…" : "Send waiver reminder"}
            </Button>
          </CardContent>
        </Card>
      ) : null}
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Posting announcements</CardTitle>
          <CardDescription>
            Recent notifications sent to matching captains who were not already
            registered.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No posting announcements sent yet.
            </p>
          ) : (
            <ul className="divide-y rounded-md border border-border/80">
              {postingHistory.map((row) => (
                <li key={row.id} className="space-y-1 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{row.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(row.sentAt, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {row.regions.map((value) => formatTeamRegion(value)).join(", ")}{" "}
                    · {row.recipientCount} recipient
                    {row.recipientCount === 1 ? "" : "s"}
                    {row.sendEmail ? " · email + in-app" : " · in-app only"}
                    {row.skippedNoCaptainCount > 0
                      ? ` · ${row.skippedNoCaptainCount} skipped (no captain)`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send history</CardTitle>
          <CardDescription>Recent emails sent for this tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          {sendHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No emails sent yet.</p>
          ) : (
            <ul className="divide-y rounded-md border border-border/80">
              {sendHistory.map((row) => (
                <li key={row.id} className="space-y-1 px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{row.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(row.sentAt, "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {kindLabel(row.kind)} · {audienceHistoryLabel(row.audience)}{" "}
                    · {row.recipientCount} recipient
                    {row.recipientCount === 1 ? "" : "s"}
                    {row.skippedNoCaptainCount > 0
                      ? ` · ${row.skippedNoCaptainCount} skipped (no captain)`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
