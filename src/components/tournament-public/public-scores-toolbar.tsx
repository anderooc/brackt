"use client";

/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 */

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Monitor, QrCode as QrIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ShareScoreboardDialog } from "./share-scoreboard-dialog";

export function PublicScoresToolbar({
  slug,
  tournamentName,
}: {
  slug: string;
  tournamentName: string;
}) {
  const [copied, setCopied] = useState(false);
  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/explore/tournaments/${slug}/scores`
      : `/explore/tournaments/${slug}/scores`;
  const kioskUrl = `/explore/tournaments/${slug}/scores?kiosk=1`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Share dialog with QR code and mobile share */}
      <ShareScoreboardDialog
        slug={slug}
        tournamentName={tournamentName}
        trigger={({ onClick }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClick}
            className="h-8 gap-1.5 text-xs"
          >
            <QrIcon className="h-3.5 w-3.5 text-primary" />
            <span>Share & QR</span>
          </Button>
        )}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => void copyLink()}
        className="h-8 gap-1.5 text-xs"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? "Copied link" : "Copy link"}
      </Button>

      <Link
        href={kioskUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 text-xs")}
        title={`Open kiosk display for ${tournamentName}`}
      >
        <Monitor className="h-3.5 w-3.5" />
        <span>Kiosk mode</span>
      </Link>

      <span className="sr-only">
        Shareable scoreboard at {shareUrl}. Kiosk at {kioskUrl}.
      </span>
    </div>
  );
}
