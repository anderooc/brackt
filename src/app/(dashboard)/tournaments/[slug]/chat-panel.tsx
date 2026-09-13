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

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isToday, isYesterday } from "date-fns";
import {
  Flag,
  HelpCircle,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ViewportSplit } from "@/components/layout/viewport-split";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessageRow } from "@/lib/tournaments/chat-unread";
import type { EligibleSpeakingTeam } from "@/lib/tournaments/chat-access";
import type { TournamentChatChannelKind } from "@/types";
import { TOURNAMENT_CHAT_BODY_MAX } from "@/lib/tournaments/chat-constants";
import {
  markTournamentChatChannelRead,
  reportTournamentChatMessage,
  sendTournamentChatMessage,
} from "./chat/actions";

type ChannelView = {
  id: string;
  kind: TournamentChatChannelKind;
  label: string;
  description: string;
  unreadCount: number;
};

type RealtimeMessagePayload = {
  new: {
    id: string;
    channel_id: string;
    tournament_id: string;
    author_user_id: string;
    team_id: string | null;
    body: string;
    created_at: string;
  };
};

const CHANNEL_ICONS: Record<TournamentChatChannelKind, typeof Megaphone> = {
  announcements: Megaphone,
  questions: HelpCircle,
  general: MessagesSquare,
};

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate" },
  { value: "other", label: "Other" },
] as const;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function formatMessageDay(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMM d");
}

function formatMessageTime(date: Date): string {
  return format(date, "h:mm a");
}

function groupMessagesByDay(messages: ChatMessageRow[]) {
  const groups: { dayLabel: string; messages: ChatMessageRow[] }[] = [];
  for (const message of messages) {
    const dayLabel = formatMessageDay(message.createdAt);
    const last = groups[groups.length - 1];
    if (last?.dayLabel === dayLabel) {
      last.messages.push(message);
    } else {
      groups.push({ dayLabel, messages: [message] });
    }
  }
  return groups;
}

function emptyStateMessage(kind: TournamentChatChannelKind | undefined): string {
  switch (kind) {
    case "questions":
      return "No questions yet. Captains and school officers can ask the host about parking, check-in, or schedule.";
    case "announcements":
      return "No announcements yet. The host can post updates here for all registered teams.";
    case "general":
      return "No messages yet. Start a conversation with other registered teams.";
    default:
      return "No messages yet.";
  }
}

function composePlaceholder(kind: TournamentChatChannelKind | undefined): string {
  switch (kind) {
    case "questions":
      return "Ask the host about parking, check-in, schedule…";
    case "announcements":
      return "Post an announcement to all teams…";
    case "general":
      return "Message other registered teams…";
    default:
      return "Write a message…";
  }
}

