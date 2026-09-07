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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SCHOOL_MEMBER_ROLE_LABELS,
  SCHOOL_MIN_OFFICERS_FOR_VERIFICATION,
} from "@/lib/constants/school";
import {
  addSchoolMember,
  bulkImportSchoolRosterAction,
  removeSchoolMember,
  transferPresidency,
  updateSchoolMemberRole,
  updateSchoolMemberVolleyballPosition,
} from "../actions";
import { Crown, FileSpreadsheet, Star, UserPlus, X } from "lucide-react";
import type { SchoolMemberRole, VolleyballPosition } from "@/types";
import { JerseyNumberField } from "@/app/(dashboard)/teams/[slug]/jersey-number-field";
import { VolleyballPositionField } from "@/components/roster/volleyball-position-field";
import { RosterBulkImportDialog } from "@/components/roster/roster-bulk-import-dialog";

type RosterMember = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string;
  volleyballPosition: VolleyballPosition | null;
  role: SchoolMemberRole;
  title: string | null;
  jerseyNumber: number | null;
};

export function SchoolRoster({
  schoolId,
  schoolName,
  members,
  canManage,
  canTransferPresidencyAction,
}: {
  schoolId: string;
  schoolName?: string;
  members: RosterMember[];
  canManage: boolean;
  canTransferPresidencyAction: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addRole, setAddRole] = useState<SchoolMemberRole>("member");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  async function handleAdd(formData: FormData) {
    setError(null);
    setInviteSent(false);
    setLoading(true);
    const result = await addSchoolMember(schoolId, formData);
    setLoading(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.invited) {
      setInviteSent(true);
      return;
    }
    router.refresh();
  }

  async function handleRemove(membershipId: string) {
    setError(null);
    setBusyId(membershipId);
    const result = await removeSchoolMember(schoolId, membershipId);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRoleChange(
    membershipId: string,
    role: SchoolMemberRole
  ) {
    setError(null);
    setBusyId(membershipId);
    const result = await updateSchoolMemberRole(schoolId, membershipId, role);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleTransfer(membershipId: string) {
    setError(null);
    setBusyId(membershipId);
    const result = await transferPresidency(schoolId, membershipId);
    setBusyId(null);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handlePositionChange(
    membershipId: string,
    volleyballPosition: VolleyballPosition | null
  ) {
    setError(null);
    const result = await updateSchoolMemberVolleyballPosition(
      schoolId,
      membershipId,
      volleyballPosition
    );
    if (result?.error) {
      setError(result.error);
    }
    return result;
  }

  const president = members.find((m) => m.role === "president");
  const officers = members.filter((m) => m.role === "officer");
  const others = members.filter((m) => m.role === "member");
  const needsMoreOfficers =
    officers.length < SCHOOL_MIN_OFFICERS_FOR_VERIFICATION;

  return (
    <div className="space-y-6">
      <Section
        title="President"
        helper="One per school."
        icon={<Crown className="h-4 w-4" />}
      >
        {president ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            <RosterRow
              member={president}
              canManage={false}
              canEditJersey={canManage}
              canEditPosition={canManage}
              canTransferPresidencyAction={false}
              isBusy={busyId === president.membershipId}
              onRemove={handleRemove}
              onRoleChange={handleRoleChange}
              onTransfer={handleTransfer}
              onPositionChange={handlePositionChange}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No president set.</p>
        )}
      </Section>

      <Section
        title={`Officers (${officers.length})`}
        helper="Can add or remove members and link teams. Also eligible for any team roster."
        icon={<Star className="h-4 w-4" />}
      >
        {needsMoreOfficers ? (
          <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            Add at least {SCHOOL_MIN_OFFICERS_FOR_VERIFICATION} officer
            {SCHOOL_MIN_OFFICERS_FOR_VERIFICATION === 1 ? "" : "s"} before
            submitting for verification.
          </p>
        ) : null}
        {officers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No officers yet.</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {officers.map((m) => (
              <RosterRow
                key={m.membershipId}
                member={m}
                canManage={canManage}
                canEditJersey={canManage}
                canEditPosition={canManage}
                canTransferPresidencyAction={canTransferPresidencyAction}
                isBusy={busyId === m.membershipId}
                onRemove={handleRemove}
                onRoleChange={handleRoleChange}
                onTransfer={handleTransfer}
                onPositionChange={handlePositionChange}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`Members (${others.length})`}
        helper="Players and other roster members. Can be added to any team in the school. Jersey numbers come from each player's profile."
      >
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="divide-y overflow-hidden rounded-lg border bg-card">
            {others.map((m) => (
              <RosterRow
                key={m.membershipId}
                member={m}
                canManage={canManage}
                canEditJersey={canManage}
                canEditPosition={canManage}
                canTransferPresidencyAction={canTransferPresidencyAction}
                isBusy={busyId === m.membershipId}
                onRemove={handleRemove}
                onRoleChange={handleRoleChange}
                onTransfer={handleTransfer}
                onPositionChange={handlePositionChange}
              />
            ))}
          </div>
        )}
      </Section>

      {canManage && (
        <div className="rounded-xl border bg-muted/30 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
              <UserPlus className="h-4 w-4" />
              Add roster member
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkDialogOpen(true)}
              className="h-8 text-xs font-medium"
            >
              <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Bulk import roster
            </Button>
          </div>
          <form action={handleAdd} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="email">School email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="member@school.edu"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                name="role"
                value={addRole}
                onChange={(e) =>
                  setAddRole(e.target.value as SchoolMemberRole)
                }
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="member">Member</option>
                <option value="officer">Officer</option>
              </select>
            </div>
            {addRole === "officer" ? (
              <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                <Label htmlFor="title">Title (optional)</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="e.g. VP, Treasurer"
                  maxLength={60}
                />
              </div>
            ) : null}
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Adding…" : "Add member"}
              </Button>
            </div>
          </form>
          {error ? (
            <p className="mt-3 text-sm text-destructive">{error}</p>
          ) : null}
          {inviteSent ? (
            <p className="mt-3 text-sm text-success">
              Invite sent! They&apos;ll get an email with a link to join.
            </p>
          ) : null}
        </div>
      )}

      {canManage && (
        <RosterBulkImportDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          context="school"
          targetId={schoolId}
          targetName={schoolName ?? "School Roster"}
          onImport={bulkImportSchoolRosterAction}
        />
      )}
    </div>
  );
}

function Section({
  title,
  helper,
  icon,
  children,
}: {
  title: string;
  helper?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h3>
        {helper ? (
          <p className="max-w-prose text-sm text-muted-foreground">{helper}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RosterRow({
  member,
  canManage,
  canEditJersey,
  canEditPosition,
  canTransferPresidencyAction,
  isBusy,
  onRemove,
  onRoleChange,
  onTransfer,
  onPositionChange,
}: {
  member: RosterMember;
  canManage: boolean;
  canEditJersey: boolean;
  canEditPosition: boolean;
  canTransferPresidencyAction: boolean;
  isBusy: boolean;
  onRemove: (id: string) => void;
  onRoleChange: (id: string, role: SchoolMemberRole) => void;
  onTransfer: (id: string) => void;
  onPositionChange: (
    id: string,
    position: VolleyballPosition | null
  ) => Promise<{ error?: string } | void>;
}) {
  const showRoleSelect = canManage && member.role !== "president";
  const showActions =
    showRoleSelect ||
    (canTransferPresidencyAction && member.role !== "president");

  return (
    <div
      className={cn(
        "px-3 py-2",
        isBusy && "opacity-60"
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {canEditJersey ? (
            <JerseyNumberField
              key={`${member.userId}-${member.jerseyNumber ?? "none"}`}
              userId={member.userId}
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
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-baseline gap-2">
              <p className="truncate text-sm font-medium leading-tight">
                {member.fullName}
              </p>
              {member.title ? (
                <span className="truncate text-xs text-muted-foreground">
                  {member.title}
                </span>
              ) : null}
              {!showRoleSelect ? (
                <Badge variant="secondary" className="shrink-0">
                  {SCHOOL_MEMBER_ROLE_LABELS[member.role]}
                </Badge>
              ) : null}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {member.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0 sm:justify-end">
          <VolleyballPositionField
            key={`${member.membershipId}-${member.volleyballPosition ?? "none"}`}
            position={member.volleyballPosition}
            playerName={member.fullName}
            canEdit={canEditPosition}
            disabled={isBusy}
            onSave={(next) => onPositionChange(member.membershipId, next)}
          />
          {showActions ? (
            <>
              {showRoleSelect ? (
                <Select
                  value={member.role}
                  onValueChange={(v) => {
                    if (v === "officer" || v === "member") {
                      onRoleChange(member.membershipId, v);
                    }
                  }}
                  disabled={isBusy}
                >
                  <SelectTrigger
                    id={`role-${member.membershipId}`}
                    size="sm"
                    className="h-8 w-full sm:h-7 sm:w-[7.25rem]"
                    aria-label={`Role for ${member.fullName}`}
                  >
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="officer">Officer</SelectItem>
                  </SelectContent>
                </Select>
              ) : null}
              {canTransferPresidencyAction && member.role !== "president" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 sm:h-7"
                  disabled={isBusy}
                  onClick={() => onTransfer(member.membershipId)}
                >
                  <Crown className="mr-1 h-3 w-3" />
                  President
                </Button>
              ) : null}
              {showRoleSelect ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive sm:h-7"
                  disabled={isBusy}
                  onClick={() => onRemove(member.membershipId)}
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove {member.fullName}</span>
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
