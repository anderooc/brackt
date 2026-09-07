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
import Image from "next/image";
import { Download, Share, X } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PwaInstallBanner() {
  const { canInstall, isInstalled, isIos, promptInstall, dismissPrompt, isDismissed } =
    usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);

  // If already installed, not installable, or dismissed within 7 days, don't show
  if (isInstalled || !canInstall || isDismissed) {
    return null;
  }

  return (
    <>
      <aside
        aria-label="Install brackt app prompt"
        className="fixed bottom-4 right-4 z-40 hidden sm:flex max-w-sm items-center gap-3 rounded-xl border bg-card/95 p-3.5 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4"
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-primary/10">
          <Image
            src="/icons/icon-192.png"
            alt="brackt app icon"
            width={40}
            height={40}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-tight text-foreground">
            Install brackt app
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Instant court schedules & offline tournament score sheets.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isIos ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setShowIosGuide(true)}
              className="h-7 text-xs px-2.5"
            >
              <Share className="mr-1 h-3 w-3" />
              Add
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                promptInstall();
              }}
              className="h-7 text-xs px-2.5"
            >
              <Download className="mr-1 h-3 w-3" />
              Install
            </Button>
          )}

          <button
            type="button"
            onClick={dismissPrompt}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dismiss install prompt"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>

      {/* iOS Installation Instructions Modal */}
      <Dialog open={showIosGuide} onOpenChange={setShowIosGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4 text-primary" />
              Install on iPhone or iPad
            </DialogTitle>
            <DialogDescription className="text-xs">
              Install brackt to your home screen for one-tap court schedules and full offline score support:
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-xs text-foreground/90 my-2">
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                1
              </span>
              <span>
                Tap the <strong>Share</strong> button (box with an arrow pointing up) in Safari&apos;s toolbar.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                2
              </span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                3
              </span>
              <span>
                Tap <strong>Add</strong> in the top-right corner to finish.
              </span>
            </li>
          </ol>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setShowIosGuide(false);
                dismissPrompt();
              }}
              className="text-xs"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
