import assert from "node:assert/strict";
import postgres from "postgres";

const databaseUrl = process.env.BRACKT_BOOTSTRAP_DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://postgres@127.0.0.1:")) {
  throw new Error(
    "BRACKT_BOOTSTRAP_DATABASE_URL must target the disposable local database"
  );
}

const sql = postgres(databaseUrl, { max: 2, prepare: false, idle_timeout: 1 });

const actorId = "a7000000-0000-4000-8000-000000000001";
const schoolId = "a7000000-0000-4000-8000-000000000010";
const tournamentId = "a7000000-0000-4000-8000-000000000020";
const otherTournamentId = "a7000000-0000-4000-8000-000000000021";
const thirdTournamentId = "a7000000-0000-4000-8000-000000000022";
const teamAId = "a7000000-0000-4000-8000-000000000101";
const teamBId = "a7000000-0000-4000-8000-000000000102";
const teamCId = "a7000000-0000-4000-8000-000000000103";
const registrationId = "a7000000-0000-4000-8000-000000000201";
const wrongTournamentRegistrationId =
  "a7000000-0000-4000-8000-000000000202";
const concurrentRegistrationId = "a7000000-0000-4000-8000-000000000203";
const firstRequestOperationId = "a7000000-0000-4000-8000-000000000301";
const requeueRequestOperationId = "a7000000-0000-4000-8000-000000000302";
const promotionRequestOperationId = "a7000000-0000-4000-8000-000000000303";
const firstResolutionOperationId = "a7000000-0000-4000-8000-000000000401";
const requeueResolutionOperationId = "a7000000-0000-4000-8000-000000000402";
const promotionResolutionOperationId = "a7000000-0000-4000-8000-000000000403";
const duplicateResolutionOperationId = "a7000000-0000-4000-8000-000000000404";
const terminalStateRequestOperationId =
  "a7000000-0000-4000-8000-000000000306";

type WaitlistEntryStatus = "waiting" | "promoted" | "withdrawn" | "removed";
type WaitlistEntryInput = {
  teamId: string;
  requestOperationId: string;
  status?: WaitlistEntryStatus;
  resolvedAt?: Date | null;
  resolvedByUserId?: string | null;
  resolutionOperationId?: string | null;
  registrationId?: string | null;
};
type WaitlistEntry = { id: string; queue_position: number };
type PromotionHistory = {
  tournament_id: string;
  team_id: string;
  queue_position: number;
  status: string;
  resolved_at: Date | null;
  resolved_by_user_id: string | null;
  resolution_operation_id: string | null;
  registration_id: string | null;
};

async function cleanup(): Promise<void> {
  await sql`
    DELETE FROM public.tournaments
    WHERE id IN (${tournamentId}, ${otherTournamentId}, ${thirdTournamentId})
  `;
  await sql`
    DELETE FROM public.teams WHERE id IN (${teamAId}, ${teamBId}, ${teamCId})
  `;
  await sql`DELETE FROM public.schools WHERE id = ${schoolId}`;
  await sql`DELETE FROM public.users WHERE id = ${actorId}`;
}

async function seedUserAndSchool(): Promise<void> {
  await sql`
    INSERT INTO public.users (id, auth_id, email, full_name, role)
    VALUES (
      ${actorId}, 'a7000000-0000-4000-8000-000000000002',
      'waitlist-schema@example.test', 'Waitlist Schema', 'organizer'
    )
  `;
  await sql`
    INSERT INTO public.schools (
      id, name, slug, university, gender, region, verification_status, verified_at
    )
    VALUES (
      ${schoolId}, 'Waitlist School', 'waitlist-school', 'Waitlist University',
      'mens', 'midwest', 'verified', now()
    )
  `;
}

async function seedTeams(): Promise<void> {
  await sql`
    INSERT INTO public.teams (
      id, name, slug, university, school_id, gender, region,
      verification_status, verified_at
    )
    VALUES
      (${teamAId}, 'Waitlist Team A', 'waitlist-team-a',
       'Waitlist University', ${schoolId}, 'mens', 'midwest', 'verified', now()),
      (${teamBId}, 'Waitlist Team B', 'waitlist-team-b',
       'Waitlist University', ${schoolId}, 'mens', 'midwest', 'verified', now()),
      (${teamCId}, 'Waitlist Team C', 'waitlist-team-c',
       'Waitlist University', ${schoolId}, 'mens', 'midwest', 'verified', now())
  `;
}

