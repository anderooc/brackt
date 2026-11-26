import assert from "node:assert/strict";
import postgres from "postgres";

const databaseUrl = process.env.BRACKT_BOOTSTRAP_DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://postgres@127.0.0.1:")) {
  throw new Error(
    "BRACKT_BOOTSTRAP_DATABASE_URL must target the disposable local database"
  );
}
process.env.DATABASE_URL = databaseUrl;

const sql = postgres(databaseUrl, { max: 4, prepare: false, idle_timeout: 1 });
const actorId = "e0000000-0000-4000-8000-000000000001";
const schoolId = "e0000000-0000-4000-8000-000000000010";
const creationSchoolId = "e0000000-0000-4000-8000-000000000011";
const teamIds = [
  "e0000000-0000-4000-8000-000000000020",
  "e0000000-0000-4000-8000-000000000021",
] as const;
const creationTeamId = "e0000000-0000-4000-8000-000000000022";
const tournamentIds = [
  "e0000000-0000-4000-8000-000000000030",
  "e0000000-0000-4000-8000-000000000031",
  "e0000000-0000-4000-8000-000000000032",
] as const;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function cleanup(): Promise<void> {
  await sql`DELETE FROM public.tournaments WHERE id IN ${sql(tournamentIds)}`;
  await sql`DELETE FROM public.teams WHERE id IN ${sql(teamIds)}`;
  await sql`DELETE FROM public.teams WHERE id = ${creationTeamId}`;
  await sql`DELETE FROM public.schools
    WHERE id IN (${schoolId}, ${creationSchoolId})`;
  await sql`DELETE FROM public.users WHERE id = ${actorId}`;
}

async function seed(): Promise<void> {
  await sql`INSERT INTO public.users (id, auth_id, email, full_name, role)
    VALUES (${actorId}, 'e0000000-0000-4000-8000-000000000002',
      'team-delete@example.test', 'Team Delete Actor', 'captain')`;
  await sql`INSERT INTO public.schools
    (id, name, slug, university, gender, region, verification_status)
    VALUES (${schoolId}, 'Team Delete School', 'team-delete-school',
      'Delete University', 'mens', 'midwest', 'verified')`;
  await sql`INSERT INTO public.teams
    (id, name, slug, university, school_id, gender, region, verification_status)
    VALUES
      (${teamIds[0]}, 'Delete Team A', 'delete-team-a', 'Delete University',
        ${schoolId}, 'mens', 'midwest', 'verified'),
      (${teamIds[1]}, 'Delete Team B', 'delete-team-b', 'Delete University',
        ${schoolId}, 'mens', 'midwest', 'verified')`;
  await sql`INSERT INTO public.team_members (team_id, user_id, role)
    VALUES (${teamIds[0]}, ${actorId}, 'captain'),
      (${teamIds[1]}, ${actorId}, 'captain')`;
  await sql`INSERT INTO public.school_members (school_id, user_id, role)
    VALUES (${schoolId}, ${actorId}, 'president')`;
  await sql`INSERT INTO public.tournaments
    (id, organizer_id, gender, region, name, slug, date, location, status)
    VALUES
      (${tournamentIds[0]}, ${actorId}, 'mens', 'midwest', 'Delete Parent A',
        'delete-parent-a', '2027-08-01', 'Gym', 'draft'),
      (${tournamentIds[1]}, ${actorId}, 'mens', 'midwest', 'Delete Parent B',
        'delete-parent-b', '2027-08-02', 'Gym', 'draft')`;
  await sql`UPDATE public.tournaments SET host_school_id = ${schoolId}
    WHERE id = ${tournamentIds[0]}`;
  await sql`INSERT INTO public.tournament_waitlist_entries
    (tournament_id, team_id, requested_by_user_id, request_operation_id)
    VALUES (${tournamentIds[0]}, ${teamIds[0]}, ${actorId}, gen_random_uuid()),
      (${tournamentIds[0]}, ${teamIds[1]}, ${actorId}, gen_random_uuid())`;
}

async function holdTournament(tournamentId: string) {
  const started = deferred();
  const release = deferred();
  const blocker = sql.begin(async (tx) => {
    await tx`UPDATE public.tournaments SET updated_at = updated_at
      WHERE id = ${tournamentId}`;
    started.resolve();
    await release.promise;
  });
  await started.promise;
  return { blocker, release };
}

