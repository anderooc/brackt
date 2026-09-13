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

import { db } from "@/lib/db";
import {
  courts,
  courtDivisions,
  divisions,
  tournamentStaff,
  tournaments,
  users,
} from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { CourtManager } from "../court-manager";
import { PoolManager } from "../pool-manager";
import { RegistrationAvailabilityForm } from "../waitlist-controls";
import { TournamentStaffPanel } from "../tournament-staff-panel";
import type { TournamentStaffRole } from "@/types";

export async function TournamentSetupPanel({
  tournamentId,
  canEditSetup,
  canManageStaff = false,
}: {
  tournamentId: string;
  canEditSetup: boolean;
  canManageStaff?: boolean;
}) {
  const [tournamentRow, tournamentDivisions, courtJoinRows, staffRows] =
    await Promise.all([
      db
        .select({
          playFormat: tournaments.playFormat,
          registrationCapacity: tournaments.registrationCapacity,
          registrationDeadline: tournaments.registrationDeadline,
        })
        .from(tournaments)
        .where(eq(tournaments.id, tournamentId))
        .limit(1)
        .then((rows) => rows[0]),
      db
        .select()
        .from(divisions)
        .where(eq(divisions.tournamentId, tournamentId))
        .orderBy(asc(divisions.name), asc(divisions.id)),
      db
        .select({
          courtId: courts.id,
          courtName: courts.name,
          divisionId: divisions.id,
          divisionName: divisions.name,
        })
        .from(courts)
        .leftJoin(courtDivisions, eq(courtDivisions.courtId, courts.id))
        .leftJoin(divisions, eq(courtDivisions.divisionId, divisions.id))
        .where(eq(courts.tournamentId, tournamentId))
        .orderBy(asc(courts.name), asc(courts.id)),
      canManageStaff || canEditSetup
        ? db
            .select({
              userId: tournamentStaff.userId,
              role: tournamentStaff.role,
              fullName: users.fullName,
              email: users.email,
            })
            .from(tournamentStaff)
            .innerJoin(users, eq(users.id, tournamentStaff.userId))
            .where(eq(tournamentStaff.tournamentId, tournamentId))
            .orderBy(asc(users.fullName), asc(users.email))
        : Promise.resolve([]),
    ]);

  type CourtDivPair = { divisionId: string; divisionName: string };
  const courtOrder: string[] = [];
  const courtNameById = new Map<string, string>();
  const pairsByCourt = new Map<string, CourtDivPair[]>();
  for (const row of courtJoinRows) {
    if (!courtNameById.has(row.courtId)) {
      courtNameById.set(row.courtId, row.courtName);
      courtOrder.push(row.courtId);
    }
    if (row.divisionId && row.divisionName) {
      const list = pairsByCourt.get(row.courtId) ?? [];
      list.push({
        divisionId: row.divisionId,
        divisionName: row.divisionName,
      });
      pairsByCourt.set(row.courtId, list);
    }
  }

  const tournamentCourts = courtOrder.map((cid) => {
    const pairs = (pairsByCourt.get(cid) ?? [])
      .slice()
      .sort((a, b) => a.divisionName.localeCompare(b.divisionName));
    return {
      id: cid,
      name: courtNameById.get(cid)!,
      divisionIds: pairs.map((p) => p.divisionId),
      divisionNames: pairs.map((p) => p.divisionName),
    };
  });

  const emptySetup =
    tournamentDivisions.length === 0 && tournamentCourts.length === 0;

  return (
    <div className={emptySetup ? "space-y-4" : "space-y-10"}>
      <RegistrationAvailabilityForm
        tournamentId={tournamentId}
        initialCapacity={tournamentRow?.registrationCapacity ?? null}
        initialDeadline={
          tournamentRow?.registrationDeadline?.toISOString() ?? null
        }
        canEdit={canEditSetup}
      />
      {(canManageStaff || staffRows.length > 0) && (
        <TournamentStaffPanel
          tournamentId={tournamentId}
          canManage={canManageStaff}
          initialStaff={staffRows.map((row) => ({
            userId: row.userId,
            fullName: row.fullName,
            email: row.email,
            role: row.role as TournamentStaffRole,
          }))}
        />
      )}
      <section className={emptySetup ? "space-y-1.5" : "space-y-3"}>
        <h2
          className={
            emptySetup
              ? "text-base font-semibold tracking-tight"
              : "text-lg font-semibold tracking-tight"
          }
        >
          Pools
        </h2>
        <PoolManager
          tournamentId={tournamentId}
          playFormat={tournamentRow?.playFormat ?? "pool_to_bracket"}
          divisions={tournamentDivisions}
          tournamentCourts={tournamentCourts.map((c) => ({
            id: c.id,
            name: c.name,
            divisionIds: c.divisionIds,
          }))}
          isOrganizer={canEditSetup}
          compactEmpty={emptySetup}
        />
      </section>
      <section className={emptySetup ? "space-y-1.5" : "space-y-3"}>
        <h2
          className={
            emptySetup
              ? "text-base font-semibold tracking-tight"
              : "text-lg font-semibold tracking-tight"
          }
        >
          Courts
        </h2>
        {!emptySetup && (
          <p className="text-sm text-muted-foreground">
            Used when auto-scheduling matches and on the live scoring view.
          </p>
        )}
        <CourtManager
          tournamentId={tournamentId}
          courts={tournamentCourts.map((c) => ({
            id: c.id,
            name: c.name,
            divisionNames: c.divisionNames,
          }))}
          isOrganizer={canEditSetup}
          compactEmpty={emptySetup}
        />
      </section>
    </div>
  );
}
