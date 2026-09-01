import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  projectReviewDeviations,
  reviewCapabilities,
} from "../../lib/server/reviews/review-read-model-projector";
import type {
  ReviewExerciseReadModel,
  ReviewSetReadModel,
} from "../../lib/server/reviews/review-types";

test("review deviation projector emits factual source-linked differences", () => {
  const exercise = reviewExercise([
    reviewSet({
      actualRepetitions: 8,
      actualWeightKg: 45,
      comment: "Последний повтор был тяжёлым",
    }),
  ]);

  const deviations = projectReviewDeviations(exercise);
  assert.deepEqual(deviations.map((item) => item.type), [
    "planned_repetitions_not_met",
    "load_changed",
    "athlete_comment_present",
  ]);
  assert.equal(deviations[0].exerciseLogId, "22222222-2222-4222-8222-222222222222");
  assert.equal(deviations[0].setLogId, "33333333-3333-4333-8333-333333333333");
  assert.equal(deviations[0].sourceAssignmentSetId, "44444444-4444-4444-8444-444444444444");
  assert.equal(deviations[2].commentReference?.text, "Последний повтор был тяжёлым");
});

test("skipped, incomplete and missing results remain different states", () => {
  const skipped = reviewExercise([reviewSet({ status: "skipped", actualRepetitions: null, actualWeightKg: null })]);
  const incomplete = reviewExercise([reviewSet({ status: "incomplete" })]);
  const missing = reviewExercise([reviewSet({ status: "missing", setLogId: null, sourceAssignmentSetId: null })]);

  assert.deepEqual(projectReviewDeviations(skipped).map((item) => item.type), ["set_skipped"]);
  assert.deepEqual(projectReviewDeviations(incomplete).map((item) => item.type), [
    "result_incomplete",
    "planned_repetitions_not_met",
  ]);
  assert.deepEqual(projectReviewDeviations(missing).map((item) => item.type), [
    "log_missing",
    "source_unavailable",
  ]);
  assert.equal(skipped.sets[0].actual.repetitions, null);
});

test("review capabilities are server-derived from persisted state and valid linkage", () => {
  assert.deepEqual(reviewCapabilities({ attentionStatus: "open", feedbackCount: 0, sourceIdentityValid: true }), {
    canRead: true,
    canSendInitialFeedback: true,
    canSendAcknowledgement: true,
    canSendFollowUp: false,
    canResolveManually: true,
  });
  assert.equal(reviewCapabilities({ attentionStatus: "resolved", feedbackCount: 1, sourceIdentityValid: true }).canSendFollowUp, true);
  assert.deepEqual(reviewCapabilities({ attentionStatus: "open", feedbackCount: 0, sourceIdentityValid: false }), {
    canRead: false,
    canSendInitialFeedback: false,
    canSendAcknowledgement: false,
    canSendFollowUp: false,
    canResolveManually: false,
  });
});

test("canonical server Review path has a constant query budget and no demo imports", () => {
  const repository = readFileSync("lib/server/reviews/review-repository.ts", "utf8");
  const service = readFileSync("lib/server/reviews/review-service.ts", "utf8");
  const start = repository.indexOf("  findReview(actor:");
  const end = repository.indexOf("\n  findSource(actor:", start);
  const findReview = repository.slice(start, end);

  assert.equal((findReview.match(/client\.query/g) ?? []).length, 6);
  assert.doesNotMatch(`${repository}\n${service}`, /trainer-os\/workout-review\/(review-model|review-store)/);
  assert.doesNotMatch(`${repository}\n${service}`, /demo-runtime|demoReviewSessions/);
});

function reviewExercise(sets: ReviewSetReadModel[]): ReviewExerciseReadModel {
  return {
    identity: {
      exerciseLogId: "22222222-2222-4222-8222-222222222222",
      assignmentExerciseId: "11111111-1111-4111-8111-111111111111",
      position: 1,
      title: "Жим лёжа",
    },
    prescribed: {
      instanceKey: "bench",
      category: "Грудь",
      equipment: "Штанга",
      prescriptionType: "repetitions",
      repetitionMode: "fixed",
      repetitionsMin: 10,
      repetitionsMax: 10,
      durationSeconds: null,
      targetWeightKg: 50,
      restSeconds: 90,
      trainerNote: "",
    },
    actual: {
      status: "completed",
      athleteNote: { status: "unsupported", reason: "write_path_not_confirmed" },
      createdAt: "2026-08-31T10:00:00.000Z",
      updatedAt: "2026-08-31T10:10:00.000Z",
    },
    sets,
    sourceComments: [],
    deviations: [],
  };
}

function reviewSet(options: {
  status?: ReviewSetReadModel["actual"]["status"];
  setLogId?: string | null;
  sourceAssignmentSetId?: string | null;
  actualRepetitions?: number | null;
  actualWeightKg?: number | null;
  comment?: string;
} = {}): ReviewSetReadModel {
  const status = options.status ?? "completed";
  const setLogId = options.setLogId === undefined ? "33333333-3333-4333-8333-333333333333" : options.setLogId;
  const sourceAssignmentSetId = options.sourceAssignmentSetId === undefined
    ? "44444444-4444-4444-8444-444444444444"
    : options.sourceAssignmentSetId;
  const comment = options.comment ?? "";
  return {
    identity: { setLogId, sourceAssignmentSetId, setKey: "working-1", position: 1 },
    prescribed: {
      source: sourceAssignmentSetId ? "assignment_snapshot" : "session_snapshot",
      kind: "working",
      repetitionsMin: 10,
      repetitionsMax: 10,
      durationSeconds: null,
      weightKg: 50,
      restSeconds: sourceAssignmentSetId ? 90 : null,
    },
    actual: {
      status,
      repetitions: options.actualRepetitions === undefined ? (status === "missing" ? null : 8) : options.actualRepetitions,
      durationSeconds: null,
      weightKg: options.actualWeightKg === undefined ? 50 : options.actualWeightKg,
      rpe: 8,
      createdAt: setLogId ? "2026-08-31T10:00:00.000Z" : null,
      updatedAt: setLogId ? "2026-08-31T10:10:00.000Z" : null,
    },
    athleteComment: comment ? { status: "ready", value: comment } : { status: "known_empty", value: null },
    sourceComments: comment && setLogId ? [{
      source: "set_comment",
      sourceId: setLogId,
      exerciseLogId: "22222222-2222-4222-8222-222222222222",
      setLogId,
      text: comment,
    }] : [],
    deviations: [],
  };
}
