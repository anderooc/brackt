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
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addTournamentStaff,
  removeTournamentStaff,
} from "../actions";
import type { TournamentStaffRole } from "@/types";

export type TournamentStaffMember = {
  userId: string;
  fullName: string;
  email: string;
  role: TournamentStaffRole | string;
};

const ROLE_LABELS: Record<TournamentStaffRole, string> = {
  co_host: "Co-host",
  staff: "Staff",
};

export function TournamentStaffPanel({
  tournamentId,
  canManage,
  initialStaff,
}: {
  tournamentId: string;
  canManage: boolean;
  initialStaff: TournamentStaffMember[];
}) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TournamentStaffRole>("co_host");
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.set("email", email);
    formData.set("role", role);
    const result = await addTournamentStaff(tournamentId, formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    if (result?.success && result.member) {
      setStaff((prev) => [
        ...prev,
        {
          userId: result.member.id,
          fullName: result.member.fullName,
          email: result.member.email,
          role: result.member.role,
        },
      ]);
      setEmail("");
      setSuccess(`Added ${result.member.fullName} as ${ROLE_LABELS[result.member.role]}.`);
      router.refresh();
    }
    setLoading(false);
  }

  async function handleRemove(userId: string) {
    if (!canManage) return;
    setRemovingId(userId);
    setError(null);
    setSuccess(null);
    const result = await removeTournamentStaff(tournamentId, userId);
    if (result?.error) {
      setError(result.error);
      setRemovingId(null);
      return;
    }
    setStaff((prev) => prev.filter((m) => m.userId !== userId));
    setRemovingId(null);
    router.refresh();
  }

  if (!canManage && staff.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">
          Co-hosts &amp; staff
        </h2>
        <p className="text-sm text-muted-foreground">
          People listed here can run host tools for this tournament (same as
          school officers). Only the owner can add or remove them.
        </p>
      </div>

      {staff.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {staff.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email} ·{" "}
                  {ROLE_LABELS[member.role as TournamentStaffRole] ?? member.role}
                </p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={removingId === member.userId}
                  aria-label={`Remove ${member.fullName}`}
                  onClick={() => void handleRemove(member.userId)}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No co-hosts or staff yet.
        </p>
      )}

      {canManage ? (
        <form
          onSubmit={(e) => void handleAdd(e)}
          className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[1fr_8.5rem_auto]"
        >
          <div className="space-y-1.5">
            <Label htmlFor="staff-email">Email</Label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="coach@university.edu"
              required
              autoComplete="email"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-role">Role</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                if (v === "co_host" || v === "staff") setRole(v);
              }}
              disabled={loading}
            >
              <SelectTrigger id="staff-role" className="w-full">
                <SelectValue>
                  {(v) =>
                    ROLE_LABELS[v as TournamentStaffRole] ?? String(v ?? "")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="co_host">Co-host</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={loading || !email.trim()} className="w-full">
              <UserPlus className="mr-1.5 size-4" />
              {loading ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-muted-foreground" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
