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

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Monitor,
  Share2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { QrCode } from "@/components/ui/qr-code";
import { cn } from "@/lib/utils";

interface ShareScoreboardDialogProps {
  slug: string;
  tournamentName: string;
  trigger?: (props: { onClick: () => void }) => React.ReactNode;
}

export function ShareScoreboardDialog({
  slug,
  tournamentName,
  trigger,
}: ShareScoreboardDialogProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const scoresPath = `/explore/tournaments/${slug}/scores`;
  const kioskPath = `/explore/tournaments/${slug}/scores?kiosk=1`;

  const origin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://brack-t.com";

  const fullShareUrl = `${origin}${scoresPath}`;
  const fullKioskUrl = `${origin}${kioskPath}`;

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard fails
    }
  }

  async function handleNativeShare() {
    if (!canShare) {
      handleCopy();
      return;
    }
    try {
      await navigator.share({
        title: `${tournamentName} Live Scores | brackt`,
        text: `Follow live match scores and court schedules for ${tournamentName} on brackt. No sign-in required!`,
        url: fullShareUrl,
      });
    } catch {
      // User cancelled or share failed
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        trigger({ onClick: () => setOpen(true) })
      ) : (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
            />
          }
        >
          <Share2 className="h-3.5 w-3.5" />
          <span>Share scoreboard</span>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Share2 className="h-4 w-4 text-primary" />
            Share Live Scoreboard
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Spectators, parents, and players can follow real-time scores and court schedules without creating an account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center rounded-xl border bg-muted/20 p-5 text-center">
            <QrCode
              value={fullShareUrl}
              size={180}
              className="bg-white p-2.5 shadow-md"
              ariaLabel={`QR code to open ${tournamentName} scoreboard`}
            />
            <div className="mt-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Scan with phone camera
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs">
                Perfect for printing on score tables or showing on gym projectors.
              </p>
            </div>
          </div>

          {/* Share URL copy field */}
          <div className="space-y-1.5">
            <label
              htmlFor="share-url-input"
              className="text-xs font-medium text-foreground"
            >
              Public Scoreboard Link
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="share-url-input"
                readOnly
                value={fullShareUrl}
                className="h-8 text-xs font-mono bg-muted/40 selection:bg-primary/20"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="h-8 shrink-0 text-xs gap-1.5 px-3"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-success" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {canShare ? (
              <Button
                type="button"
                onClick={handleNativeShare}
                className="w-full text-xs h-8 gap-1.5"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Send to contacts</span>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCopy}
                className="w-full text-xs h-8 gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy full link</span>
              </Button>
            )}

            <Link
              href={fullKioskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "w-full text-xs h-8 gap-1.5"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Projector / TV</span>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
