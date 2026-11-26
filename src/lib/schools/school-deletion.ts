import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { schoolMembers, schools, teams, users } from "@/lib/db/schema";
import {
  lockPublicTournamentParentsForSchool,
  publicTournamentIdsForSchool,
  type PublicTournamentParent,
} from "@/lib/tournaments/public-cache-invalidation";

export interface SchoolDeletionStore<TTransaction> {
  transaction<T>(work: (tx: TTransaction) => Promise<T>): Promise<T>;
  lockParents(
    schoolId: string, knownIds: Iterable<string>, tx: TTransaction
  ): Promise<PublicTournamentParent[]>;
  currentTeamIds(schoolId: string, tx: TTransaction): Promise<string[]>;
  lockTeams(teamIds: string[], tx: TTransaction): Promise<void>;
  lockSchool(schoolId: string, tx: TTransaction): Promise<void>;
  currentParentIds(schoolId: string, tx: TTransaction): Promise<string[]>;
  deleteSchool(schoolId: string, tx: TTransaction): Promise<void>;
}

export type SchoolDeletionInput<TTransaction> = {
  schoolId: string;
  authorize: (tx: TTransaction) => Promise<string | null>;
  afterCommit: (parents: PublicTournamentParent[]) => Promise<void>;
};

type SchoolDeletionAttempt =
  | { ok: true; parents: PublicTournamentParent[] }
  | { ok: false; error: string }
  | { ok: false; parentIds: string[]; teamIds: string[] };

export function createDrizzleSchoolDeletionStore(
  database: typeof db
): SchoolDeletionStore<typeof db> {
  return {
    transaction<T>(work: (tx: typeof db) => Promise<T>): Promise<T> {
      return database.transaction(
        (rawTx) => work(rawTx as unknown as typeof db)
      );
    },
    lockParents(schoolId, knownIds, tx) {
      return lockPublicTournamentParentsForSchool(schoolId, knownIds, tx);
    },
    async currentTeamIds(schoolId, tx) {
      const rows = await tx.select({ id: teams.id }).from(teams)
        .where(eq(teams.schoolId, schoolId));
      return rows.map((row) => row.id);
    },
    async lockTeams(teamIds, tx) {
      if (teamIds.length === 0) return;
      await tx.select({ id: teams.id }).from(teams)
        .where(inArray(teams.id, teamIds)).orderBy(asc(teams.id)).for("update");
    },
    async lockSchool(schoolId, tx) {
      await tx.select({ id: schools.id }).from(schools)
        .where(eq(schools.id, schoolId)).for("update");
    },
    currentParentIds(schoolId, tx) {
      return publicTournamentIdsForSchool(schoolId, tx);
    },
    async deleteSchool(schoolId, tx) {
      // FK sets school_id null; demote former school teams so they don't stay
      // tournament-eligible as verified standalones without admin review.
      await tx
        .update(teams)
        .set({
          verificationStatus: "pending",
          verifiedAt: null,
          verifiedByUserId: null,
          updatedAt: new Date(),
        })
        .where(eq(teams.schoolId, schoolId));
      await tx.delete(schools).where(eq(schools.id, schoolId));
    },
  };
}

const drizzleSchoolDeletionStore = createDrizzleSchoolDeletionStore(db);

async function attemptSchoolDeletion<TTransaction>(
  input: SchoolDeletionInput<TTransaction>,
  knownParentIds: string[],
  knownTeamIds: string[],
  store: SchoolDeletionStore<TTransaction>
): Promise<SchoolDeletionAttempt> {
  return store.transaction(async (tx) => {
    const parents = await store.lockParents(
      input.schoolId, knownParentIds, tx
    );
    const discoveredTeamIds = await store.currentTeamIds(input.schoolId, tx);
    const teamIds = [...new Set([...knownTeamIds, ...discoveredTeamIds])].sort();
    await store.lockTeams(teamIds, tx);
    await store.lockSchool(input.schoolId, tx);
    const [currentParentIds, currentTeamIds] = await Promise.all([
      store.currentParentIds(input.schoolId, tx),
      store.currentTeamIds(input.schoolId, tx),
    ]);
    const lockedParentIds = new Set(parents.map((parent) => parent.id));
    const lockedTeamIds = new Set(teamIds);
    const missingParents = currentParentIds.filter((id) => !lockedParentIds.has(id));
    const missingTeams = currentTeamIds.filter((id) => !lockedTeamIds.has(id));
    if (missingParents.length > 0 || missingTeams.length > 0) {
      return { ok: false as const,
        parentIds: [...lockedParentIds, ...missingParents],
        teamIds: [...lockedTeamIds, ...missingTeams] };
    }
    const authorizationError = await input.authorize(tx);
    if (authorizationError) return { ok: false as const, error: authorizationError };
    await store.deleteSchool(input.schoolId, tx);
    return { ok: true as const, parents };
  });
}

export async function deleteSchoolWithEligibilityLocks<TTransaction = typeof db>(
  input: SchoolDeletionInput<TTransaction>,
  store: SchoolDeletionStore<TTransaction> =
    drizzleSchoolDeletionStore as unknown as SchoolDeletionStore<TTransaction>
): Promise<{ ok: true } | { ok: false; error: string }> {
  let parentIds: string[] = [];
  let teamIds: string[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await attemptSchoolDeletion(
      input, parentIds, teamIds, store
    );
    if ("parentIds" in result) {
      parentIds = [...new Set(result.parentIds)].sort();
      teamIds = [...new Set(result.teamIds)].sort();
      continue;
    }
    if (!result.ok) return result;
    await input.afterCommit(result.parents);
    return { ok: true };
  }
  return { ok: false, error: "School activity changed. Try again." };
}

export async function currentActorCanDeleteSchool(
  tx: typeof db,
  schoolId: string,
  actorId: string
): Promise<boolean> {
  const [actor] = await tx.select({ role: users.role, disabledAt: users.disabledAt })
    .from(users).where(eq(users.id, actorId)).for("share").limit(1);
  if (!actor || actor.disabledAt) return false;
  if (actor.role === "admin") return true;
  const [membership] = await tx.select({ role: schoolMembers.role })
    .from(schoolMembers).where(and(
      eq(schoolMembers.schoolId, schoolId),
      eq(schoolMembers.userId, actorId)
    )).for("share").limit(1);
  return membership?.role === "president";
}

export async function currentActorIsAdmin(
  tx: typeof db,
  actorId: string
): Promise<boolean> {
  const [actor] = await tx.select({ role: users.role, disabledAt: users.disabledAt })
    .from(users).where(eq(users.id, actorId)).for("share").limit(1);
  return actor != null && !actor.disabledAt && actor.role === "admin";
}
