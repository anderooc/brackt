import assert from "node:assert/strict";
import type postgres from "postgres";

type DatabaseSql = postgres.Sql;
type RegisterTeams = typeof import("../../src/lib/tournaments/registrations")["registerTeamsAtomically"];

export const placementTeamIds = [
  "f0000000-0000-4000-8000-000000000021",
  "f0000000-0000-4000-8000-000000000022",
  "f0000000-0000-4000-8000-000000000023",
  "f0000000-0000-4000-8000-000000000024",
  "f0000000-0000-4000-8000-000000000025",
] as const;

const placementOperationId = "f0000000-0000-4000-8000-000000000053";
const deadlineOperationId = "f0000000-0000-4000-8000-000000000054";
const raceOperationIds = [
  "f0000000-0000-4000-8000-000000000055",
  "f0000000-0000-4000-8000-000000000056",
] as const;
const waitlistResubmitOperationId =
  "f0000000-0000-4000-8000-000000000057";
const queuePrecedenceOperationId =
  "f0000000-0000-4000-8000-000000000058";

type PlacementContext = {
  sql: DatabaseSql;
  actorId: string;
  tournamentId: string;
};

export async function seedPlacementTeams(
  sql: DatabaseSql,
  schoolId: string
): Promise<void> {
  await sql`
    INSERT INTO public.teams (
      id, name, slug, university, school_id, gender, region,
      verification_status, verified_at
    )
    SELECT
      fixture.id::uuid, fixture.name, fixture.slug, 'Roster University',
      ${schoolId}, 'mens', 'midwest', 'verified', now()
    FROM (
      VALUES
        (${placementTeamIds[0]}, 'Accepted Fixture Team', 'accepted-fixture-team'),
        (${placementTeamIds[1]}, 'Queue Team A', 'queue-team-a'),
        (${placementTeamIds[2]}, 'Newcomer Team B', 'newcomer-team-b'),
        (${placementTeamIds[3]}, 'Race Team A', 'race-team-a'),
        (${placementTeamIds[4]}, 'Race Team B', 'race-team-b')
    ) AS fixture(id, name, slug)
  `;
}

async function resetPlacementState(
  context: PlacementContext,
  input: { capacity: number | null; deadlineSql?: "now" }
): Promise<void> {
  const { sql, tournamentId } = context;
  await sql`DELETE FROM public.tournament_waitlist_entries WHERE tournament_id = ${tournamentId}`;
  await sql`DELETE FROM public.registration_status_events WHERE tournament_id = ${tournamentId}`;
  await sql`DELETE FROM public.registrations WHERE tournament_id = ${tournamentId}`;
  await sql`
    UPDATE public.tournaments
    SET
      registration_capacity = ${input.capacity},
      registration_deadline = ${input.deadlineSql === "now" ? sql`clock_timestamp()` : null}
    WHERE id = ${tournamentId}
  `;
}

async function placementCounts(context: PlacementContext): Promise<{
  registrations: number;
  waiting: number;
  payments: number;
}> {
  const { sql, tournamentId } = context;
  const [counts] = await sql<{
    registrations: number;
    waiting: number;
    payments: number;
  }[]>`
    SELECT
      (SELECT count(*)::int FROM public.registrations
        WHERE tournament_id = ${tournamentId}) AS registrations,
      (SELECT count(*)::int FROM public.tournament_waitlist_entries
        WHERE tournament_id = ${tournamentId} AND status = 'waiting') AS waiting,
      (SELECT count(*)::int FROM public.registration_payments
        WHERE tournament_id = ${tournamentId}) AS payments
  `;
  return counts;
}

