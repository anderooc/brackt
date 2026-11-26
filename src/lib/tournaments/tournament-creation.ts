import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { schoolMembers, schools, teams, tournaments, users } from "@/lib/db/schema";
import {
  tournamentCreatorPromotableRoles,
  tournamentCreatorRoleUpdate,
} from "@/lib/tournaments/permissions";
import { registerHostSchoolTeamsOnCreate } from "@/lib/tournaments/registrations";
import { defaultTimeZoneForRegion } from "@/lib/tournament-time";
import {
  OperationConflictError,
  OperationValidationError,
} from "@/lib/tournaments/competition-operation-rules";

type CreationDatabase = Pick<typeof db, "transaction">;

export type TournamentCreationInput = {
  actorId: string;
  hostSchoolId: string;
  name: string;
  slug: string;
  description: string | null;
  date: string;
  location: string;
  address: string | null;
  playFormat: (typeof tournaments.$inferInsert)["playFormat"];
};

async function hostTeamIds(client: typeof db, schoolId: string) {
  const rows = await client.select({ id: teams.id }).from(teams)
    .where(eq(teams.schoolId, schoolId));
  return rows.map((row) => row.id);
}

async function lockHostTeams(
  client: typeof db,
  teamIds: string[]
): Promise<void> {
  if (teamIds.length === 0) return;
  await client.select({ id: teams.id }).from(teams)
    .where(inArray(teams.id, teamIds)).orderBy(asc(teams.id)).for("share");
}

async function loadAuthorizedHost(
  client: typeof db,
  input: TournamentCreationInput
) {
  const [school] = await client.select({
    id: schools.id, gender: schools.gender, region: schools.region,
  }).from(schools).where(eq(schools.id, input.hostSchoolId))
    .for("update").limit(1);
  if (!school) throw new OperationValidationError("Hosting school not found");
  const [actor] = await client.select({ role: users.role, disabledAt: users.disabledAt })
    .from(users).where(eq(users.id, input.actorId)).for("share").limit(1);
  if (!actor || actor.disabledAt) {
    throw new OperationValidationError("Your account cannot create tournaments");
  }
  if (actor.role !== "admin") {
    const [membership] = await client.select({ id: schoolMembers.id })
      .from(schoolMembers).where(and(
        eq(schoolMembers.schoolId, school.id),
        eq(schoolMembers.userId, input.actorId),
        or(eq(schoolMembers.role, "president"), eq(schoolMembers.role, "officer"))
      )).for("share").limit(1);
    if (!membership) throw new OperationValidationError(
      "Select a school you represent as president or officer"
    );
  }
  return { school, actorRole: actor.role };
}

async function insertTournamentAndRegistrations(
  client: typeof db,
  input: TournamentCreationInput,
  host: Awaited<ReturnType<typeof loadAuthorizedHost>>
) {
  const [created] = await client.insert(tournaments).values({
    organizerId: input.actorId, hostSchoolId: host.school.id,
    gender: host.school.gender, region: host.school.region,
    name: input.name, slug: input.slug, description: input.description,
    date: input.date, location: input.location, address: input.address,
    timeZone: defaultTimeZoneForRegion(host.school.region),
    playFormat: input.playFormat, status: "draft",
  }).returning();
  const roleUpdate = tournamentCreatorRoleUpdate(host.actorRole);
  if (roleUpdate) {
    await client.update(users).set({ role: roleUpdate }).where(and(
      eq(users.id, input.actorId),
      inArray(users.role, [...tournamentCreatorPromotableRoles])
    ));
  }
  await registerHostSchoolTeamsOnCreate(
    created.id, host.school.id, input.actorId, client
  );
  return created;
}

async function attemptTournamentCreation(
  input: TournamentCreationInput,
  knownTeamIds: string[],
  database: CreationDatabase
) {
  return database.transaction(async (rawTx) => {
    const tx = rawTx as unknown as typeof db;
    const discovered = await hostTeamIds(tx, input.hostSchoolId);
    const teamIds = [...new Set([...knownTeamIds, ...discovered])].sort();
    await lockHostTeams(tx, teamIds);
    const host = await loadAuthorizedHost(tx, input);
    const currentIds = await hostTeamIds(tx, input.hostSchoolId);
    const lockedIds = new Set(teamIds);
    const missingIds = currentIds.filter((id) => !lockedIds.has(id));
    if (missingIds.length > 0) {
      return { created: null, retryIds: [...lockedIds, ...missingIds] };
    }
    return {
      created: await insertTournamentAndRegistrations(tx, input, host),
      retryIds: null,
    };
  });
}

export async function createTournamentWithHostLocks(
  input: TournamentCreationInput,
  database: CreationDatabase = db
) {
  let knownTeamIds: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await attemptTournamentCreation(input, knownTeamIds, database);
    if (result.created) return result.created;
    knownTeamIds = result.retryIds ?? knownTeamIds;
  }
  throw new OperationConflictError("School team activity changed. Try again.");
}
