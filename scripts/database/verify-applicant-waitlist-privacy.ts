import assert from "node:assert/strict";
import { and, eq } from "drizzle-orm";
import type { db } from "../../src/lib/db";
import {
  registrationStatusEvents,
  schools,
  teamMembers,
  teams,
  tournamentWaitlistEntries,
  tournaments,
  users,
} from "../../src/lib/db/schema";

type VerifierDatabase = Pick<
  typeof db,
  "delete" | "insert" | "select" | "transaction"
>;

const ids = {
  ownUser: "a9000000-0000-4000-8000-000000000001",
  otherUser: "a9000000-0000-4000-8000-000000000002",
  organizer: "a9000000-0000-4000-8000-000000000003",
  school: "a9000000-0000-4000-8000-000000000010",
  tournament: "a9000000-0000-4000-8000-000000000020",
  otherTournament: "a9000000-0000-4000-8000-000000000021",
  ownTeam: "a9000000-0000-4000-8000-000000000101",
  otherUserTeam: "a9000000-0000-4000-8000-000000000102",
  otherTournamentTeam: "a9000000-0000-4000-8000-000000000103",
  terminalTeam: "a9000000-0000-4000-8000-000000000104",
  nonCaptainTeam: "a9000000-0000-4000-8000-000000000105",
} as const;

const operationIds = [
  "a9000000-0000-4000-8000-000000000201",
  "a9000000-0000-4000-8000-000000000202",
  "a9000000-0000-4000-8000-000000000203",
  "a9000000-0000-4000-8000-000000000204",
  "a9000000-0000-4000-8000-000000000205",
] as const;

async function cleanup(database: VerifierDatabase): Promise<void> {
  await database
    .delete(tournaments)
    .where(eq(tournaments.id, ids.otherTournament));
  await database.delete(tournaments).where(eq(tournaments.id, ids.tournament));
  await database.delete(teams).where(eq(teams.schoolId, ids.school));
  await database.delete(schools).where(eq(schools.id, ids.school));
  for (const userId of [ids.ownUser, ids.otherUser, ids.organizer]) {
    await database.delete(users).where(eq(users.id, userId));
  }
}

async function seedUsersAndSchool(database: VerifierDatabase): Promise<void> {
  await database.insert(users).values([
    { id: ids.ownUser, authId: crypto.randomUUID(), email: "own@example.test", fullName: "Own Captain", role: "player" },
    { id: ids.otherUser, authId: crypto.randomUUID(), email: "other@example.test", fullName: "Other Captain", role: "player" },
    { id: ids.organizer, authId: crypto.randomUUID(), email: "organizer@example.test", fullName: "Organizer", role: "organizer" },
  ]);
  await database.insert(schools).values({
    id: ids.school,
    name: "Applicant Privacy School",
    slug: "applicant-privacy-school",
    university: "Applicant University",
    gender: "mens",
    region: "midwest",
    verificationStatus: "verified",
    verifiedAt: new Date(),
  });
}

async function seedTeams(database: VerifierDatabase): Promise<void> {
  const fixtures = [
    [ids.ownTeam, "Own Waiting Team", "own-waiting-team"],
    [ids.otherUserTeam, "Other User Team", "other-user-team"],
    [ids.otherTournamentTeam, "Other Tournament Team", "other-tournament-team"],
    [ids.terminalTeam, "Terminal Team", "terminal-team"],
    [ids.nonCaptainTeam, "Non Captain Team", "non-captain-team"],
  ] as const;
  await database.insert(teams).values(
    fixtures.map(([id, name, slug]) => ({
      id,
      name,
      slug,
      university: "Applicant University",
      schoolId: ids.school,
      gender: "mens" as const,
      region: "midwest" as const,
      verificationStatus: "verified" as const,
      verifiedAt: new Date(),
    }))
  );
}

async function seedTournaments(database: VerifierDatabase): Promise<void> {
  await database.insert(tournaments).values([
    {
      id: ids.tournament,
      organizerId: ids.organizer,
      hostSchoolId: ids.school,
      name: "Applicant Privacy Tournament",
      slug: "applicant-privacy-tournament",
      date: "2027-07-30",
      location: "Privacy Gym",
      status: "registration_open",
      gender: "mens",
      region: "midwest",
    },
    {
      id: ids.otherTournament,
      organizerId: ids.organizer,
      hostSchoolId: ids.school,
      name: "Other Privacy Tournament",
      slug: "other-privacy-tournament",
      date: "2027-07-31",
      location: "Other Gym",
      status: "registration_open",
      gender: "mens",
      region: "midwest",
    },
  ]);
}

