import assert from "node:assert/strict";
import postgres from "postgres";
import {
  placementTeamIds,
  seedPlacementTeams,
} from "./verify-registration-placement";
import {
  waitlistCaptainId,
  waitlistHostOfficerId,
} from "./verify-waitlist-promotion";
import { assertExpectedRejection } from "./verify-concurrency-errors";
import {
  schoolDeletionTournamentId,
  verifySchoolDeletionWaitsBehindPlacement,
  waitForLockWait,
} from "./verify-registration-school-deletion-race";

const databaseUrl = process.env.BRACKT_BOOTSTRAP_DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://postgres@127.0.0.1:")) {
  throw new Error(
    "BRACKT_BOOTSTRAP_DATABASE_URL must target the disposable local database"
  );
}
process.env.DATABASE_URL = databaseUrl;

const sql = postgres(databaseUrl, {
  max: 4,
  prepare: false,
  idle_timeout: 1,
});

const actorId = "f0000000-0000-4000-8000-000000000001";
const schoolId = "f0000000-0000-4000-8000-000000000010";
const tournamentId = "f0000000-0000-4000-8000-000000000030";
const eligibilityOperationId = "f0000000-0000-4000-8000-000000000059";
const promotionEligibilityOperationId =
  "f0000000-0000-4000-8000-000000000063";
const deletionEligibilityOperationId =
  "f0000000-0000-4000-8000-000000000064";

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function effectCount(): Promise<number> {
  const [row] = await sql<{ count: number }[]>`
    SELECT (
      (SELECT count(*) FROM public.registrations WHERE tournament_id = ${tournamentId}) +
      (SELECT count(*) FROM public.registration_status_events WHERE tournament_id = ${tournamentId}) +
      (SELECT count(*) FROM public.tournament_waitlist_entries WHERE tournament_id = ${tournamentId})
    )::int AS count
  `;
  return row.count;
}

async function verifyPlacementWaitsForSchoolRejection(): Promise<void> {
  const { registerTeamsAtomically } = await import(
    "../../src/lib/tournaments/registrations"
  );
  const updateStarted = deferred();
  const allowCommit = deferred();
  const rejection = sql.begin(async (adminTx) => {
    await adminTx`UPDATE public.schools SET verification_status = 'rejected'
      WHERE id = ${schoolId}`;
    updateStarted.resolve();
    await allowCommit.promise;
  });
  await updateStarted.promise;
  let settled = false;
  const placement = registerTeamsAtomically({
    tournamentId,
    teamIds: [placementTeamIds[0]],
    actor: { id: actorId, role: "captain" },
    operationId: eligibilityOperationId,
  })
    .then(
      () => ({ status: "fulfilled" as const }),
      (error: unknown) => ({ status: "rejected" as const, error })
    )
    .finally(() => {
      settled = true;
    });
  try {
    await waitForLockWait(sql, "schools", "FOR SHARE");
    assert.equal(settled, false, "placement must wait for school eligibility");
  } finally {
    allowCommit.resolve();
  }
  await rejection;
  const outcome = await placement;
  assertExpectedRejection(
    outcome,
    "This team belongs to a school that is not verified yet and cannot register for tournaments.",
    "placement"
  );
  assert.equal(await effectCount(), 0);
  await sql`UPDATE public.schools SET verification_status = 'verified'
    WHERE id = ${schoolId}`;
}

async function verifyPromotionWaitsForSchoolDetachment(): Promise<void> {
  const { promoteNextWaitlistedTeamAtomically } = await import(
    "../../src/lib/tournaments/waitlist-operations"
  );
  await sql`
    INSERT INTO public.tournament_waitlist_entries (
      tournament_id, team_id, requested_by_user_id, request_operation_id
    ) VALUES (${tournamentId}, ${placementTeamIds[1]}, ${waitlistCaptainId},
      gen_random_uuid())
  `;
  await sql`UPDATE public.teams SET verification_status = 'pending'
    WHERE id = ${placementTeamIds[1]}`;
  const updateStarted = deferred();
  const allowCommit = deferred();
  const detachment = sql.begin(async (adminTx) => {
    await adminTx`UPDATE public.teams SET school_id = NULL
      WHERE id = ${placementTeamIds[1]}`;
    updateStarted.resolve();
    await allowCommit.promise;
  });
  await updateStarted.promise;
  let settled = false;
  const promotion = promoteNextWaitlistedTeamAtomically({
    tournamentId,
    actorUserId: actorId,
    operationId: promotionEligibilityOperationId,
  })
    .then(
      () => ({ status: "fulfilled" as const }),
      (error: unknown) => ({ status: "rejected" as const, error })
    )
    .finally(() => {
      settled = true;
    });
  try {
    await waitForLockWait(sql, "teams", "FOR SHARE");
    assert.equal(settled, false, "promotion must wait for team detachment");
  } finally {
    allowCommit.resolve();
  }
  await detachment;
  const outcome = await promotion;
  assertExpectedRejection(
    outcome,
    "No currently eligible teams are waiting for this tournament.",
    "promotion"
  );
  assert.equal(await effectCount(), 1, "only the waiting row may remain");
  await sql`DELETE FROM public.tournament_waitlist_entries
    WHERE tournament_id = ${tournamentId} AND status = 'waiting'`;
  assert.equal(await effectCount(), 0);
}

async function cleanup(): Promise<void> {
  await sql`DELETE FROM public.tournaments
    WHERE id IN (${tournamentId}, ${schoolDeletionTournamentId})`;
  await sql`DELETE FROM public.teams
    WHERE id IN (
      ${placementTeamIds[0]}, ${placementTeamIds[1]}, ${placementTeamIds[2]}
    )`;
  await sql`DELETE FROM public.schools WHERE id = ${schoolId}`;
  await sql`DELETE FROM public.users
    WHERE id IN (${actorId}, ${waitlistCaptainId}, ${waitlistHostOfficerId})`;
}

async function seed(): Promise<void> {
  await sql`
    INSERT INTO public.users (id, auth_id, email, full_name, role)
    VALUES (
      ${actorId}, 'f0000000-0000-4000-8000-000000000002',
      'roster-concurrency@example.test', 'Roster Concurrency', 'captain'
    )
  `;
  await sql`
    INSERT INTO public.schools (
      id, name, slug, university, gender, region,
      verification_status, verified_at
    ) VALUES (
      ${schoolId}, 'Roster Concurrency School', 'roster-concurrency-school',
      'Roster University', 'mens', 'midwest', 'verified', now()
    )
  `;
  await seedPlacementTeams(sql, schoolId);
  await sql`
    INSERT INTO public.tournaments (
      id, organizer_id, host_school_id, gender, region, name, slug,
      date, location, status
    ) VALUES (
      ${tournamentId}, ${actorId}, ${schoolId}, 'mens', 'midwest',
      'Roster Concurrency', 'roster-concurrency', '2027-07-27',
      'Test Gym', 'registration_open'
    )
  `;
}

async function main(): Promise<void> {
  await cleanup();
  try {
    await seed();
    await verifyPlacementWaitsForSchoolRejection();
    await verifyPromotionWaitsForSchoolDetachment();
    await verifySchoolDeletionWaitsBehindPlacement({
      sql,
      actorId,
      schoolId,
      sourceTournamentId: tournamentId,
      operationId: deletionEligibilityOperationId,
    });
    console.log("Verified waitlist registration eligibility lock ordering.");
  } finally {
    await cleanup();
    const { db } = await import("../../src/lib/db");
    await db.$client.end();
    await sql.end();
  }
}

void main();