async function seedTournamentAndRegistration(): Promise<void> {
  await sql`
    INSERT INTO public.tournaments (
      id, organizer_id, host_school_id, gender, region, name, slug, date,
      location, status
    )
    VALUES
      (
        ${tournamentId}, ${actorId}, ${schoolId}, 'mens', 'midwest',
        'Waitlist Schema Tournament', 'waitlist-schema-tournament',
        '2027-07-30', 'Waitlist Gym', 'registration_open'
      ),
      (
        ${otherTournamentId}, ${actorId}, ${schoolId}, 'mens', 'midwest',
        'Other Waitlist Schema Tournament', 'other-waitlist-schema-tournament',
        '2027-07-31', 'Other Waitlist Gym', 'registration_open'
      ),
      (
        ${thirdTournamentId}, ${actorId}, ${schoolId}, 'mens', 'midwest',
        'Third Waitlist Schema Tournament', 'third-waitlist-schema-tournament',
        '2027-08-01', 'Third Waitlist Gym', 'registration_open'
      )
  `;
  await sql`
    INSERT INTO public.registrations (id, tournament_id, team_id)
    VALUES
      (${registrationId}, ${tournamentId}, ${teamBId}),
      (${wrongTournamentRegistrationId}, ${otherTournamentId}, ${teamBId}),
      (${concurrentRegistrationId}, ${tournamentId}, ${teamCId})
  `;
}

async function seed(): Promise<void> {
  await seedUserAndSchool();
  await seedTeams();
  await seedTournamentAndRegistration();
}

async function insertWaitlistEntry(
  input: WaitlistEntryInput
): Promise<WaitlistEntry> {
  const [entry] = await sql<WaitlistEntry[]>`
    INSERT INTO public.tournament_waitlist_entries (
      tournament_id, team_id, requested_by_user_id, request_operation_id, status,
      resolved_at, resolved_by_user_id, resolution_operation_id, registration_id
    )
    VALUES (
      ${tournamentId}, ${input.teamId}, ${actorId}, ${input.requestOperationId},
      ${input.status ?? "waiting"}, ${input.resolvedAt ?? null},
      ${input.resolvedByUserId ?? null}, ${input.resolutionOperationId ?? null},
      ${input.registrationId ?? null}
    )
    RETURNING id, queue_position
  `;
  return entry;
}

async function verifyTerminalStatesRejectMalformedRows(): Promise<void> {
  const malformedEntries = [
    { description: "missing a resolution timestamp", resolvedAt: null,
      resolutionOperationId: duplicateResolutionOperationId, registrationId: null },
    { description: "missing a resolution operation ID", resolvedAt: new Date(),
      resolutionOperationId: null, registrationId: null },
    { description: "retaining a registration ID", resolvedAt: new Date(),
      resolutionOperationId: duplicateResolutionOperationId, registrationId },
  ];

  for (const status of ["withdrawn", "removed"] as const) {
    for (const malformed of malformedEntries) {
      await assert.rejects(
        () => insertWaitlistEntry({
          teamId: teamCId, requestOperationId: terminalStateRequestOperationId,
          status, resolvedAt: malformed.resolvedAt, resolvedByUserId: actorId,
          resolutionOperationId: malformed.resolutionOperationId,
          registrationId: malformed.registrationId,
        }),
        `${status} rows ${malformed.description} must be rejected`
      );
    }
  }
}

async function verifyInvalidWaitingAndPromotionRows(): Promise<void> {
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamAId, requestOperationId: firstRequestOperationId,
      resolvedByUserId: actorId,
    }),
    "waiting rows with resolver metadata must be rejected"
  );
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamAId, requestOperationId: firstRequestOperationId,
      status: "promoted",
    }),
    "promoted rows without resolution metadata must be rejected"
  );
}

async function resolveAsWithdrawn(
  entryId: string,
  resolutionOperationId: string
): Promise<void> {
  await sql`
    UPDATE public.tournament_waitlist_entries
    SET
      status = 'withdrawn',
      resolved_at = now(),
      resolved_by_user_id = ${actorId},
      resolution_operation_id = ${resolutionOperationId}
    WHERE id = ${entryId}
  `;
}

