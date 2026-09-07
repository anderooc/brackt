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
import { Clock, FastForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkShiftMatchTimesAction } from "./bulk-actions";

const PRESET_MINUTES = [15, 30, 45, 60];
const ALL_COURTS_VALUE = "__all_courts__";

export function QuickCourtDelayDialog({
  open,
  onOpenChange,
  tournamentId,
  slug,
  courts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  slug: string;
  courts: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    courts[0]?.id ?? ALL_COURTS_VALUE
  );
  const [minutes, setMinutes] = useState<number>(30);
  const [customMinutes, setCustomMinutes] = useState<string>("30");
  const [error, setError] = useState<string | null>(null);

  function handleSelectPreset(val: number) {
    setMinutes(val);
    setCustomMinutes(String(val));
    setError(null);
  }

  function handleCustomMinutesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustomMinutes(val);
    const parsed = parseInt(val, 10);
    if (!Number.isNaN(parsed) && parsed !== 0) {
      setMinutes(parsed);
      setError(null);
    }
  }

  async function handleApply() {
    const parsed = parseInt(customMinutes, 10);
    if (Number.isNaN(parsed) || parsed === 0) {
      setError("Enter a non-zero number of minutes to shift.");
      return;
    }
    if (Math.abs(parsed) > 720) {
      setError("Shift cannot exceed 12 hours.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const courtParam =
        selectedCourtId === ALL_COURTS_VALUE ? undefined : selectedCourtId;
      const res = await bulkShiftMatchTimesAction(tournamentId, slug, {
        minutes: parsed,
        courtId: courtParam,
      });

      if (!res.success) {
        setError(res.error);
        toast.error(res.error);
      } else {
        toast.success(res.message);
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  const courtLabel =
    selectedCourtId === ALL_COURTS_VALUE
      ? "all courts"
      : (courts.find((c) => c.id === selectedCourtId)?.name ?? "selected court");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FastForward className="h-4 w-4 text-primary" />
            Quick Court Delay
          </DialogTitle>
          <DialogDescription>
            Shift scheduled start times when play is running behind. Only active,
            uncompleted matches are shifted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="court-select">Target court</Label>
            <Select
              value={selectedCourtId}
              onValueChange={(val) => {
                if (val) setSelectedCourtId(val);
              }}
              disabled={pending}
            >
              <SelectTrigger id="court-select" className="w-full">
                <SelectValue placeholder="Select court" />
              </SelectTrigger>
              <SelectContent>
                {courts.length > 1 && (
                  <SelectItem value={ALL_COURTS_VALUE}>
                    All courts (whole tournament)
                  </SelectItem>
                )}
                {courts.map((court) => (
                  <SelectItem key={court.id} value={court.id}>
                    {court.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Delay amount</Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_MINUTES.map((m) => (
                <Button
                  key={m}
                  type="button"
                  variant={minutes === m ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleSelectPreset(m)}
                  disabled={pending}
                  className="tabular-nums"
                >
                  +{m}m
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground shrink-0">
                Custom minutes:
              </span>
              <Input
                type="number"
                value={customMinutes}
                onChange={handleCustomMinutesChange}
                disabled={pending}
                className="h-8 w-24 tabular-nums text-sm"
                placeholder="+30"
              />
              <span className="text-xs text-muted-foreground">
                (use negative to advance)
              </span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/80" />
            <span>
              Will shift upcoming matches on <strong>{courtLabel}</strong> by{" "}
              <strong>{minutes > 0 ? `+${minutes}` : minutes} minutes</strong>.
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleApply()}
            disabled={pending || courts.length === 0}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Shifting...
              </>
            ) : (
              `Apply ${minutes > 0 ? `+${minutes}` : minutes}m shift`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