async function assertMixedPlacementRows(
  context: PlacementContext
): Promise<void> {
  const { sql, tournamentId } = context;
  const accepted = await sql<{ team_id: string }[]>`
    SELECT team_id FROM public.registrations
    WHERE tournament_id = ${tournamentId}
  `;
  const waiting = await sql<{ team_id: string }[]>`
    SELECT team_id FROM public.tournament_waitlist_entries
    WHERE tournament_id = ${tournamentId} AND status = 'waiting'
    ORDER BY queue_position
  `;
  const events = await sql<{ team_id: string }[]>`
    SELECT team_id FROM public.registration_status_events
    WHERE tournament_id = ${tournamentId}
      AND operation_id = ${placementOperationId}
  `;
  assert.deepEqual(accepted.map((row) => row.team_id), [placementTeamIds[0]]);
  assert.deepEqual(waiting.map((row) => row.team_id), [placementTeamIds[1]]);
  assert.deepEqual(events.map((row) => row.team_id), [placementTeamIds[0]]);
}

async function assertWaitlistedTeamCannotRegister(
  context: PlacementContext,
  registerTeamsAtomically: RegisterTeams
): Promise<void> {
  const { sql, actorId, tournamentId } = context;
  const { OperationConflictError } = await import(
    "../../src/lib/tournaments/competition-operation-rules"
  );
  await sql`DELETE FROM public.registrations WHERE team_id = ${placementTeamIds[0]}`;
  await assert.rejects(
    () =>
      registerTeamsAtomically({
        tournamentId,
        teamIds: [placementTeamIds[1]],
        actor: { id: actorId, role: "captain" },
        operationId: waitlistResubmitOperationId,
      }),
    OperationConflictError,
    "a waiting team must enter only through organizer-controlled promotion"
  );
  assert.deepEqual(await placementCounts(context), {
    registrations: 0,
    waiting: 1,
    payments: 0,
  });
}

async function assertNoNewcomerRegistrationEffects(
  context: PlacementContext
): Promise<void> {
  const { sql, tournamentId } = context;
  const [effects] = await sql<{
    registrations: number;
    payments: number;
    events: number;
  }[]>`
    SELECT
      (SELECT count(*)::int FROM public.registrations
        WHERE tournament_id = ${tournamentId}
          AND team_id = ${placementTeamIds[2]}) AS registrations,
      (SELECT count(*)::int FROM public.registration_payments
        WHERE tournament_id = ${tournamentId}
          AND team_id = ${placementTeamIds[2]}) AS payments,
      (SELECT count(*)::int FROM public.registration_status_events
        WHERE tournament_id = ${tournamentId}
          AND team_id = ${placementTeamIds[2]}
          AND operation_id = ${queuePrecedenceOperationId}) AS events
  `;
  assert.deepEqual(effects, { registrations: 0, payments: 0, events: 0 });
}

async function verifyExistingQueueTakesPrecedence(
  context: PlacementContext,
  registerTeamsAtomically: RegisterTeams
): Promise<void> {
  const { sql, actorId, tournamentId } = context;
  const input = {
    tournamentId,
    teamIds: [placementTeamIds[2]],
    actor: { id: actorId, role: "captain" },
    operationId: queuePrecedenceOperationId,
  };
  const expected = { acceptedCount: 0, waitlistedCount: 1, replayed: false };
  assert.deepEqual(await registerTeamsAtomically(input), expected);
  const waiting = await sql<{ team_id: string }[]>`
    SELECT team_id FROM public.tournament_waitlist_entries
    WHERE tournament_id = ${tournamentId} AND status = 'waiting'
    ORDER BY queue_position
  `;
  assert.deepEqual(waiting.map((row) => row.team_id), [
    placementTeamIds[1],
    placementTeamIds[2],
  ]);
  await assertNoNewcomerRegistrationEffects(context);
  assert.deepEqual(await registerTeamsAtomically(input), {
    ...expected,
    replayed: true,
  });
  assert.deepEqual(await placementCounts(context), {
    registrations: 0,
    waiting: 2,
    payments: 0,
  });
}

