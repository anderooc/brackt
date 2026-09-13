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

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Copy,
  FileText,
  Link2,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  renameTournament,
  deleteTournament,
  duplicateTournament,
  updateTournamentDate,
  updateTournamentListingDetails,
} from "../actions";
import { isTournamentArchived } from "@/lib/tournament-status";
import { setTournamentScheduleFocus } from "@/lib/tournaments/schedule-focus";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { StatusControls } from "./status-controls";
import { TournamentHostChecklist } from "@/components/tournament-host-checklist";
import { TeamAttributesBadges } from "@/components/team-attributes-badges";
import { TournamentHostSchoolLink } from "@/components/tournament-host-school-link";
import type { HostChecklistStep } from "@/lib/tournaments/permissions";
import {
  evaluateListingDetailsChecklist,
  listingDetailsHint,
} from "@/lib/tournaments/listing-details-checklist";
import type { TournamentHostSchool } from "@/lib/tournaments/host-school";
import type { TeamGender, TeamRegion } from "@/types";
import { TournamentHeaderMeta } from "@/components/tournament-header-meta";
import { AddressMapPreview } from "@/components/address-map-preview";

type DeleteStep = "intro" | "confirm";

export function TournamentPageHeading({
  tournamentId,
  initialSlug,
  initialName,
  description,
  location,
  address,
  date,
  gender,
  region,
  organizerName,
  status,
  showRegisterLink = false,
  hostChecklistSteps = [],
  hostSchool = null,
  hasScheduledMatches = false,
  compact = false,
}: {
  tournamentId: string;
  initialSlug: string;
  initialName: string;
  description: string | null;
  location: string;
  address: string | null;
  date: string;
  gender: TeamGender;
  region: TeamRegion;
  organizerName: string;
  status: string;
  showRegisterLink?: boolean;
  hostChecklistSteps?: HostChecklistStep[];
  hostSchool?: TournamentHostSchool | null;
  hasScheduledMatches?: boolean;
  /** Tighter layout when setup tab has no pools or courts yet. */
  compact?: boolean;
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

  const [listingDescription, setListingDescription] = useState(description);
  const [listingLocation, setListingLocation] = useState(location);
  const [listingAddress, setListingAddress] = useState(address ?? "");

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draftDescription, setDraftDescription] = useState(description ?? "");
  const [draftLocation, setDraftLocation] = useState(location);
  const [draftAddress, setDraftAddress] = useState(address ?? "");
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [dateOpen, setDateOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(date);
  const [dateSaving, setDateSaving] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  useEffect(() => {
    if (detailsOpen) return;
    queueMicrotask(() => {
      setListingDescription(description);
      setListingLocation(location);
      setListingAddress(address ?? "");
    });
  }, [description, location, address, detailsOpen]);

  useEffect(() => {
    queueMicrotask(() => {
      setSlug(initialSlug);
      setName(initialName);
      if (!editingTitle) setDraftTitle(initialName);
    });
  }, [initialSlug, initialName, editingTitle]);

  const archived = isTournamentArchived(date);

  /** Re-evaluate listing step from saved client state so the checklist updates right after save. */
  const resolvedChecklistSteps = useMemo(() => {
    if (hostChecklistSteps.length === 0) return hostChecklistSteps;
    const listing = evaluateListingDetailsChecklist({
      description: listingDescription,
      address: listingAddress,
      hasScheduledMatches,
    });
    return hostChecklistSteps.map((step) =>
      step.id === "listing"
        ? {
            ...step,
            done: listing.complete,
            hint: listing.complete
              ? undefined
              : listingDetailsHint(listing, hasScheduledMatches),
          }
        : step
    );
  }, [
    hostChecklistSteps,
    listingDescription,
    listingAddress,
    hasScheduledMatches,
  ]);

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

  async function commitListingDetails() {
    setDetailsSaving(true);
    setDetailsError(null);
    const result = await updateTournamentListingDetails(tournamentId, {
      description: draftDescription,
      location: draftLocation,
      address: draftAddress,
    });
    if ("error" in result && result.error) {
      setDetailsError(result.error);
      setDetailsSaving(false);
      return;
    }
    if ("success" in result && result.success) {
      setListingDescription(result.description);
      setListingLocation(result.location);
      setListingAddress(result.address ?? "");
      setDetailsOpen(false);
      setDetailsSaving(false);
      startTransition(() => {
        router.refresh();
      });
      return;
    }
    setDetailsSaving(false);
  }

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
    <div
      className={cn(
        "flex flex-col",
        compact ? "gap-3" : "gap-4",
        "lg:flex-row lg:items-start lg:justify-between"
      )}
    >
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-2">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {editingTitle ? (
              <div className="min-w-0 w-full flex-1 sm:max-w-[min(100%,42rem)]">
                <input
                  ref={titleInputRef}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  disabled={titleSaving}
                  aria-label="Tournament name"
                  className={cn(
                    "w-full min-w-0 border-0 border-b-2 border-primary bg-transparent px-0 py-0.5 text-2xl font-bold tracking-tight text-foreground caret-primary shadow-none outline-none ring-0 transition-[border-color] duration-150",
                    "focus-visible:border-primary focus-visible:ring-0",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    compact ? "sm:text-2xl" : "sm:text-3xl"
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
              <h1
                className={cn(
                  "min-w-0 max-w-full text-balance font-bold tracking-tight",
                  compact ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"
                )}
              >
                {name}
              </h1>
            )}
            <StatusBadge
              kind="tournament"
              status={status}
              date={date}
              className="shrink-0 self-start"
            />
          </div>
          <TournamentHeaderMeta
            location={listingLocation}
            address={listingAddress}
            date={date}
            organizerName={organizerName}
            compact={compact}
          />
          <div className="flex min-w-0 max-w-full items-center gap-1.5 max-md:overflow-x-auto max-md:pb-0.5 max-md:[scrollbar-width:none]">
            <TeamAttributesBadges gender={gender} region={region} />
            <TournamentHostSchoolLink school={hostSchool} className="shrink-0" />
          </div>
        </div>
        {listingDescription ? (
          <p
            className={cn(
              "max-w-2xl whitespace-pre-wrap text-muted-foreground",
              compact
                ? "line-clamp-2 text-xs"
                : "text-sm"
            )}
          >
            {listingDescription}
          </p>
        ) : (
          <p
            className={cn(
              "max-w-2xl italic text-muted-foreground/80",
              compact ? "text-xs" : "text-sm"
            )}
          >
            No description yet. Use the menu to edit listing details.
          </p>
        )}
      </div>

      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-2.5 border-t border-border/50 pt-3 max-lg:rounded-lg max-lg:bg-muted/15 max-lg:p-3 lg:w-auto lg:border-0 lg:bg-transparent lg:p-0 lg:pt-0",
          compact ? "gap-2" : "gap-2.5"
        )}
      >
        {showRegisterLink && (
          <Link
            href={`/tournaments/${slug}/register`}
            className={buttonVariants({
              size: compact ? "sm" : "default",
              className: "w-full sm:w-auto sm:self-end",
            })}
          >
            Add / register teams
          </Link>
        )}
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-end">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {resolvedChecklistSteps.length > 0 ? (
              <TournamentHostChecklist steps={resolvedChecklistSteps} />
            ) : null}
            <StatusControls
              tournamentId={tournamentId}
              currentStatus={status}
              archived={archived}
            />
          </div>
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
                  onClick={() => {
                    setDraftDescription(listingDescription ?? "");
                    setDraftLocation(listingLocation);
                    setDraftAddress(listingAddress);
                    setDetailsError(null);
                    setDetailsOpen(true);
                  }}
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
      </div>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          if (detailsSaving && open) return;
          if (open) {
            setDraftDescription(listingDescription ?? "");
            setDraftLocation(listingLocation);
            setDraftAddress(listingAddress);
            setDetailsError(null);
          } else {
            setDetailsError(null);
          }
          setDetailsOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={!detailsSaving}>
          <DialogHeader>
            <DialogTitle>Edit listing details</DialogTitle>
            <DialogDescription>
              Update the public description, venue, and address. Include entry
              fees and start time in the description so teams know what to
              expect.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="listing-description">Description</Label>
              <Textarea
                id="listing-description"
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                disabled={detailsSaving}
                rows={5}
                placeholder="Start time, entry fee for the first team, fee for each additional team, format, and other details..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing-location">Location</Label>
              <Input
                id="listing-location"
                value={draftLocation}
                onChange={(e) => setDraftLocation(e.target.value)}
                disabled={detailsSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="listing-address">Address (optional)</Label>
              <Input
                id="listing-address"
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
                disabled={detailsSaving}
                placeholder="Street address or facility name"
              />
              {detailsOpen && !detailsSaving ? (
                <AddressMapPreview
                  address={draftAddress}
                  location={draftLocation}
                  height={160}
                />
              ) : null}
            </div>
          </div>
          {detailsError && (
            <p className="text-sm text-destructive" role="alert">
              {detailsError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailsOpen(false)}
              disabled={detailsSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void commitListingDetails()}
              disabled={
                detailsSaving || draftLocation.trim().length === 0
              }
            >
              {detailsSaving ? "Saving…" : "Save details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
