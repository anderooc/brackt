import assert from "node:assert/strict";
import { it } from "node:test";
import { removeUserFromSchoolTeams } from "@/lib/schools/roster-cleanup";

/**
 * Lightweight executor that mirrors the select/update/delete sequence
 * `removeUserFromSchoolTeams` issues, without parsing Drizzle SQL ASTs.
 */
function createSequenceDb(opts: {
  teams: Array<{ id: string; slug: string }>;
  departingCaptainTeamIds: string[];
  otherCaptainsByTeam: Record<string, string[]>;
  replacementsByTeam: Record<string, string[]>;
}) {
  const events: string[] = [];
  let captainLoopIndex = 0;

  function currentCaptainTeamId() {
    return opts.departingCaptainTeamIds[captainLoopIndex] ?? null;
  }

  const fakeDb = {
    select(fields?: Record<string, unknown>) {
      const wantsSlug = fields != null && "slug" in fields;
      const wantsTeamIdOnly =
        fields != null && "teamId" in fields && !("id" in fields);

      return {
        from() {
          return {
            where() {
              if (wantsSlug) {
                return Promise.resolve(opts.teams);
              }

              if (wantsTeamIdOnly) {
                return Promise.resolve(
                  opts.departingCaptainTeamIds.map((teamId) => ({ teamId }))
                );
              }

              // Member-id queries always chain .limit / .orderBy.
              return {
                async limit(n: number) {
                  const teamId = currentCaptainTeamId();
                  const others =
                    (teamId && opts.otherCaptainsByTeam[teamId]) || [];
                  events.push(
                    `other-captains:${teamId ?? "none"}:${others.length}`
                  );
                  if (others.length > 0) {
                    // Advance past this captaincy; no replacement query follows.
                    captainLoopIndex += 1;
                  }
                  return others.slice(0, n).map((id) => ({ id }));
                },
                orderBy() {
                  return {
                    async limit(n: number) {
                      const teamId = currentCaptainTeamId();
                      const reps =
                        (teamId && opts.replacementsByTeam[teamId]) || [];
                      events.push(
                        `replacement:${teamId ?? "none"}:${reps[0] ?? "none"}`
                      );
                      captainLoopIndex += 1;
                      return reps.slice(0, n).map((id) => ({ id }));
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
    update() {
      return {
        set(values: { role?: string }) {
          return {
            async where() {
              events.push(`promote:${values.role}`);
            },
          };
        },
      };
    },
    delete() {
      return {
        async where() {
          events.push("delete-memberships");
        },
      };
    },
  };

  return { fakeDb, events };
}

it("removes the user from school-linked teams and returns their slugs", async () => {
  const { fakeDb, events } = createSequenceDb({
    teams: [
      { id: "team-a", slug: "bruins-mens" },
      { id: "team-b", slug: "bruins-womens" },
    ],
    departingCaptainTeamIds: [],
    otherCaptainsByTeam: {},
    replacementsByTeam: {},
  });

  const slugs = await removeUserFromSchoolTeams(
    "school-1",
    "user-1",
    fakeDb as never
  );

  assert.deepEqual(slugs, ["bruins-mens", "bruins-womens"]);
  assert.deepEqual(events, ["delete-memberships"]);
});

it("is a no-op when the school has no teams", async () => {
  const { fakeDb, events } = createSequenceDb({
    teams: [],
    departingCaptainTeamIds: [],
    otherCaptainsByTeam: {},
    replacementsByTeam: {},
  });

  const slugs = await removeUserFromSchoolTeams(
    "school-empty",
    "user-1",
    fakeDb as never
  );

  assert.deepEqual(slugs, []);
  assert.deepEqual(events, []);
});

it("promotes the longest-tenured teammate when the sole captain leaves", async () => {
  const { fakeDb, events } = createSequenceDb({
    teams: [{ id: "team-a", slug: "bruins-mens" }],
    departingCaptainTeamIds: ["team-a"],
    otherCaptainsByTeam: { "team-a": [] },
    replacementsByTeam: { "team-a": ["player-old", "player-new"] },
  });

  await removeUserFromSchoolTeams("school-1", "user-captain", fakeDb as never);

  assert.deepEqual(events, [
    "other-captains:team-a:0",
    "replacement:team-a:player-old",
    "promote:captain",
    "delete-memberships",
  ]);
});

it("skips promotion when another captain already remains", async () => {
  const { fakeDb, events } = createSequenceDb({
    teams: [{ id: "team-a", slug: "bruins-mens" }],
    departingCaptainTeamIds: ["team-a"],
    otherCaptainsByTeam: { "team-a": ["co-captain"] },
    replacementsByTeam: { "team-a": ["player-old"] },
  });

  await removeUserFromSchoolTeams("school-1", "user-captain", fakeDb as never);

  assert.deepEqual(events, [
    "other-captains:team-a:1",
    "delete-memberships",
  ]);
});