async function seedMemberships(database: VerifierDatabase): Promise<void> {
  await database.insert(teamMembers).values([
    { teamId: ids.ownTeam, userId: ids.ownUser, role: "captain" },
    { teamId: ids.otherUserTeam, userId: ids.otherUser, role: "captain" },
    { teamId: ids.otherTournamentTeam, userId: ids.ownUser, role: "captain" },
    { teamId: ids.terminalTeam, userId: ids.ownUser, role: "captain" },
    { teamId: ids.nonCaptainTeam, userId: ids.ownUser, role: "player" },
  ]);
}

async function seedWaitlistRows(database: VerifierDatabase): Promise<void> {
  await database.insert(tournamentWaitlistEntries).values([
    { tournamentId: ids.tournament, teamId: ids.ownTeam, requestedByUserId: ids.ownUser, requestOperationId: operationIds[0] },
    { tournamentId: ids.tournament, teamId: ids.otherUserTeam, requestedByUserId: ids.otherUser, requestOperationId: operationIds[1] },
    { tournamentId: ids.otherTournament, teamId: ids.otherTournamentTeam, requestedByUserId: ids.ownUser, requestOperationId: operationIds[2] },
    {
      tournamentId: ids.tournament,
      teamId: ids.terminalTeam,
      requestedByUserId: ids.ownUser,
      requestOperationId: operationIds[3],
      status: "withdrawn",
      resolvedAt: new Date(),
      resolvedByUserId: ids.ownUser,
      resolutionOperationId: crypto.randomUUID(),
    },
    { tournamentId: ids.tournament, teamId: ids.nonCaptainTeam, requestedByUserId: ids.ownUser, requestOperationId: operationIds[4] },
  ]);
}

async function seed(database: VerifierDatabase): Promise<void> {
  await seedUsersAndSchool(database);
  await seedTeams(database);
  await seedTournaments(database);
  await seedMemberships(database);
  await seedWaitlistRows(database);
}

async function tamperSnapshot(database: VerifierDatabase) {
  const [entry] = await database
    .select({
      status: tournamentWaitlistEntries.status,
      resolvedAt: tournamentWaitlistEntries.resolvedAt,
      resolvedByUserId: tournamentWaitlistEntries.resolvedByUserId,
      resolutionOperationId: tournamentWaitlistEntries.resolutionOperationId,
    })
    .from(tournamentWaitlistEntries)
    .where(
      and(
        eq(tournamentWaitlistEntries.tournamentId, ids.tournament),
        eq(tournamentWaitlistEntries.teamId, ids.otherUserTeam)
      )
    );
  const auditRows = await database
    .select({ id: registrationStatusEvents.id })
    .from(registrationStatusEvents)
    .where(eq(registrationStatusEvents.tournamentId, ids.tournament));
  return { entry, auditCount: auditRows.length };
}

export async function verifyApplicantWaitlistPrivacy(
  database: VerifierDatabase
): Promise<void> {
  const { loadApplicantWaitlistState, withdrawApplicantWaitlistEntry } =
    await import("../../src/lib/tournaments/applicant-waitlist");
  await cleanup(database);
  try {
    await seed(database);
    const state = await loadApplicantWaitlistState(
      { tournamentId: ids.tournament, userId: ids.ownUser },
      database
    );
    assert.deepEqual(state.applicantWaitlistRows.map((row) => row.teamId), [
      ids.ownTeam,
    ]);
    assert.equal(state.applicantWaitlistRows[0].teamName, "Own Waiting Team");
    const before = await tamperSnapshot(database);
    let successCalls = 0;
    await assert.rejects(() =>
      withdrawApplicantWaitlistEntry(
        { tournamentId: ids.tournament, teamId: ids.otherUserTeam, actorUserId: ids.ownUser },
        async () => { successCalls += 1; },
        database
      )
    );
    assert.deepEqual(await tamperSnapshot(database), before);
    assert.equal(successCalls, 0);
    await withdrawApplicantWaitlistEntry(
      { tournamentId: ids.tournament, teamId: ids.ownTeam, actorUserId: ids.ownUser },
      async () => { successCalls += 1; },
      database
    );
    assert.equal(successCalls, 1);
  } finally {
    await cleanup(database);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.BRACKT_BOOTSTRAP_DATABASE_URL;
  if (!databaseUrl) return;
  if (!databaseUrl.startsWith("postgresql://postgres@127.0.0.1:")) {
    throw new Error("Applicant verifier requires the disposable local database");
  }
  process.env.DATABASE_URL = databaseUrl;
  const { db: database } = await import("../../src/lib/db");
  await verifyApplicantWaitlistPrivacy(database);
  console.log("APPLICANT_WAITLIST_PRIVACY_PASS");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
