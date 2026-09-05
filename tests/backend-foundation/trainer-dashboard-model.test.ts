import assert from "node:assert/strict";
import test from "node:test";

import { buildCanonicalTrainerDashboardView } from "../../components/trainer/canonical-trainer-dashboard-model";
import type { TrainerDashboardSnapshot } from "../../lib/server/trainer-dashboard/trainer-dashboard-types";

const NOW = new Date("2026-08-23T18:00:00.000Z");

test("canonical trainer dashboard maps assignments, reviews, and activity without invented health data", () => {
  const snapshot: TrainerDashboardSnapshot = {
    athletes: [
      athlete("athlete-unassigned", "Мария Волкова", null),
      athlete("athlete-assigned", "Артём Смирнов", {
        id: "assignment-1",
        title: "Полное тело",
        scheduledFor: "2026-08-24",
        sessionId: null,
        status: "scheduled",
      }),
      athlete("athlete-review", "Ирина Козлова", null),
    ],
    reviews: [{
      id: "review-1",
      sessionId: "session-review",
      athleteUserId: "athlete-review",
      athleteDisplayName: "Ирина Козлова",
      athleteInitials: "ИК",
      sessionTitle: "Силовая база",
      status: "open",
      completedAt: "2026-08-23T17:30:00.000Z",
      createdAt: "2026-08-23T17:30:00.000Z",
      totalSets: 4,
      completedSets: 3,
      hasClientComments: true,
      priorityReasons: ["client_comment", "omissions"],
    }],
    activities: [
      {
        id: "activity-completed",
        athleteUserId: "athlete-review",
        athleteDisplayName: "Ирина Козлова",
        kind: "workout_completed",
        title: "Силовая база",
        detail: "Силовая база",
        occurredAt: "2026-08-23T17:30:00.000Z",
        sessionId: "session-review",
      },
    ],
  };

  const view = buildCanonicalTrainerDashboardView(snapshot, NOW);

  assert.equal(view.summary.active, 3);
  assert.equal(view.summary.calm, 1);
  assert.equal(view.summary.attention, 2);
  assert.equal(view.summary.waitingReview, 1);
  assert.equal(view.clients.find((client) => client.id === "athlete-assigned")?.state, "on_track");
  assert.equal(view.clients.find((client) => client.id === "athlete-review")?.state, "waiting_review");
  assert.equal(view.clients.find((client) => client.id === "athlete-unassigned")?.state, "no_next_workout");
  assert.deepEqual(view.attentionItems.map((item) => item.kind).sort(), ["assignment", "review"]);
  assert.equal(view.activities[0]?.title, "Ирина Козлова: тренировка завершена");
  assert.equal(view.activities[0]?.href, "/trainer/review/session-review?from=history");
});

function athlete(
  athleteUserId: string,
  displayName: string,
  nextAssignment: TrainerDashboardSnapshot["athletes"][number]["nextAssignment"],
): TrainerDashboardSnapshot["athletes"][number] {
  return {
    relationId: `relation-${athleteUserId}`,
    relationStatus: "active",
    athleteUserId,
    athleteStatus: "active",
    displayName,
    initials: displayName.split(" ").map((part) => part[0]).join(""),
    acceptedAt: "2026-08-20T10:00:00.000Z",
    latestActivityAt: "2026-08-23T17:00:00.000Z",
    nextAssignment,
  };
}
