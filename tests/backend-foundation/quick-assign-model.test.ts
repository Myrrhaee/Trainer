import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  decodeQuickAssignCursor,
  encodeQuickAssignCursor,
  QuickAssignInvalidCursorError,
} from "../../lib/server/quick-assign/quick-assign-cursor";
import {
  assignmentStateTokensEqual,
  isAssignmentStateToken,
  projectAssignmentStateToken,
} from "../../lib/server/quick-assign/assignment-state-token";

const scope = {
  trainerUserId: "11111111-1111-4111-8111-111111111111",
  athleteUserId: "22222222-2222-4222-8222-222222222222",
  relationId: "33333333-3333-4333-8333-333333333333",
};

test("quick assign cursor is stable and bound to trainer, athlete, relation and search", () => {
  const cursor = encodeQuickAssignCursor({
    ...scope,
    query: "сила",
    updatedAt: "2026-08-31T10:00:00.000Z",
    templateId: "44444444-4444-4444-8444-444444444444",
  });
  assert.deepEqual(decodeQuickAssignCursor(cursor, { ...scope, query: "сила" }), {
    ...scope,
    query: "сила",
    updatedAt: "2026-08-31T10:00:00.000Z",
    templateId: "44444444-4444-4444-8444-444444444444",
  });
  assert.throws(
    () => decodeQuickAssignCursor(cursor, { ...scope, query: "ноги" }),
    QuickAssignInvalidCursorError,
  );
  assert.throws(
    () => decodeQuickAssignCursor(cursor, { ...scope, trainerUserId: "55555555-5555-4555-8555-555555555555", query: "сила" }),
    QuickAssignInvalidCursorError,
  );
});

test("assignment state token is deterministic, order-independent and scope-bound", () => {
  const assignments = [
    {
      assignmentId: "66666666-6666-4666-8666-666666666666",
      sourceRevisionId: "77777777-7777-4777-8777-777777777777",
      title: "A",
      scheduledFor: "2026-09-02",
      createdAt: "2026-08-31T12:00:00.000Z",
    },
    {
      assignmentId: "88888888-8888-4888-8888-888888888888",
      sourceRevisionId: "99999999-9999-4999-8999-999999999999",
      title: "B",
      scheduledFor: "2026-09-01",
      createdAt: "2026-08-31T11:00:00.000Z",
    },
  ];
  const token = projectAssignmentStateToken({ ...scope, assignments });
  const reordered = projectAssignmentStateToken({ ...scope, assignments: [...assignments].reverse() });
  const otherAthlete = projectAssignmentStateToken({
    ...scope,
    athleteUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    assignments,
  });
  assert.equal(isAssignmentStateToken(token), true);
  assert.equal(assignmentStateTokensEqual(token, reordered), true);
  assert.equal(assignmentStateTokensEqual(token, otherAthlete), false);
  assert.equal(token.includes(assignments[0].assignmentId), false);
});

test("canonical Quick Assign server boundary has no demo, mock or localStorage dependency", () => {
  const source = [
    "lib/server/quick-assign/quick-assign-types.ts",
    "lib/server/quick-assign/quick-assign-cursor.ts",
    "lib/server/quick-assign/assignment-state-token.ts",
    "lib/server/quick-assign/quick-assign-repository.ts",
    "lib/server/quick-assign/quick-assign-query-service.ts",
    "app/api/trainer/athletes/[athleteId]/quick-assign/route.ts",
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(source, /demo-runtime|mock-data|localStorage|quick-assign-model/);
});