async function verifyParentGrowthRetry(): Promise<void> {
  const { deleteTeamWithTournamentLocks } = await import(
    "../../src/lib/teams/team-deletion"
  );
  const gate = await holdTournament(tournamentIds[0]);
  const invalidated: string[] = [];
  let settled = false;
  const deletion = deleteTeamWithTournamentLocks({
    teamId: teamIds[0], confirmationName: "Delete Team A",
    authorize: async () => null,
    afterCommit: async (parents) => {
      invalidated.push(...parents.map((parent) => parent.id));
    },
  }).finally(() => { settled = true; });
  let gateError: unknown;
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "deletion must wait for its first parent lock");
    await sql`INSERT INTO public.tournament_waitlist_entries
      (tournament_id, team_id, requested_by_user_id, request_operation_id)
      VALUES (${tournamentIds[1]}, ${teamIds[0]}, ${actorId}, gen_random_uuid())`;
  } catch (error) {
    gateError = error;
  } finally {
    gate.release.resolve();
  }
  await gate.blocker;
  assert.deepEqual(await deletion, { ok: true });
  assert.deepEqual(invalidated.sort(), tournamentIds.slice(0, 2).sort());
  if (gateError) throw gateError;
}

async function verifyRevokedAuthorization(): Promise<void> {
  const { and, eq } = await import("drizzle-orm");
  const { teamMembers } = await import("../../src/lib/db/schema");
  const { deleteTeamWithTournamentLocks } = await import(
    "../../src/lib/teams/team-deletion"
  );
  const gate = await holdTournament(tournamentIds[0]);
  let invalidated = false;
  let settled = false;
  const deletion = deleteTeamWithTournamentLocks({
    teamId: teamIds[1], confirmationName: "Delete Team B",
    authorize: async (tx) => {
      const [captain] = await tx.select({ id: teamMembers.id }).from(teamMembers)
        .where(and(eq(teamMembers.teamId, teamIds[1]),
          eq(teamMembers.userId, actorId))).for("share").limit(1);
      return captain ? null : "Authorization was revoked";
    },
    afterCommit: async () => { invalidated = true; },
  }).finally(() => { settled = true; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "authorization must reload after parent wait");
    await sql`DELETE FROM public.team_members
      WHERE team_id = ${teamIds[1]} AND user_id = ${actorId}`;
  } finally {
    gate.release.resolve();
  }
  await gate.blocker;
  assert.deepEqual(await deletion, { ok: false, error: "Authorization was revoked" });
  const [remaining] = await sql<{ count: number }[]>`SELECT count(*)::int AS count
    FROM public.teams WHERE id = ${teamIds[1]}`;
  assert.equal(remaining.count, 1);
  assert.equal(invalidated, false);
}

async function holdTeam(teamId: string) {
  const started = deferred();
  const release = deferred();
  const blocker = sql.begin(async (tx) => {
    await tx`UPDATE public.teams SET updated_at = updated_at WHERE id = ${teamId}`;
    started.resolve();
    await release.promise;
  });
  await started.promise;
  return { blocker, release };
}

async function verifyRevokedSchoolPresident(): Promise<void> {
  const { currentActorCanDeleteSchool, deleteSchoolWithEligibilityLocks } =
    await import("../../src/lib/schools/school-deletion");
  const gate = await holdTeam(teamIds[1]);
  let settled = false;
  const deletion = deleteSchoolWithEligibilityLocks({
    schoolId,
    authorize: async (tx) => await currentActorCanDeleteSchool(
      tx, schoolId, actorId
    ) ? null : "School authorization was revoked",
    afterCommit: async () => { throw new Error("must not invalidate"); },
  }).finally(() => { settled = true; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "school deletion must wait for its team lock");
    await sql`DELETE FROM public.school_members
      WHERE school_id = ${schoolId} AND user_id = ${actorId}`;
  } finally {
    gate.release.resolve();
  }
  await gate.blocker;
  assert.deepEqual(await deletion,
    { ok: false, error: "School authorization was revoked" });
}