async function verifyWaitingUniquenessAndRequeue(): Promise<void> {
  const firstEntry = await insertWaitlistEntry({
    teamId: teamAId, requestOperationId: firstRequestOperationId,
  });
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamAId, requestOperationId: requeueRequestOperationId,
    }),
    "only one waiting entry for a team may exist per tournament"
  );
  await resolveAsWithdrawn(firstEntry.id, firstResolutionOperationId);
  const requeuedEntry = await insertWaitlistEntry({
    teamId: teamAId, requestOperationId: requeueRequestOperationId,
  });
  assert.ok(requeuedEntry.queue_position > firstEntry.queue_position);
  await resolveAsWithdrawn(requeuedEntry.id, requeueResolutionOperationId);
}

async function verifyRequestOperationUniqueness(): Promise<void> {
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamAId, requestOperationId: requeueRequestOperationId,
    }),
    "request operation IDs must be unique for a tournament and team"
  );
}

async function verifyStateAndUniquenessRules(): Promise<void> {
  await verifyTerminalStatesRejectMalformedRows();
  await verifyInvalidWaitingAndPromotionRows();
  await verifyWaitingUniquenessAndRequeue();
  await verifyRequestOperationUniqueness();
}

async function createPromotedEntry(): Promise<WaitlistEntry> {
  return insertWaitlistEntry({
    teamId: teamBId, requestOperationId: promotionRequestOperationId,
    status: "promoted", resolvedAt: new Date(), resolvedByUserId: actorId,
    resolutionOperationId: promotionResolutionOperationId, registrationId,
  });
}

async function verifyResolutionOperationUniqueness(): Promise<void> {
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamCId, requestOperationId: "a7000000-0000-4000-8000-000000000304",
      status: "withdrawn", resolvedAt: new Date(), resolvedByUserId: actorId,
      resolutionOperationId: promotionResolutionOperationId,
    }),
    "resolution operation IDs must be unique within a tournament"
  );
}

async function verifyRegistrationUniqueness(): Promise<void> {
  await assert.rejects(
    () => insertWaitlistEntry({
      teamId: teamBId, requestOperationId: "a7000000-0000-4000-8000-000000000305",
      status: "promoted", resolvedAt: new Date(), resolvedByUserId: actorId,
      resolutionOperationId: duplicateResolutionOperationId, registrationId,
    }),
    "a non-null registration ID can belong to only one waitlist entry"
  );
}

async function verifyRegistrationParentOwnership(): Promise<void> {
  const mismatchedParents = [
    {
      description: "a registration for the same team in another tournament",
      teamId: teamBId,
      registrationId: wrongTournamentRegistrationId,
    },
    {
      description: "a registration for another team in the same tournament",
      teamId: teamAId,
      registrationId,
    },
  ];
  for (const [index, mismatch] of mismatchedParents.entries()) {
    await assert.rejects(
      () => insertWaitlistEntry({
        teamId: mismatch.teamId,
        requestOperationId: `a7000000-0000-4000-8000-00000000031${index}`,
        status: "promoted",
        resolvedAt: new Date(),
        resolvedByUserId: actorId,
        resolutionOperationId:
          `a7000000-0000-4000-8000-00000000041${index}`,
        registrationId: mismatch.registrationId,
      }),
      mismatch.description
    );
  }
}

async function verifyRegistrationParentUpdatesRejected(): Promise<void> {
  await assert.rejects(
    () => sql`
      UPDATE public.registrations SET team_id = ${teamAId}
      WHERE id = ${registrationId}
    `,
    "a linked registration cannot move to another team"
  );
  await assert.rejects(
    () => sql`
      UPDATE public.registrations SET tournament_id = ${thirdTournamentId}
      WHERE id = ${registrationId}
    `,
    "a linked registration cannot move to another tournament"
  );
}

