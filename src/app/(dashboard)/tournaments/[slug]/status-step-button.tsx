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

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateTournamentStatus } from "../actions";
import { Button } from "@/components/ui/button";
import type { TournamentStatus } from "@/types";

/** One-click status change for the Overview "next step" call to action. */
export function StatusStepButton({
  tournamentId,
  status,
  label,
}: {
  tournamentId: string;
  status: TournamentStatus;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await updateTournamentStatus(tournamentId, status);
          if (result?.error) {
            toast.error(result.error);
            return;
          }
          router.refresh();
        });
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
