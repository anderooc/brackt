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
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ViewportSplit } from "@/components/layout/viewport-split";
import { cn } from "@/lib/utils";
import { SCHOOL_MEMBER_ROLE_LABELS } from "@/lib/constants/school";
import { FileSpreadsheet } from "lucide-react";
import { addTeamMember, bulkImportTeamRosterAction } from "../actions";
import { VolleyballPositionLabel } from "@/components/roster/volleyball-position-field";
import { volleyballPositionSearchHaystack } from "@/lib/profile/volleyball-position";
import type { SchoolMemberRole, VolleyballPosition } from "@/types";
import { RosterBulkImportDialog } from "@/components/roster/roster-bulk-import-dialog";

export type SchoolRosterCandidate = {
  userId: string;
  fullName: string;
  email: string;
  volleyballPosition: VolleyballPosition | null;
  role: SchoolMemberRole;
  jerseyNumber: number | null;
};

const GROUPS: {
  id: string;
  label: string;
  roles: SchoolMemberRole[];
}[] = [
  { id: "officers", label: "Officers", roles: ["president", "officer"] },
  { id: "members", label: "Members", roles: ["member"] },
];

export function AddMemberForm({
  teamId,
  teamName,
  schoolRosterCandidates,
  schoolHref,
  schoolName,
  description,
}: {
  teamId: string;
  teamName?: string;
  schoolRosterCandidates?: SchoolRosterCandidate[];
  schoolHref?: string;
  schoolName?: string;
  description?: string;
}) {
  if (schoolRosterCandidates) {
    return (
      <SchoolRosterAddForm
        teamId={teamId}
        teamName={teamName}
        candidates={schoolRosterCandidates}
        schoolHref={schoolHref}
        schoolName={schoolName}
        description={description}
      />
    );
  }

  return <EmailAddForm teamId={teamId} teamName={teamName} />;
}

function EmailAddForm({
  teamId,
  teamName,
}: {
  teamId: string;
  teamName?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invited, setInvited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(false);
    setInvited(false);
    const result = await addTeamMember(teamId, formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setInvited(Boolean(result?.invited));
    }
    setLoading(false);
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Add player</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setBulkDialogOpen(true)}
          className="h-8 text-xs font-medium"
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Bulk import players
        </Button>
      </div>
      <form
        action={handleSubmit}
        className="grid gap-4 sm:grid-cols-[1fr_6.5rem_auto]"
      >
        <div className="space-y-2">
          <Label htmlFor="email">School email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="player@university.edu"
            required
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="jerseyNumber">Jersey #</Label>
          <Input
            id="jerseyNumber"
            name="jerseyNumber"
            type="number"
            placeholder="—"
            min={0}
            max={99}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Adding…" : "Add player"}
          </Button>
        </div>
      </form>
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {success ? (
        <p className="mt-3 text-sm text-success">
          {invited
            ? "Invite sent! They'll get an email with a link to join."
            : "Player added!"}
        </p>
      ) : null}

      <RosterBulkImportDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        context="team"
        targetId={teamId}
        targetName={teamName ?? "Team Roster"}
        onImport={bulkImportTeamRosterAction}
      />
    </div>
  );
}

