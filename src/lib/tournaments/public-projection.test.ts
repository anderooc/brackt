/*
 * brackt - Collegiate club volleyball tournament hub
 * Copyright (C) 2026 Andrew Chang
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPublicTournamentListProjection } from "./public-projection";

describe("buildPublicTournamentListProjection", () => {
  it("removes operational identifiers from public tournament cards", () => {
    const projection = buildPublicTournamentListProjection([
      {
        id: "tournament-private-id",
        organizerId: "organizer-private-id",
        hostSchoolId: "school-private-id",
        slug: "lake-effect-classic",
        name: "Lake Effect Classic",
        description: "Public tournament",
        location: "Cleveland",
        date: "2027-02-13",
        status: "registration_open",
        gender: "mens",
        region: "midwest",
        registrationAvailability: Object.assign(
          {
            capacity: 24,
            deadline: "2027-03-01T17:00:00.000Z",
            registeredCount: 24,
            waitlistCount: 3,
          },
          {
            teamName: "Waiting Team",
            university: "Waiting Team University",
            requestedByUserId: "waiting-user-private-id",
          }
        ),
        hostSchool: {
          id: "school-private-id",
          contactEmail: "private@example.com",
          name: "Case Western Reserve University",
          slug: "case-western-reserve",
          verificationStatus: "verified",
        },
      },
    ]);

    assert.deepEqual(projection, [
      {
        slug: "lake-effect-classic",
        name: "Lake Effect Classic",
        description: "Public tournament",
        location: "Cleveland",
        date: "2027-02-13",
        status: "registration_open",
        gender: "mens",
        region: "midwest",
        registrationAvailability: {
          capacity: 24,
          deadline: "2027-03-01T17:00:00.000Z",
          registeredCount: 24,
          waitlistCount: 3,
        },
        hostSchool: {
          name: "Case Western Reserve University",
          slug: "case-western-reserve",
          verificationStatus: "verified",
        },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(projection),
      /private-id|Waiting Team|Waiting Team University/
    );
  });

  it("loads production explore availability in one identity-free batch", async () => {
    const loaded = await import("./public-list-loader");
    const moduleExports = loaded as unknown as {
      loadPublicTournamentList?: unknown;
      default?: { loadPublicTournamentList?: unknown };
    };
    const loadPublicTournamentList =
      moduleExports.loadPublicTournamentList ??
      moduleExports.default?.loadPublicTournamentList;
    assert.equal(typeof loadPublicTournamentList, "function");

    const availabilityBatches: string[][] = [];
    const snapshot = { id: "repeatable-read-snapshot" };
    const snapshotReaders: unknown[] = [];
    const transactionOptions: unknown[] = [];
    const result = await (
      loadPublicTournamentList as (dependencies: unknown) => Promise<unknown>
    )({
      database: {
        transaction: async (
          work: (tx: unknown) => Promise<unknown>,
          options: unknown
        ) => {
          transactionOptions.push(options);
          return work(snapshot);
        },
      },
      listTournaments: async (tx?: unknown) => {
        snapshotReaders.push(tx);
        return [
        {
          id: "tournament-private-id",
          slug: "lake-effect-classic",
          name: "Lake Effect Classic",
          description: null,
          location: "Cleveland",
          date: "2027-02-13",
          status: "registration_open",
          gender: "mens",
          region: "midwest",
          hostSchoolId: null,
          registrationCapacity: 24,
          registrationDeadline: new Date("2027-03-01T17:00:00.000Z"),
        },
        {
          id: "second-tournament-private-id",
          slug: "spring-invitational",
          name: "Spring Invitational",
          description: "A second visible event.",
          location: "Akron",
          date: "2027-03-20",
          status: "registration_open",
          gender: "womens",
          region: "midwest",
          hostSchoolId: null,
          registrationCapacity: null,
          registrationDeadline: null,
        },
      ];
      },
      listAvailability: async (
        txOrIds: unknown,
        snapshotIds?: string[]
      ) => {
        const ids = snapshotIds ?? (txOrIds as string[]);
        snapshotReaders.push(snapshotIds ? txOrIds : undefined);
        availabilityBatches.push(ids);
        return [
          Object.assign(
            {
              tournamentId: "tournament-private-id",
              registeredCount: 20,
              waitlistCount: 3,
            },
            {
              teamName: "Waiting Team",
              university: "Waiting Team University",
              requestedByUserId: "waiting-user-private-id",
            }
          ),
        ];
      },
      enrichHostSchools: async (
        txOrRows: unknown,
        snapshotRows?: Record<string, unknown>[]
      ) => {
        const rows = snapshotRows ?? (txOrRows as Record<string, unknown>[]);
        snapshotReaders.push(snapshotRows ? txOrRows : undefined);
        return rows.map((row) => ({ ...row, hostSchool: null }));
      },
    });

    assert.deepEqual(transactionOptions, [
      { isolationLevel: "repeatable read", accessMode: "read only" },
    ]);
    assert.deepEqual(snapshotReaders, [snapshot, snapshot, snapshot]);
    assert.deepEqual(availabilityBatches, [
      ["tournament-private-id", "second-tournament-private-id"],
    ]);
    assert.deepEqual(result, [
      {
        slug: "lake-effect-classic",
        name: "Lake Effect Classic",
        description: null,
        location: "Cleveland",
        date: "2027-02-13",
        status: "registration_open",
        gender: "mens",
        region: "midwest",
        registrationAvailability: {
          capacity: 24,
          deadline: "2027-03-01T17:00:00.000Z",
          registeredCount: 20,
          waitlistCount: 3,
        },
        hostSchool: null,
      },
      {
        slug: "spring-invitational",
        name: "Spring Invitational",
        description: "A second visible event.",
        location: "Akron",
        date: "2027-03-20",
        status: "registration_open",
        gender: "womens",
        region: "midwest",
        registrationAvailability: {
          capacity: null,
          deadline: null,
          registeredCount: 0,
          waitlistCount: 0,
        },
        hostSchool: null,
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(result),
      /private-id|Waiting Team|Waiting Team University|waiting-user/
    );
  });

  it("loads dashboard grid rows with the same aggregate availability snapshot", async () => {
    const loaded = await import("./public-list-loader");
    const loadTournamentGridList = (
      loaded as unknown as {
        loadTournamentGridList?: (database: unknown) => Promise<unknown>;
      }
    ).loadTournamentGridList;
    assert.equal(typeof loadTournamentGridList, "function");
    const transactionOptions: unknown[] = [];
    const queryResult = (rows: unknown[]) => {
      const query = new Proxy({}, {
        get(_target, property) {
          if (property === "then") {
            return (resolve: (value: unknown[]) => void) => resolve(rows);
          }
          return () => query;
        },
      });
      return query;
    };
    const snapshot = {
      select(fields: Record<string, unknown>) {
        const keys = Object.keys(fields);
        if (keys.includes("organizerId")) {
          return queryResult([{
            id: "dashboard-private-id",
            organizerId: "organizer-private-id",
            hostSchoolId: null,
            slug: "dashboard-event",
            name: "Dashboard Event",
            description: null,
            location: "Main Gym",
            date: "2027-03-02",
            status: "registration_open",
            gender: "mens",
            region: "pacific",
            registrationCapacity: 24,
            registrationDeadline: new Date("2027-03-01T17:00:00.000Z"),
          }]);
        }
        if (keys.includes("registeredCount")) {
          return queryResult([{
            tournamentId: "dashboard-private-id",
            registeredCount: 20,
            waitlistCount: 3,
          }]);
        }
        return queryResult([]);
      },
    };
    const database = {
      async transaction(
        work: (tx: typeof snapshot) => Promise<unknown>,
        options: unknown
      ) {
        transactionOptions.push(options);
        return work(snapshot);
      },
    };

    const result = await loadTournamentGridList!(database);

    assert.deepEqual(transactionOptions, [
      { isolationLevel: "repeatable read", accessMode: "read only" },
    ]);
    assert.deepEqual(result, [{
      id: "dashboard-private-id",
      organizerId: "organizer-private-id",
      hostSchoolId: null,
      slug: "dashboard-event",
      name: "Dashboard Event",
      description: null,
      location: "Main Gym",
      date: "2027-03-02",
      status: "registration_open",
      gender: "mens",
      region: "pacific",
      registrationCapacity: 24,
      registrationDeadline: new Date("2027-03-01T17:00:00.000Z"),
      registrationAvailability: {
        capacity: 24,
        deadline: "2027-03-01T17:00:00.000Z",
        registeredCount: 20,
        waitlistCount: 3,
      },
      hostSchool: null,
    }]);
  });
});
