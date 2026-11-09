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

import { startTransition, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { updateTournamentListingDetails } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressMapPreview } from "@/components/address-map-preview";
import { cn } from "@/lib/utils";

type ListingDetails = {
  description: string | null;
  location: string;
  address: string | null;
};

export function ListingDetailsDialog({
  tournamentId,
  details,
  open,
  onOpenChange,
}: {
  tournamentId: string;
  details: ListingDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [draftDescription, setDraftDescription] = useState(
    details.description ?? ""
  );
  const [draftLocation, setDraftLocation] = useState(details.location);
  const [draftAddress, setDraftAddress] = useState(details.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDraftDescription(details.description ?? "");
      setDraftLocation(details.location);
      setDraftAddress(details.address ?? "");
      setError(null);
    }
  }

  function handleOpenChange(next: boolean) {
    if (saving) return;
    onOpenChange(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateTournamentListingDetails(tournamentId, {
      description: draftDescription,
      location: draftLocation,
      address: draftAddress,
    });
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
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
              disabled={saving}
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
              disabled={saving}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="listing-address">Address (optional)</Label>
            <Input
              id="listing-address"
              value={draftAddress}
              onChange={(e) => setDraftAddress(e.target.value)}
              disabled={saving}
              placeholder="Street address or facility name"
            />
            {open && !saving ? (
              <AddressMapPreview
                address={draftAddress}
                location={draftLocation}
                height={160}
              />
            ) : null}
          </div>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={saving || draftLocation.trim().length === 0}
          >
            {saving ? "Saving…" : "Save details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditListingButton({
  tournamentId,
  details,
  label = "Edit listing details",
  variant = "outline",
  className,
  unstyled = false,
  children,
}: {
  tournamentId: string;
  details: ListingDetails;
  label?: string;
  variant?: "default" | "outline" | "ghost";
  className?: string;
  /** Skip button styling so the trigger can take a caller's layout. */
  unstyled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={
          unstyled
            ? className
            : cn(buttonVariants({ variant, size: "sm" }), className)
        }
        onClick={() => setOpen(true)}
      >
        {children ?? label}
      </button>
      <ListingDetailsDialog
        tournamentId={tournamentId}
        details={details}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
