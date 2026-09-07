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
import { toast } from "sonner";
import {
  Clock,
  FastForward,
  Loader2,
  MapPin,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  bulkClearScheduleAction,
  bulkReassignCourtsAction,
  bulkShiftMatchTimesAction,
} from "./bulk-actions";

const UNASSIGN_COURT_VAL = "__unassign__";

export function BulkOpsBar({
  tournamentId,
  slug,
  courts,
  selectedMatchIds,
  onClearSelection,
  onExitBulkMode,
}: {
  tournamentId: string;
  slug: string;
  courts: { id: string; name: string }[];
  selectedMatchIds: string[];
  onClearSelection: () => void;
  onExitBulkMode: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [targetCourtId, setTargetCourtId] = useState<string>(
    courts[0]?.id ?? UNASSIGN_COURT_VAL
  );
  const [shiftMinutes, setShiftMinutes] = useState<number>(30);

  const count = selectedMatchIds.length;
  if (count === 0) return null;

  function handleReassignCourt() {
    startTransition(async () => {
      const courtParam =
        targetCourtId === UNASSIGN_COURT_VAL ? null : targetCourtId;
      const res = await bulkReassignCourtsAction(
        tournamentId,
        slug,
        selectedMatchIds,
        courtParam
      );
      if (!res.success) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        onClearSelection();
        router.refresh();
      }
    });
  }

  function handleShiftTimes(minutesToShift: number) {
    startTransition(async () => {
      const res = await bulkShiftMatchTimesAction(tournamentId, slug, {
        minutes: minutesToShift,
        matchIds: selectedMatchIds,
      });
      if (!res.success) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        onClearSelection();
        router.refresh();
      }
    });
  }

  function handleClear(options: { clearTime?: boolean; clearCourt?: boolean }) {
    startTransition(async () => {
      const res = await bulkClearScheduleAction(
        tournamentId,
        slug,
        selectedMatchIds,
        options
      );
      if (!res.success) {
        toast.error(res.error);
      } else {
        toast.success(res.message);
        onClearSelection();
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[min(95vw,56rem)] animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {count} selected
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={pending}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Reassign Court */}
          {courts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Select
                value={targetCourtId}
                onValueChange={(v) => {
                  if (v) setTargetCourtId(v);
                }}
                disabled={pending}
              >
                <SelectTrigger size="sm" className="h-8 min-w-[7.5rem] text-xs">
                  <MapPin className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Court" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGN_COURT_VAL}>Unassign</SelectItem>
                  {courts.map((court) => (
                    <SelectItem key={court.id} value={court.id}>
                      {court.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReassignCourt}
                disabled={pending}
                className="h-8 text-xs font-medium"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Move"
                )}
              </Button>
            </div>
          )}

          {/* Shift Times */}
          <div className="flex items-center gap-1.5">
            <Select
              value={String(shiftMinutes)}
              onValueChange={(v) => {
                if (v) setShiftMinutes(parseInt(v, 10));
              }}
              disabled={pending}
            >
              <SelectTrigger size="sm" className="h-8 w-24 text-xs tabular-nums">
                <Clock className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">+15 min</SelectItem>
                <SelectItem value="30">+30 min</SelectItem>
                <SelectItem value="45">+45 min</SelectItem>
                <SelectItem value="60">+60 min</SelectItem>
                <SelectItem value="-15">-15 min</SelectItem>
                <SelectItem value="-30">-30 min</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleShiftTimes(shiftMinutes)}
              disabled={pending}
              className="h-8 text-xs font-medium"
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <FastForward className="mr-1 h-3 w-3" />
                  Shift
                </>
              )}
            </Button>
          </div>

          {/* Clear options dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Clear...
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleClear({ clearTime: true })}
                disabled={pending}
              >
                Clear start times
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleClear({ clearCourt: true })}
                disabled={pending}
              >
                Clear court assignments
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleClear({ clearTime: true, clearCourt: true })}
                disabled={pending}
                className="text-destructive focus:text-destructive"
              >
                Clear times and courts
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Close bulk bar */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onExitBulkMode}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Exit bulk mode"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
