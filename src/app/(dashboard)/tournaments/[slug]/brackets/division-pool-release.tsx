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

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { releaseDivisionPools } from "../../actions";
import { cn } from "@/lib/utils";

export function DivisionPoolRelease({
  tournamentId,
  divisionId,
  divisionName,
  poolsReleasedAt,
  matchCount,
  completedMatchCount,
}: {
  tournamentId: string;
  divisionId: string;
  divisionName: string;
  poolsReleasedAt: Date | null;
  matchCount: number;
  completedMatchCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const released = poolsReleasedAt != null;
  const poolPlayComplete =
    matchCount > 0 && completedMatchCount === matchCount;

  function handleRelease() {
    setError(null);
    startTransition(async () => {
      const result = await releaseDivisionPools(tournamentId, divisionId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (released) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
        <Badge
          variant="outline"
          className="w-fit border-success/25 bg-success/10 text-success"
        >
          Released
        </Badge>
        <p className="text-pretty text-sm text-muted-foreground">
          {divisionName} is visible to all participants
          {poolsReleasedAt
            ? ` · ${format(new Date(poolsReleasedAt), "MMM d, h:mm a")}`
            : ""}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-dashed bg-muted/30 px-3 py-3",
        pending && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-base font-medium">Host only — not released yet</p>
          <p className="text-pretty text-sm leading-snug text-muted-foreground">
            Only you can see {divisionName} until you release it. Participants
            will then see standings, matches, and brackets.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-10 w-full shrink-0 sm:h-9 sm:w-auto"
          disabled={pending || matchCount === 0}
          onClick={handleRelease}
        >
          {pending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Eye className="mr-1 h-3.5 w-3.5" />
          )}
          Release to participants
        </Button>
      </div>
      {matchCount === 0 ? (
        <p className="text-sm text-muted-foreground">
          Save seeding in Play › Pools to generate matches before releasing.
        </p>
      ) : !poolPlayComplete ? (
        <p className="text-sm text-warning">
          {completedMatchCount} of {matchCount} pool matches complete — you can
          still release early if needed.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          All pool matches are complete. Ready to release.
        </p>
      )}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