async function verifyRevokedAdmin(): Promise<void> {
  const { currentActorIsAdmin, deleteSchoolWithEligibilityLocks } =
    await import("../../src/lib/schools/school-deletion");
  await sql`UPDATE public.users SET role = 'admin' WHERE id = ${actorId}`;
  const gate = await holdTeam(teamIds[1]);
  let settled = false;
  const deletion = deleteSchoolWithEligibilityLocks({
    schoolId,
    authorize: async (tx) => await currentActorIsAdmin(tx, actorId)
      ? null : "Administrator access was revoked",
    afterCommit: async () => { throw new Error("must not invalidate"); },
  }).finally(() => { settled = true; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "admin deletion must wait for its team lock");
    await sql`UPDATE public.users SET role = 'captain' WHERE id = ${actorId}`;
  } finally {
    gate.release.resolve();
  }
  await gate.blocker;
  assert.deepEqual(await deletion,
    { ok: false, error: "Administrator access was revoked" });
}

async function verifySchoolParentGrowthRetry(): Promise<void> {
  const { deleteSchoolWithEligibilityLocks } = await import(
    "../../src/lib/schools/school-deletion"
  );
  const gate = await holdTournament(tournamentIds[0]);
  const invalidated: string[] = [];
  let settled = false;
  const deletion = deleteSchoolWithEligibilityLocks({
    schoolId, authorize: async () => null,
    afterCommit: async (parents) => {
      invalidated.push(...parents.map((parent) => parent.id));
    },
  }).finally(() => { settled = true; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "school deletion must wait for its host parent");
    await sql`INSERT INTO public.tournaments
      (id, organizer_id, host_school_id, gender, region, name, slug,
        date, location, status)
      VALUES (${tournamentIds[2]}, ${actorId}, ${schoolId}, 'mens', 'midwest',
        'Delete Parent C', 'delete-parent-c', '2027-08-03', 'Gym', 'draft')`;
  } finally {
    gate.release.resolve();
  }
  await gate.blocker;
  assert.deepEqual(await deletion, { ok: true });
  assert.deepEqual(invalidated.sort(), [tournamentIds[0], tournamentIds[2]].sort());
}

async function verifyTournamentCreationWaitsForSchoolDeletion(): Promise<void> {
  const { createTournamentWithHostLocks } = await import(
    "../../src/lib/tournaments/tournament-creation"
  );
  await sql`INSERT INTO public.schools
    (id, name, slug, university, gender, region, verification_status)
    VALUES (${creationSchoolId}, 'Creation School', 'creation-lock-school',
      'Delete University', 'mens', 'midwest', 'verified')`;
  await sql`INSERT INTO public.teams
    (id, name, slug, university, school_id, gender, region, verification_status)
    VALUES (${creationTeamId}, 'Creation Team', 'creation-lock-team',
      'Delete University', ${creationSchoolId}, 'mens', 'midwest', 'verified')`;
  await sql`INSERT INTO public.school_members (school_id, user_id, role)
    VALUES (${creationSchoolId}, ${actorId}, 'officer')`;
  const started = deferred();
  const allowDelete = deferred();
  const deletion = sql.begin(async (tx) => {
    await tx`UPDATE public.teams SET updated_at = updated_at
      WHERE id = ${creationTeamId}`;
    started.resolve();
    await allowDelete.promise;
    await tx`DELETE FROM public.schools WHERE id = ${creationSchoolId}`;
  });
  await started.promise;
  let settled = false;
  const creation = createTournamentWithHostLocks({
    actorId, hostSchoolId: creationSchoolId,
    name: "Creation Lock Tournament", slug: "creation-lock-tournament",
    description: null, date: "2027-08-04", location: "Gym",
    address: null, playFormat: "pool_to_bracket",
  }).then(
    () => ({ status: "fulfilled" as const }),
    (error: unknown) => ({ status: "rejected" as const, error })
  ).finally(() => { settled = true; });
  try {
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(settled, false, "creation must wait for the host team lock");
  } finally {
    allowDelete.resolve();
  }
  await deletion;
  const outcome = await creation;
  assert.equal(outcome.status, "rejected");
  if (outcome.status === "rejected") {
    assert.notEqual((outcome.error as { code?: string })?.code, "40P01");
    assert.match(String(outcome.error), /Hosting school not found/i);
  }
}

async function main(): Promise<void> {
  await cleanup();
  try {
    await seed();
    await verifyParentGrowthRetry();
    await verifyRevokedAuthorization();
    await verifyRevokedSchoolPresident();
    await verifyRevokedAdmin();
    await verifyTournamentCreationWaitsForSchoolDeletion();
    await verifySchoolParentGrowthRetry();
    console.log("Verified team deletion parent retries and live authorization locks.");
  } finally {
    await cleanup();
    const { db } = await import("../../src/lib/db");
    await db.$client.end();
    await sql.end();
  }
}

void main();