async function verifyConcurrentParentUpdateCannotBreakOwnership(): Promise<void> {
  let releaseParentUpdate = () => {};
  let reportParentUpdated = () => {};
  const parentUpdated = new Promise<void>((resolve) => {
    reportParentUpdated = resolve;
  });
  const allowCommit = new Promise<void>((resolve) => {
    releaseParentUpdate = resolve;
  });
  const parentUpdate = sql.begin(async (transaction) => {
    await transaction`
      UPDATE public.registrations SET team_id = ${teamAId}
      WHERE id = ${concurrentRegistrationId}
    `;
    reportParentUpdated();
    await allowCommit;
  });
  await parentUpdated;
  const linkAttempt = insertWaitlistEntry({
    teamId: teamCId,
    requestOperationId: "a7000000-0000-4000-8000-000000000312",
    status: "promoted",
    resolvedAt: new Date(),
    resolvedByUserId: actorId,
    resolutionOperationId: "a7000000-0000-4000-8000-000000000412",
    registrationId: concurrentRegistrationId,
  });
  await new Promise((resolve) => setTimeout(resolve, 50));
  releaseParentUpdate();
  await parentUpdate;
  await assert.rejects(
    () => linkAttempt,
    "a concurrent parent update cannot leave a cross-team waitlist link"
  );
}

async function loadPromotionHistory(entryId: string): Promise<PromotionHistory> {
  const [history] = await sql<PromotionHistory[]>`
    SELECT
      tournament_id, team_id, queue_position, status, resolved_at,
      resolved_by_user_id, resolution_operation_id, registration_id
    FROM public.tournament_waitlist_entries
    WHERE id = ${entryId}
  `;
  assert.ok(history, "the promoted waitlist entry must remain after deletion");
  return history;
}

async function verifyDeletedRegistrationHistory(
  promotedEntry: WaitlistEntry
): Promise<void> {
  await sql`DELETE FROM public.registrations WHERE id = ${registrationId}`;
  const history = await loadPromotionHistory(promotedEntry.id);
  assert.deepEqual(
    {
      tournamentId: history.tournament_id, teamId: history.team_id,
      queuePosition: history.queue_position, status: history.status,
      resolvedByUserId: history.resolved_by_user_id,
      resolutionOperationId: history.resolution_operation_id,
      registrationId: history.registration_id,
    },
    {
      tournamentId, teamId: teamBId, queuePosition: promotedEntry.queue_position,
      status: "promoted", resolvedByUserId: actorId,
      resolutionOperationId: promotionResolutionOperationId, registrationId: null,
    }
  );
  assert.ok(history.resolved_at);
}

type BrowserAccess = {
  anonTableAccess: boolean;
  authenticatedTableAccess: boolean;
  anonSequenceAccess: boolean;
  authenticatedSequenceAccess: boolean;
};

async function loadBrowserAccess(): Promise<BrowserAccess> {
  // verify-catalog.sql covers TRUNCATE, REFERENCES, and TRIGGER for browser roles.
  const [access] = await sql<BrowserAccess[]>`
    SELECT
      has_table_privilege(
        'anon', 'public.tournament_waitlist_entries',
        'SELECT, INSERT, UPDATE, DELETE'
      ) AS "anonTableAccess",
      has_table_privilege(
        'authenticated', 'public.tournament_waitlist_entries',
        'SELECT, INSERT, UPDATE, DELETE'
      ) AS "authenticatedTableAccess",
      has_sequence_privilege(
        'anon', 'public.tournament_waitlist_entries_queue_position_seq',
        'USAGE, SELECT, UPDATE'
      ) AS "anonSequenceAccess",
      has_sequence_privilege(
        'authenticated', 'public.tournament_waitlist_entries_queue_position_seq',
        'USAGE, SELECT, UPDATE'
      ) AS "authenticatedSequenceAccess"
  `;
  return access;
}

async function verifyBrowserPrivileges(): Promise<void> {
  assert.deepEqual(await loadBrowserAccess(), {
    anonTableAccess: false,
    authenticatedTableAccess: false,
    anonSequenceAccess: false,
    authenticatedSequenceAccess: false,
  });
}

async function verifyPromotionHistoryAndPrivileges(): Promise<void> {
  await verifyRegistrationParentOwnership();
  await verifyConcurrentParentUpdateCannotBreakOwnership();
  const promotedEntry = await createPromotedEntry();
  await verifyRegistrationParentUpdatesRejected();
  await verifyResolutionOperationUniqueness();
  await verifyRegistrationUniqueness();
  await verifyDeletedRegistrationHistory(promotedEntry);
  await verifyBrowserPrivileges();
}

async function main(): Promise<void> {
  await cleanup();
  try {
    await seed();
    await verifyStateAndUniquenessRules();
    await verifyPromotionHistoryAndPrivileges();
    console.log("Verified waitlist schema constraints, history, and privileges.");
  } finally {
    await cleanup();
    await sql.end();
  }
}

void main();
