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

import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  courtDivisions,
  courts,
  divisions,
  tournaments,
} from "@/lib/db/schema";
import { OperationValidationError } from "@/lib/tournaments/competition-operation-rules";
import { slugify, uniqueSlug } from "@/lib/utils/slug";

type DuplicateDatabase = Pick<typeof db, "transaction" | "select">;

export type DuplicateTournamentResult = {
  id: string;
  slug: string;
  name: string;
};

/**
 * Clone listing/setup into a new draft. Copies divisions, courts, and
 * court–division links. Skips registrations, matches, pools, brackets, chat,
 * payments, waitlists, emails, and waiver file storage paths.
 */
export async function duplicateTournamentAsDraft(input: {
  sourceTournamentId: string;
  actorId: string;
}): Promise<DuplicateTournamentResult> {
  return duplicateTournamentAsDraftWithDb(input, db);
}

export async function duplicateTournamentAsDraftWithDb(
  input: {
    sourceTournamentId: string;
    actorId: string;
  },
  database: DuplicateDatabase
): Promise<DuplicateTournamentResult> {
  return database.transaction(async (rawTx) => {
    const tx = rawTx as unknown as typeof db;

    const [source] = await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, input.sourceTournamentId))
      .limit(1);
    if (!source) {
      throw new OperationValidationError("Tournament not found");
    }

    const copyName = `${source.name.trim()} (copy)`.slice(0, 200);
    const baseSlug = slugify(copyName, "tournament");
    const existingSlugs = await tx
      .select({ slug: tournaments.slug })
      .from(tournaments);
    const slug = uniqueSlug(
      baseSlug,
      existingSlugs.map((row) => row.slug)
    );

    const [created] = await tx
      .insert(tournaments)
      .values({
        organizerId: input.actorId,
        hostSchoolId: source.hostSchoolId,
        gender: source.gender,
        region: source.region,
        name: copyName,
        slug,
        description: source.description,
        date: source.date,
        location: source.location,
        address: source.address,
        status: "draft",
        registrationCapacity: null,
        registrationDeadline: null,
        matchFormat: source.matchFormat,
        setStartingScore: source.setStartingScore,
        setTargetScore: source.setTargetScore,
        tiebreakTargetScore: source.tiebreakTargetScore,
        bracketSetStartingScore: source.bracketSetStartingScore,
        playFormat: source.playFormat,
        warmupFormat: source.warmupFormat,
        poolTiebreakCriteria: source.poolTiebreakCriteria,
        bracketCount: source.bracketCount,
        goldTeamCount: source.goldTeamCount,
        silverTeamCount: source.silverTeamCount,
        poolSettingsSavedAt: source.poolSettingsSavedAt,
        bracketSettingsSavedAt: source.bracketSettingsSavedAt,
        packetNotes: source.packetNotes,
        packetAccentColor: source.packetAccentColor,
        waiverEnabled: source.waiverEnabled,
        waiverAllowDownloadPrint: source.waiverAllowDownloadPrint,
        waiverAllowThirdParty: source.waiverAllowThirdParty,
        waiverAllowDigitalAck: source.waiverAllowDigitalAck,
        waiverThirdPartyUrl: source.waiverThirdPartyUrl,
        waiverRequiredBeforeCheckIn: source.waiverRequiredBeforeCheckIn,
        // Payment settings / files / live data intentionally omitted.
      })
      .returning({
        id: tournaments.id,
        slug: tournaments.slug,
        name: tournaments.name,
      });

    const sourceDivisions = await tx
      .select()
      .from(divisions)
      .where(eq(divisions.tournamentId, source.id))
      .orderBy(asc(divisions.name), asc(divisions.id));

    const divisionIdMap = new Map<string, string>();
    for (const division of sourceDivisions) {
      const [inserted] = await tx
        .insert(divisions)
        .values({
          tournamentId: created.id,
          name: division.name,
          format: division.format,
          bracketCount: division.bracketCount,
          goldTeamCount: division.goldTeamCount,
          silverTeamCount: division.silverTeamCount,
          poolsReleasedAt: null,
        })
        .returning({ id: divisions.id });
      divisionIdMap.set(division.id, inserted.id);
    }

    const sourceCourts = await tx
      .select()
      .from(courts)
      .where(eq(courts.tournamentId, source.id))
      .orderBy(asc(courts.name), asc(courts.id));

    const courtIdMap = new Map<string, string>();
    for (const court of sourceCourts) {
      const [inserted] = await tx
        .insert(courts)
        .values({
          tournamentId: created.id,
          name: court.name,
        })
        .returning({ id: courts.id });
      courtIdMap.set(court.id, inserted.id);
    }

    if (sourceCourts.length > 0 && divisionIdMap.size > 0) {
      const sourceCourtIds = sourceCourts.map((c) => c.id);
      const links = await tx
        .select({
          courtId: courtDivisions.courtId,
          divisionId: courtDivisions.divisionId,
        })
        .from(courtDivisions)
        .innerJoin(courts, eq(courts.id, courtDivisions.courtId))
        .where(
          and(
            eq(courts.tournamentId, source.id),
            // Keep join scoped; court ids already belong to source.
            ne(courtDivisions.courtId, "00000000-0000-0000-0000-000000000000")
          )
        );

      // Prefer filtering in JS when few courts; re-query with inArray if needed.
      void sourceCourtIds;
      const linkRows = links
        .map((link) => {
          const newCourtId = courtIdMap.get(link.courtId);
          const newDivisionId = divisionIdMap.get(link.divisionId);
          if (!newCourtId || !newDivisionId) return null;
          return { courtId: newCourtId, divisionId: newDivisionId };
        })
        .filter((row): row is { courtId: string; divisionId: string } => row != null);

      if (linkRows.length > 0) {
        await tx.insert(courtDivisions).values(linkRows);
      }
    }

    return created;
  });
}
