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
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { submitForVerification } from "../actions";

export function VerificationControls({
  schoolId,
  canSubmit,
  blockedReason,
  status,
}: {
  schoolId: string;
  canSubmit: boolean;
  blockedReason: string | null;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (status === "verified") return null;

  // Rejected schools need an admin to reopen review — do not offer a dead CTA.
  if (status === "rejected") {
    return (
      <p className="max-w-xs text-right text-xs leading-snug text-muted-foreground">
        {blockedReason ??
          "Verification was rejected. Contact an admin to re-open this school for review."}
      </p>
    );
  }

  async function handleSubmit() {
    setLoading(true);
    const result = await submitForVerification(schoolId);
    setLoading(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Submitted for verification. An admin will review it.");
    router.refresh();
  }

  const showBlockedHint = !canSubmit && !!blockedReason;

  return (
    <div className="group relative shrink-0">
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={!canSubmit || loading}
        onClick={handleSubmit}
        title={showBlockedHint ? blockedReason : undefined}
        aria-describedby={showBlockedHint ? "verification-blocked-hint" : undefined}
      >
        {loading ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <ShieldCheck className="mr-1 h-3 w-3" />
        )}
        Submit for verification
      </Button>
      {showBlockedHint && (
        <div
          id="verification-blocked-hint"
          role="tooltip"
          className={cn(
            "pointer-events-none absolute right-0 top-full z-50 mt-1.5 w-56 rounded-lg border bg-popover p-2.5 text-xs leading-snug text-muted-foreground shadow-md ring-1 ring-foreground/10",
            "opacity-0 transition-opacity duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          {blockedReason}
        </div>
      )}
    </div>
  );
}