function SchoolRosterAddForm({
  teamId,
  teamName,
  candidates,
  schoolHref,
  schoolName,
  description,
}: {
  teamId: string;
  teamName?: string;
  candidates: SchoolRosterCandidate[];
  schoolHref?: string;
  schoolName?: string;
  description?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? candidates.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          SCHOOL_MEMBER_ROLE_LABELS[c.role].toLowerCase().includes(q) ||
          volleyballPositionSearchHaystack(c.volleyballPosition).includes(q)
      )
    : candidates;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.email));
  const someFilteredSelected = filtered.some((c) => selected.has(c.email));
  const selectedPlayer =
    selected.size === 1
      ? candidates.find((candidate) => selected.has(candidate.email))
      : undefined;
  const selectedJerseyPlaceholder =
    selectedPlayer?.jerseyNumber == null
      ? "—"
      : String(selectedPlayer.jerseyNumber);

  function toggleEmail(email: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(email);
      else next.delete(email);
      return next;
    });
  }

  function toggleAllFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of filtered) {
        if (checked) next.add(c.email);
        else next.delete(c.email);
      }
      return next;
    });
  }

  async function handleAddSelected() {
    const emails = [...selected];
    if (emails.length === 0) return;

    setLoading(true);
    setError(null);
    setAddedCount(0);

    let succeeded = 0;
    let lastError: string | null = null;

    for (const email of emails) {
      const formData = new FormData();
      formData.set("email", email);
      if (emails.length === 1 && jerseyNumber.trim()) {
        formData.set("jerseyNumber", jerseyNumber.trim());
      }
      const result = await addTeamMember(teamId, formData);
      if (result?.error) {
        lastError = result.error;
        break;
      }
      succeeded += 1;
    }

    setLoading(false);
    if (succeeded > 0) {
      setAddedCount(succeeded);
      setSelected(new Set());
      setJerseyNumber("");
      router.refresh();
    }
    if (lastError) {
      setError(
        succeeded > 0
          ? `Added ${succeeded}, then stopped: ${lastError}`
          : lastError
      );
    }
  }

  return (
    <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Add from school roster</h3>
          <p className="text-sm text-muted-foreground">
            {description ?? (
              <>
                Select players from the school roster
                {schoolName ? (
                  <>
                    {" "}
                    {schoolHref ? (
                      <Link
                        href={schoolHref}
                        className="underline underline-offset-4"
                      >
                        {schoolName}
                      </Link>
                    ) : (
                      schoolName
                    )}
                  </>
                ) : null}
                . New people must be added there first.
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setBulkDialogOpen(true)}
          className="h-8 text-xs font-medium shrink-0"
        >
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-primary" />
          Bulk import players
        </Button>
      </div>

      {candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Everyone on the school roster is already on this team
          {schoolHref ? (
            <>
              , or the{" "}
              <Link
                href={schoolHref}
                className="underline underline-offset-4"
              >
                school roster
              </Link>{" "}
              is empty
            </>
          ) : null}
          .
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_6.5rem]">
            <div className="space-y-2">
              <Label htmlFor="roster-search">Search roster</Label>
              <Input
                id="roster-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, email, role, or position"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jerseyNumber">Jersey #</Label>
              <Input
                id="jerseyNumber"
                name="jerseyNumber"
                type="number"
                placeholder={selectedJerseyPlaceholder}
                min={0}
                max={99}
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                disabled={selected.size !== 1}
                title={
                  selected.size === 1
                    ? undefined
                    : "Select exactly one player to set a jersey number"
                }
              />
            </div>
          </div>

          <ViewportSplit
            mobile={
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
                  <Checkbox
                    checked={allFilteredSelected}
                    indeterminate={
                      someFilteredSelected && !allFilteredSelected
                    }
                    onCheckedChange={(checked) =>
                      toggleAllFiltered(checked === true)
                    }
                    aria-label="Select all visible players"
                  />
                  <span className="text-sm">Select visible</span>
                </div>
                <div className="max-h-80 space-y-3 overflow-auto p-2">
                  {filtered.length === 0 ? (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No roster members match “{query.trim()}”.
                    </p>
                  ) : (
                    GROUPS.map((group) => {
                      const rows = filtered.filter((c) =>
                        group.roles.includes(c.role)
                      );
                      if (rows.length === 0) return null;
                      return (
                        <div key={group.id} className="space-y-2">
                          <p className="px-1 text-xs font-medium text-muted-foreground">
                            {group.label} ({rows.length})
                          </p>
                          {rows.map((candidate) => {
                            const isChecked = selected.has(candidate.email);
                            return (
                              <div
                                key={candidate.userId}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                                  isChecked && "bg-muted/40"
                                )}
                                onClick={() =>
                                  toggleEmail(candidate.email, !isChecked)
                                }
                              >
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) =>
                                      toggleEmail(
                                        candidate.email,
                                        checked === true
                                      )
                                    }
                                    aria-label={`Select ${candidate.fullName}`}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium leading-tight">
                                    {candidate.fullName}
                                  </p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {candidate.email}
                                  </p>
                                  <VolleyballPositionLabel
                                    className="mt-1"
                                    position={candidate.volleyballPosition}
                                  />
                                </div>
                                <span className="w-11 shrink-0 text-center text-sm font-bold tabular-nums text-muted-foreground">
                                  {candidate.jerseyNumber ?? "—"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {filtered.length} available
                  {selected.size > 0 ? ` · ${selected.size} selected` : ""}
                </div>
              </div>
            }
            desktop={
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 w-10 py-0">
                          <Checkbox
                            checked={allFilteredSelected}
                            indeterminate={
                              someFilteredSelected && !allFilteredSelected
                            }
                            onCheckedChange={(checked) =>
                              toggleAllFiltered(checked === true)
                            }
                            aria-label="Select all visible players"
                          />
                        </TableHead>
                        <TableHead className="h-8 py-0">Name</TableHead>
                        <TableHead className="h-8 py-0">Pos</TableHead>
                        <TableHead className="h-8 py-0">Email</TableHead>
                        <TableHead className="h-8 w-16 py-0">#</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={5}
                            className="h-12 text-center text-muted-foreground"
                          >
                            No roster members match “{query.trim()}”.
                          </TableCell>
                        </TableRow>
                      ) : (
                        GROUPS.flatMap((group) => {
                          const rows = filtered.filter((c) =>
                            group.roles.includes(c.role)
                          );
                          if (rows.length === 0) return [];
                          return [
                            <TableRow
                              key={`group-${group.id}`}
                              className="hover:bg-transparent"
                            >
                              <TableCell
                                colSpan={5}
                                className="bg-muted/50 py-1.5 text-xs font-medium text-muted-foreground"
                              >
                                {group.label} ({rows.length})
                              </TableCell>
                            </TableRow>,
                            ...rows.map((candidate) => {
                              const isChecked = selected.has(candidate.email);
                              return (
                                <TableRow
                                  key={candidate.userId}
                                  data-state={isChecked ? "selected" : undefined}
                                  className={cn(
                                    "cursor-pointer",
                                    isChecked && "bg-muted/40"
                                  )}
                                  onClick={() =>
                                    toggleEmail(candidate.email, !isChecked)
                                  }
                                >
                                  <TableCell
                                    className="w-10 py-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      onCheckedChange={(checked) =>
                                        toggleEmail(
                                          candidate.email,
                                          checked === true
                                        )
                                      }
                                      aria-label={`Select ${candidate.fullName}`}
                                    />
                                  </TableCell>
                                  <TableCell className="max-w-[12rem] py-1.5 font-medium">
                                    <span className="block truncate text-sm leading-tight">
                                      {candidate.fullName}
                                    </span>
                                  </TableCell>
                                  <TableCell className="w-[4.5rem] py-1.5">
                                    <VolleyballPositionLabel
                                      position={candidate.volleyballPosition}
                                    />
                                  </TableCell>
                                  <TableCell className="max-w-[14rem] py-1.5 text-muted-foreground">
                                    <span className="block truncate text-xs">
                                      {candidate.email}
                                    </span>
                                  </TableCell>
                                  <TableCell className="w-16 py-1.5 text-center text-sm font-bold tabular-nums text-muted-foreground">
                                    {candidate.jerseyNumber ?? "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            }),
                          ];
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                  {filtered.length} available
                  {selected.size > 0 ? ` · ${selected.size} selected` : ""}
                </div>
              </div>
            }
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Jersey numbers come from each player&apos;s profile. Override when
              adding a single player.
            </p>
            <Button
              type="button"
              disabled={loading || selected.size === 0}
              onClick={handleAddSelected}
              className="w-full sm:w-auto"
            >
              {loading
                ? "Adding…"
                : selected.size > 1
                  ? `Add ${selected.size} players`
                  : "Add player"}
            </Button>
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {addedCount > 0 && !error ? (
        <p className="mt-3 text-sm text-success">
          {addedCount === 1
            ? "Player added!"
            : `${addedCount} players added!`}
        </p>
      ) : null}

      <RosterBulkImportDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        context="team"
        targetId={teamId}
        targetName={teamName ?? "Team Roster"}
        onImport={bulkImportTeamRosterAction}
      />
    </div>
  );
}
