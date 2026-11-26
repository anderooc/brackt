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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { removeTeamMember, updateTeamMemberVolleyballPosition } from "../actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { JerseyNumberField } from "./jersey-number-field";
import { VolleyballPositionField } from "@/components/roster/volleyball-position-field";
import type { VolleyballPosition } from "@/types";

interface Member {
  id: string;
  role: "captain" | "player";
  jerseyNumber: number | null;
  userId: string;
  fullName: string;
  email: string;
  volleyballPosition: VolleyballPosition | null;
}

export function RosterRow({
  member,
  isCaptain,
  teamId,
}: {
  member: Member;
  isCaptain: boolean;
  teamId: string;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  async function handleRemove() {
    setRemoving(true);
    try {
      const result = await removeTeamMember(teamId, member.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Removed ${member.fullName} from the roster.`);
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {isCaptain ? (
            <JerseyNumberField
              key={`${member.id}-${member.jerseyNumber ?? "none"}`}
              memberId={member.id}
              jerseyNumber={member.jerseyNumber}
            />
          ) : member.jerseyNumber !== null ? (
            <span className="w-11 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
              {member.jerseyNumber}
            </span>
          ) : (
            <span className="w-11 shrink-0 text-center text-sm font-bold text-muted-foreground/40">
              —
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-tight">
              {member.fullName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-auto">
          <VolleyballPositionField
            key={`${member.id}-${member.volleyballPosition ?? "none"}`}
            position={member.volleyballPosition}
            playerName={member.fullName}
            canEdit={isCaptain}
            onSave={(next) =>
              updateTeamMemberVolleyballPosition(member.id, next)
            }
          />
          <Badge
            variant={member.role === "captain" ? "default" : "secondary"}
            className="capitalize"
          >
            {member.role}
          </Badge>
          {isCaptain && member.role !== "captain" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRemove}
              disabled={removing}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">
                {removing ? "Removing…" : `Remove ${member.fullName}`}
              </span>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
