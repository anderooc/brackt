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

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Copy,
  FileText,
  Link2,
  MoreVertical,
  Pencil,
  Radio,
  Trash2,
  UserPlus,
} from "lucide-react";
import {
  renameTournament,
  deleteTournament,
  duplicateTournament,
  updateTournamentDate,
} from "../actions";
import { isTournamentArchived } from "@/lib/tournament-status";
import { setTournamentScheduleFocus } from "@/lib/tournaments/schedule-focus";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TournamentSummaryLine } from "@/components/tournament-header-meta";
import { StatusControls } from "./status-controls";
import { ListingDetailsDialog } from "./listing-details-dialog";

type DeleteStep = "intro" | "confirm";

export function TournamentPageHeading({
  tournamentId,
  initialSlug,
  initialName,
  description,
  location,
  address,
  date,
  status,
  showRegisterLink = false,
}: {
  tournamentId: string;
  initialSlug: string;
  initialName: string;
  description: string | null;
  location: string;
  address: string | null;
  date: string;
  status: string;
  showRegisterLink?: boolean;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [name, setName] = useState(initialName);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialName);
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const skipTitleBlurCommit = useRef(false);
  const titleCommitting = useRef(false);

  const [detailsOpen, setDetailsOpen] = useState(false);

  const [dateOpen, setDateOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSlug(initialSlug);
      setName(initialName);
      if (!editingTitle) setDraftTitle(initialName);
    });
  }, [initialSlug, initialName, editingTitle]);

  const archived = isTournamentArchived(date);

  const [copyHint, setCopyHint] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("intro");
  const [confirmText, setConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicateBusy, setDuplicateBusy] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingTitle) return;
    const id = requestAnimationFrame(() => {
      const el = titleInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [editingTitle]);

  const startRename = useCallback(() => {
    setTitleError(null);
    setDraftTitle(name);
    setEditingTitle(true);
  }, [name]);

  const cancelTitleEdit = useCallback(() => {
    skipTitleBlurCommit.current = true;
    setDraftTitle(name);
    setEditingTitle(false);
    setTitleError(null);
    queueMicrotask(() => {
      skipTitleBlurCommit.current = false;
    });
  }, [name]);

  const commitTitle = useCallback(async () => {
    if (titleCommitting.current) return;
    const next = draftTitle.trim();
    if (next === name) {
      setEditingTitle(false);
      return;
    }
    if (!next) {
      setTitleError("Name is required");
      return;
    }
    titleCommitting.current = true;
    setTitleSaving(true);
    setTitleError(null);
    const prevSlug = slug;
    const result = await renameTournament(tournamentId, draftTitle);
    if ("error" in result && result.error) {
      setTitleError(result.error);
      setTitleSaving(false);
      titleCommitting.current = false;
      return;
    }
    if ("success" in result && result.success) {
      setName(next);
      setSlug(result.slug);
      skipTitleBlurCommit.current = true;
      setEditingTitle(false);
      if (result.slug !== prevSlug) {
        router.replace(`/tournaments/${result.slug}`);
      }
      router.refresh();
      queueMicrotask(() => {
        skipTitleBlurCommit.current = false;
      });
    }
    setTitleSaving(false);
    titleCommitting.current = false;
  }, [draftTitle, name, tournamentId, router, slug]);

  async function copyPageLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyHint("Link copied");
      window.setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint("Could not copy");
      window.setTimeout(() => setCopyHint(null), 2500);
    }
  }

  function resetDeleteDialog() {
    setDeleteStep("intro");
    setConfirmText("");
    setDeleteError(null);
    setDeleteBusy(false);
  }

  async function handleDelete() {
    if (confirmText.trim() !== name.trim() || confirmText.trim() === "") return;
    setDeleteBusy(true);
    setDeleteError(null);
    const result = await deleteTournament(tournamentId, confirmText);
    if (result?.error) {
      setDeleteError(result.error);
      setDeleteBusy(false);
      return;
    }
    setDeleteOpen(false);
    resetDeleteDialog();
    router.replace("/tournaments");
    router.refresh();
  }

  async function handleDuplicate() {
    setDuplicateBusy(true);
    setDuplicateError(null);
    const result = await duplicateTournament(tournamentId);
    if (result?.error) {
      setDuplicateError(result.error);
      setDuplicateBusy(false);
      return;
    }
    if (result?.success && result.slug) {
      router.push(`/tournaments/${result.slug}`);
      router.refresh();
      return;
    }
    setDuplicateBusy(false);
  }

  const nameMatches =
    confirmText.trim() === name.trim() && confirmText.trim() !== "";

  async function commitDate() {
    const next = draftDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) {
      setDateError("Pick a valid date");
      return;
    }
    setDateSaving(true);
    setDateError(null);
    const result = await updateTournamentDate(tournamentId, next);
    if ("error" in result && result.error) {
      setDateError(result.error);
      setDateSaving(false);
      return;
    }
    // Land the schedule on this day when the host navigates back — soft
    // navigation can briefly show stale placement before the list refreshes.
    setTournamentScheduleFocus({ date: next, slug });
    setDateOpen(false);
    setDateSaving(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        {editingTitle ? (
          <div className="min-w-0 w-full sm:max-w-[min(100%,42rem)]">
            <input
              ref={titleInputRef}
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              disabled={titleSaving}
              aria-label="Tournament name"
              className={cn(
                "w-full min-w-0 border-0 border-b-2 border-primary bg-transparent px-0 py-0.5 text-2xl font-bold tracking-tight text-foreground caret-primary shadow-none outline-none ring-0 transition-[border-color] duration-150 sm:text-3xl",
                "focus-visible:border-primary focus-visible:ring-0",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commitTitle();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  cancelTitleEdit();
                }
              }}
              onBlur={() => {
                if (titleSaving || skipTitleBlurCommit.current) return;
                void commitTitle();
              }}
            />
            {titleError && (
              <p className="mt-1 text-sm text-destructive">{titleError}</p>
            )}
          </div>
        ) : (
          <h1 className="min-w-0 max-w-full text-balance text-2xl font-bold tracking-tight sm:text-3xl">
            {name}
          </h1>
        )}
        <TournamentSummaryLine
          location={location}
          address={address}
          date={date}
        />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusControls
          tournamentId={tournamentId}
          currentStatus={status}
          archived={archived}
        />
        <div className="relative flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0"
                  aria-label="Tournament options"
                />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                {showRegisterLink ? (
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => router.push(`/tournaments/${slug}/register`)}
                  >
                    <UserPlus className="size-4" />
                    Add / register teams
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push(`/tournaments/${slug}/scoring`)}
                >
                  <Radio className="size-4" />
                  Live scoring
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    startRename();
                  }}
                >
                  <Pencil className="size-4" />
                  Rename tournament
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setDetailsOpen(true)}
                >
                  <FileText className="size-4" />
                  Edit listing details
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    setDraftDate(date);
                    setDateError(null);
                    setDateOpen(true);
                  }}
                >
                  <CalendarDays className="size-4" />
                  Edit date
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => void copyPageLink()}
                >
                  <Link2 className="size-4" />
                  Copy page link
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={duplicateBusy}
                  onClick={() => void handleDuplicate()}
                >
                  <Copy className="size-4" />
                  {duplicateBusy ? "Duplicating…" : "Duplicate as draft"}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => {
                    setDeleteOpen(true);
                    setDeleteStep("intro");
                  }}
                >
                  <Trash2 className="size-4" />
                  Delete tournament
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {copyHint && (
            <span
              className="pointer-events-none absolute -bottom-6 right-0 whitespace-nowrap text-xs text-muted-foreground"
              role="status"
            >
              {copyHint}
            </span>
          )}
          {duplicateError && (
            <span
              className="pointer-events-none absolute -bottom-6 right-0 max-w-[14rem] truncate text-xs text-destructive"
              role="alert"
            >
              {duplicateError}
            </span>
          )}
        </div>
      </div>

      <ListingDetailsDialog
        tournamentId={tournamentId}
        details={{ description, location, address }}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />

      <Dialog
        open={dateOpen}
        onOpenChange={(open) => {
          if (dateSaving) return;
          if (open) {
            setDraftDate(date);
            setDateError(null);
          } else {
            setDateError(null);
          }
          setDateOpen(open);
        }}
      >
        <DialogContent
          className="overflow-visible sm:max-w-sm"
          showCloseButton={!dateSaving}
        >
          <DialogHeader>
            <DialogTitle>Edit tournament date</DialogTitle>
            <DialogDescription>
              {archived
                ? "Pick a new date. Setting today or later un-archives the tournament and re-enables the status dropdown."
                : "Pick the date this tournament happens."}
            </DialogDescription>
          </DialogHeader>
          <DatePickerField
            id="tournament-date"
            label="Date"
            value={draftDate}
            onChange={setDraftDate}
            disabled={dateSaving}
            rangeFromDates={[draftDate]}
          />
          {dateError && (
            <p className="text-sm text-destructive" role="alert">
              {dateError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDateOpen(false)}
              disabled={dateSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void commitDate()}
              disabled={dateSaving || draftDate.trim().length === 0}
            >
              {dateSaving ? "Saving…" : "Save date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) resetDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleteBusy}>
          {deleteStep === "intro" ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete this tournament?</DialogTitle>
                <DialogDescription>
                  This permanently removes pools, courts, registrations,
                  groups, brackets, scheduled matches, and scores. Teams in the
                  system are not deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteStep("confirm")}
                >
                  Confirm deletion
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirm by name</DialogTitle>
                <DialogDescription>
                  Type the tournament name exactly as shown below, then delete.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-tournament-confirm" className="sr-only">
                  Tournament name
                </Label>
                <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                  {name}
                </p>
                <Input
                  id="delete-tournament-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type the full name"
                  disabled={deleteBusy}
                  autoComplete="off"
                  spellCheck={false}
                />
                {deleteError && (
                  <p className="text-sm text-destructive" role="alert">
                    {deleteError}
                  </p>
                )}
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="sm:mr-auto"
                  disabled={deleteBusy}
                  onClick={() => {
                    setDeleteStep("intro");
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                >
                  Back
                </Button>
                <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleteBusy}
                    onClick={() => setDeleteOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!nameMatches || deleteBusy}
                    onClick={() => void handleDelete()}
                  >
                    {deleteBusy ? "Deleting…" : "Delete permanently"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
