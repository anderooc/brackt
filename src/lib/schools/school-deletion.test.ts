import assert from "node:assert/strict";
import { it } from "node:test";
import {
  deleteSchoolWithEligibilityLocks,
  type SchoolDeletionStore,
} from "@/lib/schools/school-deletion";

type FakeTransaction = { attempt: number };
const parent = { id: "tournament-1", slug: "tournament-one" };

it("demotes school teams before deleting so they cannot stay verified standalones", async () => {
  const events: string[] = [];
  const store: SchoolDeletionStore<FakeTransaction> = {
    async transaction(work) {
      return work({ attempt: 1 });
    },
    async lockParents() {
      return [parent];
    },
    async currentTeamIds() {
      return ["team-1"];
    },
    async lockTeams() {},
    async lockSchool() {},
    async currentParentIds() {
      return [parent.id];
    },
    async deleteSchool() {
      events.push("demote-then-delete");
    },
  };

  const result = await deleteSchoolWithEligibilityLocks(
    {
      schoolId: "school-1",
      authorize: async () => null,
      afterCommit: async () => {
        events.push("after-commit");
      },
    },
    store
  );

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(events, ["demote-then-delete", "after-commit"]);
});

it("checks live authorization after parent, team, and school locks", async () => {
  const events: string[] = [];
  let deleted = false;
  let invalidated = false;
  const store: SchoolDeletionStore<FakeTransaction> = {
    async transaction(work) {
      events.push("transaction:start");
      const result = await work({ attempt: 1 });
      events.push("transaction:commit");
      return result;
    },
    async lockParents() { events.push("parents:lock"); return [parent]; },
    async currentTeamIds() { return ["team-1"]; },
    async lockTeams() { events.push("teams:lock"); },
    async lockSchool() { events.push("school:lock"); },
    async currentParentIds() { return [parent.id]; },
    async deleteSchool() { deleted = true; },
  };
  const result = await deleteSchoolWithEligibilityLocks({
    schoolId: "school-1",
    authorize: async () => {
      events.push("authorize");
      return "Authorization was revoked";
    },
    afterCommit: async () => { invalidated = true; },
  }, store);
  assert.deepEqual(result, { ok: false, error: "Authorization was revoked" });
  assert.ok(events.indexOf("school:lock") < events.indexOf("authorize"));
  assert.equal(deleted, false);
  assert.equal(invalidated, false);
});

it("retries parent growth and invalidates only after commit", async () => {
  const events: string[] = [];
  let attempt = 0;
  const store: SchoolDeletionStore<FakeTransaction> = {
    async transaction(work) {
      const tx = { attempt: ++attempt };
      const result = await work(tx);
      events.push(`tx${tx.attempt}:commit`);
      return result;
    },
    async lockParents(_schoolId, knownIds, tx) {
      return tx.attempt === 1
        ? [parent]
        : [...new Set([...knownIds, "tournament-2"])].map((id) => ({ id, slug: id }));
    },
    async currentTeamIds() { return ["team-1"]; },
    async lockTeams() {},
    async lockSchool() {},
    async currentParentIds(_schoolId, tx) {
      return tx.attempt === 1 ? [parent.id, "tournament-2"] : [parent.id, "tournament-2"];
    },
    async deleteSchool(_schoolId, tx) { events.push(`tx${tx.attempt}:delete`); },
  };
  const result = await deleteSchoolWithEligibilityLocks({
    schoolId: "school-1",
    authorize: async () => null,
    afterCommit: async (parents) => {
      events.push(`invalidate:${parents.map((row) => row.id).sort().join(",")}`);
    },
  }, store);
  assert.deepEqual(result, { ok: true });
  assert.equal(attempt, 2);
  assert.ok(events.indexOf("tx2:commit") <
    events.indexOf("invalidate:tournament-1,tournament-2"));
});