function ChatMessageBubble({
  message,
  tournamentId,
  canReport,
  reported,
  onReported,
}: {
  message: ChatMessageRow;
  tournamentId: string;
  canReport: boolean;
  reported: boolean;
  onReported: (messageId: string) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const subtitle = message.teamName
    ? message.teamName
    : message.isOrganizerMessage
      ? "Tournament host"
      : null;

  async function handleReport(
    reason: (typeof REPORT_REASONS)[number]["value"]
  ) {
    if (reporting || reported) return;
    setReporting(true);
    const result = await reportTournamentChatMessage(tournamentId, {
      messageId: message.id,
      reason,
    });
    setReporting(false);

    if ("error" in result && result.error) {
      toast.error(result.error);
      return;
    }

    onReported(message.id);
    toast.success("Message reported. Thanks for letting us know.");
  }

  return (
    <div className="flex gap-3">
      <Avatar
        size="sm"
        className={cn(
          "mt-0.5",
          message.isOrganizerMessage && "bg-primary/15 text-primary"
        )}
      >
        <AvatarFallback
          className={cn(
            message.isOrganizerMessage &&
              "bg-primary/15 font-semibold text-primary"
          )}
        >
          {initialsFromName(message.authorName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">
            {message.authorName}
          </span>
          {subtitle ? (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          ) : null}
          <time
            dateTime={message.createdAt.toISOString()}
            className="text-xs text-muted-foreground"
          >
            {formatMessageTime(message.createdAt)}
          </time>
          {canReport ? (
            reported ? (
              <span className="text-xs text-muted-foreground">Reported</span>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={reporting}
                      className="h-6 gap-1 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Report message"
                    >
                      <Flag className="h-3 w-3" />
                      Report
                    </Button>
                  }
                />
                <DropdownMenuContent align="start" className="min-w-44">
                  <DropdownMenuLabel>Report reason</DropdownMenuLabel>
                  {REPORT_REASONS.map((reason) => (
                    <DropdownMenuItem
                      key={reason.value}
                      disabled={reporting}
                      onClick={() => void handleReport(reason.value)}
                    >
                      {reason.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          ) : null}
        </div>
        <div
          className={cn(
            "mt-1.5 max-w-[42rem] rounded-2xl rounded-tl-md px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            message.isOrganizerMessage
              ? "bg-primary/10 text-foreground ring-1 ring-primary/15"
              : "bg-muted/80 text-foreground"
          )}
        >
          {message.body}
        </div>
      </div>
    </div>
  );
}

export function TournamentChatPanel({
  tournamentId,
  tournamentStatus: _tournamentStatus,
  organizerId: _organizerId,
  currentUserId,
  isOrganizer,
  canPost,
  eligibleTeams,
  channels,
  messagesByChannel: initialMessagesByChannel,
  totalUnread: _totalUnread,
}: {
  tournamentId: string;
  tournamentStatus: string;
  organizerId: string;
  currentUserId: string;
  isOrganizer: boolean;
  canPost: boolean;
  eligibleTeams: EligibleSpeakingTeam[];
  channels: ChannelView[];
  messagesByChannel: Record<string, ChatMessageRow[]>;
  totalUnread: number;
}) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeChannelId, setActiveChannelId] = useState(channels[0]?.id ?? "");
  const [messagesByChannel, setMessagesByChannel] = useState(
    initialMessagesByChannel
  );
  const [draft, setDraft] = useState("");
  const [teamId, setTeamId] = useState(eligibleTeams[0]?.teamId ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(() => new Set());

  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0];
  const activeMessages = useMemo(
    () => (activeChannel ? (messagesByChannel[activeChannel.id] ?? []) : []),
    [activeChannel, messagesByChannel]
  );
  const messageGroups = useMemo(
    () => groupMessagesByDay(activeMessages),
    [activeMessages]
  );

  const canPostInActiveChannel = useMemo(() => {
    if (!canPost || !activeChannel) return false;
    if (activeChannel.kind === "announcements") return isOrganizer;
    return isOrganizer || eligibleTeams.length > 0;
  }, [activeChannel, canPost, eligibleTeams.length, isOrganizer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChannelId, activeMessages.length]);

  useEffect(() => {
    if (!activeChannel) return;
    void markTournamentChatChannelRead(tournamentId, activeChannel.id).then(
      () => {
        startTransition(() => router.refresh());
      }
    );
  }, [activeChannel, tournamentId, router]);

  useEffect(() => {
    const supabase = createClient();
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 300);
    };

    const channel = supabase
      .channel(`tournament-chat-${tournamentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tournament_chat_messages",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: RealtimeMessagePayload) => {
          const row = payload.new;
          if (!row) return;
          refresh();
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, router]);

  useEffect(() => {
    setMessagesByChannel(initialMessagesByChannel);
  }, [initialMessagesByChannel]);

  async function handleSend() {
    if (!activeChannel || !canPostInActiveChannel) return;
    const body = draft.trim();
    if (!body) return;

    setSending(true);
    setError(null);
    const result = await sendTournamentChatMessage(tournamentId, {
      channelId: activeChannel.id,
      body,
      teamId: teamId || undefined,
    });

    if ("error" in result && result.error) {
      setError(result.error);
      setSending(false);
      return;
    }

    setDraft("");
    setSending(false);
    textareaRef.current?.focus();
    startTransition(() => router.refresh());
  }

  if (channels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Chat channels are not available yet.
      </p>
    );
  }

  const ActiveChannelIcon = activeChannel
    ? CHANNEL_ICONS[activeChannel.kind]
    : MessageSquare;

  return (
    <Card className="min-w-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Tournament chat
        </CardTitle>
        <CardDescription>
          Coordinate with registered teams before and during the event.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex min-h-[min(32rem,72vh)] min-w-0 flex-col md:flex-row">
          <ViewportSplit
            mobile={
              <div className="border-b p-2">
                <Select
                  value={activeChannelId}
                  onValueChange={(value) => {
                    if (typeof value === "string") setActiveChannelId(value);
                  }}
                >
                  <SelectTrigger
                    className="h-11 w-full"
                    aria-label="Chat channel"
                  >
                    <SelectValue placeholder="Choose a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        {channel.label}
                        {channel.unreadCount > 0
                          ? ` (${channel.unreadCount})`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
            desktop={
              <nav
                className="flex w-72 shrink-0 flex-col gap-1 border-r p-3"
                aria-label="Chat channels"
              >
                {channels.map((channel) => {
                  const Icon = CHANNEL_ICONS[channel.kind];
                  const isActive = channel.id === activeChannelId;
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => setActiveChannelId(channel.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "flex w-full min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {channel.label}
                          </span>
                          {channel.unreadCount > 0 && !isActive ? (
                            <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums">
                              {channel.unreadCount}
                            </span>
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-pretty text-muted-foreground">
                          {channel.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </nav>
            }
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {activeChannel ? (
              <div className="flex items-start gap-2 border-b px-4 py-3 sm:px-5">
                <ActiveChannelIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">{activeChannel.label}</h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-pretty text-muted-foreground">
                    {activeChannel.description}
                  </p>
                </div>
              </div>
            ) : null}

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-6 px-4 py-4 sm:px-5">
                {activeMessages.length === 0 ? (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center">
                    <ActiveChannelIcon className="mb-3 h-8 w-8 text-muted-foreground/60" />
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {emptyStateMessage(activeChannel?.kind)}
                    </p>
                  </div>
                ) : (
                  messageGroups.map((group) => (
                    <div key={group.dayLabel} className="space-y-4">
                      <div className="sticky top-0 z-10 flex items-center gap-3 py-1">
                        <div className="h-px flex-1 bg-border/80" />
                        <span className="shrink-0 rounded-full bg-background px-2.5 py-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {group.dayLabel}
                        </span>
                        <div className="h-px flex-1 bg-border/80" />
                      </div>
                      {group.messages.map((message) => (
                        <ChatMessageBubble
                          key={message.id}
                          message={message}
                          tournamentId={tournamentId}
                          canReport={message.authorUserId !== currentUserId}
                          reported={reportedIds.has(message.id)}
                          onReported={(messageId) => {
                            setReportedIds((prev) => {
                              const next = new Set(prev);
                              next.add(messageId);
                              return next;
                            });
                          }}
                        />
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="border-t bg-muted/15 px-4 py-3 sm:px-5 sm:py-4">
              {!canPost ? (
                <p className="text-sm text-muted-foreground">
                  Chat is read-only because this tournament is archived.
                </p>
              ) : canPostInActiveChannel ? (
                <div className="space-y-2">
                  {eligibleTeams.length > 1 ? (
                    <Select
                      value={teamId}
                      onValueChange={(value) => {
                        if (typeof value === "string") setTeamId(value);
                      }}
                    >
                      <SelectTrigger
                        className="h-8 w-full max-w-xs border-border/70 bg-background text-xs"
                        aria-label="Posting as team"
                      >
                        <SelectValue placeholder="Posting as…" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleTeams.map((team) => (
                          <SelectItem key={team.teamId} value={team.teamId}>
                            Posting as {team.teamName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm ring-1 ring-black/5 dark:ring-white/10">
                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSend();
                        }
                      }}
                      rows={3}
                      maxLength={TOURNAMENT_CHAT_BODY_MAX}
                      placeholder={composePlaceholder(activeChannel?.kind)}
                      disabled={sending}
                      aria-label="Message"
                      className="block w-full resize-none rounded-t-xl border-0 bg-transparent px-3.5 pt-3 pb-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60"
                    />
                    <div className="flex items-center justify-end gap-2 border-t border-border/60 px-2.5 py-2 sm:justify-between">
                      <p className="hidden px-1 text-xs text-muted-foreground sm:block">
                        Enter to send · Shift+Enter for new line
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={sending || !draft.trim()}
                        onClick={() => void handleSend()}
                        className="h-8 gap-1.5 px-3"
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sending ? "Sending…" : "Send"}
                      </Button>
                    </div>
                  </div>

                  {error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {activeChannel?.kind === "announcements"
                    ? "Only the tournament host can post announcements."
                    : "Only team captains and school officers on confirmed teams can post here."}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