async function verifyMixedPlacementAndReplay(
  context: PlacementContext,
  registerTeamsAtomically: RegisterTeams
): Promise<void> {
  const { sql, actorId, tournamentId } = context;
  const { OperationConflictError } = await import(
    "../../src/lib/tournaments/competition-operation-rules"
  );
  await resetPlacementState(context, { capacity: 1 });
  const input = {
    tournamentId,
    teamIds: [placementTeamIds[0], placementTeamIds[1]],
    actor: { id: actorId, role: "captain" },
    operationId: placementOperationId,
  };
  const expected = { acceptedCount: 1, waitlistedCount: 1, replayed: false };
  assert.deepEqual(await registerTeamsAtomically(input), expected);
  assert.deepEqual(await placementCounts(context), {
    registrations: 1,
    waiting: 1,
    payments: 1,
  });
  await assertMixedPlacementRows(context);
  const waitingPayments = await sql`
    SELECT id FROM public.registration_payments
    WHERE team_id = ${placementTeamIds[1]}
  `;
  assert.equal(waitingPayments.length, 0);
  assert.deepEqual(await registerTeamsAtomically(input), {
    ...expected,
    replayed: true,
  });
  await assert.rejects(
    () =>
      registerTeamsAtomically({
        ...input,
        teamIds: [...input.teamIds].reverse(),
      }),
    OperationConflictError
  );
  await assertWaitlistedTeamCannotRegister(context, registerTeamsAtomically);
  await verifyExistingQueueTakesPrecedence(context, registerTeamsAtomically);
}

async function verifyDatabaseDeadline(
  context: PlacementContext,
  registerTeamsAtomically: RegisterTeams,
  OperationValidationError: new (...args: never[]) => Error
): Promise<void> {
  const { actorId, tournamentId } = context;
  await resetPlacementState(context, { capacity: 1, deadlineSql: "now" });
  await assert.rejects(
    () =>
      registerTeamsAtomically({
        tournamentId,
        teamIds: [placementTeamIds[2]],
        actor: { id: actorId, role: "captain" },
        operationId: deadlineOperationId,
      }),
    (error: unknown) =>
      error instanceof OperationValidationError &&
      error.message === "The registration deadline has passed."
  );
  assert.deepEqual(await placementCounts(context), {
    registrations: 0,
    waiting: 0,
    payments: 0,
  });
}

async function verifyLastSlotRace(
  context: PlacementContext,
  registerTeamsAtomically: RegisterTeams
): Promise<void> {
  const { actorId, tournamentId } = context;
  await resetPlacementState(context, { capacity: 1 });
  const results = await Promise.all(
    placementTeamIds.slice(3).map((raceTeamId, index) =>
      registerTeamsAtomically({
        tournamentId,
        teamIds: [raceTeamId],
        actor: { id: actorId, role: "captain" },
        operationId: raceOperationIds[index]!,
      })
    )
  );
  assert.deepEqual(
    results
      .map(({ acceptedCount, waitlistedCount }) => [
        acceptedCount,
        waitlistedCount,
      ])
      .sort(),
    [[0, 1], [1, 0]]
  );
  assert.deepEqual(await placementCounts(context), {
    registrations: 1,
    waiting: 1,
    payments: 1,
  });
}

export async function verifyRegistrationPlacement(
  sql: DatabaseSql,
  fixture: { actorId: string; tournamentId: string }
): Promise<void> {
  const registerTeamsModule = await import(
    "../../src/lib/tournaments/registrations"
  );
  const rulesModule = await import(
    "../../src/lib/tournaments/competition-operation-rules"
  );
  const context = { sql, ...fixture };
  await verifyMixedPlacementAndReplay(
    context,
    registerTeamsModule.registerTeamsAtomically
  );
  await verifyDatabaseDeadline(
    context,
    registerTeamsModule.registerTeamsAtomically,
    rulesModule.OperationValidationError
  );
  await verifyLastSlotRace(context, registerTeamsModule.registerTeamsAtomically);
  await resetPlacementState(context, { capacity: null });
}
