import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanonicalTrainerRoster,
  filterCanonicalTrainerRoster,
} from "../../components/trainer/canonical-trainer-roster-model";
import type { TrainerDashboardSnapshot } from "../../lib/server/trainer-dashboard/trainer-dashboard-types";

const NOW = new Date("2026-08-23T18:00:00.000Z");

test("canonical roster prioritizes review and missing-workout states without inventing metrics", () => {
  const snapshot: TrainerDashboardSnapshot = {
    athletes: [
      athlete("assigned", "Артём Смирнов", {
        id: "assignment-1",
        title: "Полное тело",
        scheduledFor: "2026-08-24",
        sessionId: null,
        status: "scheduled",
      }),
      athlete("unassigned", "Мария Волкова", null),
      athlete("review", "Ирина Козлова", null),
    ],
    reviews: [{
      id: "review-1",
      sessionId: "session-review",
      athleteUserId: "review",
      athleteDisplayName: "Ирина Козлова",
      athleteInitials: "ИК",
      sessionTitle: "Силовая база",
      status: "open",
      completedAt: "2026-08-23T17:30:00.000Z",
      createdAt: "2026-08-23T17:30:00.000Z",
      completedSets: 3,
      totalSets: 4,
      hasClientComments: true,
      priorityReasons: ["client_comment"],
    }],
    activities: [],
  };

  const roster = buildCanonicalTrainerRoster(snapshot, NOW);

  assert.deepEqual(roster.athletes.map((item) => item.status), [
    "waiting_review",
    "no_next_workout",
    "scheduled",
  ]);
  assert.deepEqual(roster.summary, { total: 3, attention: 2, waitingReview: 1, onTrack: 1 });
  assert.equal(roster.athletes[0]?.reviewHref, "/trainer/review/session-review");
  assert.equal(roster.athletes[2]?.nextStep, "Полное тело");
});

test("canonical roster search and workflow filters operate on visible facts", () => {
  const roster = buildCanonicalTrainerRoster({
    athletes: [
      athlete("assigned", "Артём Смирнов", {
        id: "assignment-1",
        title: "Полное тело",
        scheduledFor: "2026-08-24",
        sessionId: null,
        status: "scheduled",
      }),
      athlete("unassigned", "Мария Волкова", null),
    ],
    reviews: [],
    activities: [],
  }, NOW).athletes;

  assert.deepEqual(filterCanonicalTrainerRoster(roster, "attention", "").map((item) => item.displayName), ["Мария Волкова"]);
  assert.deepEqual(filterCanonicalTrainerRoster(roster, "on_track", "полное").map((item) => item.displayName), ["Артём Смирнов"]);
  assert.equal(filterCanonicalTrainerRoster(roster, "all", "козлова").length, 0);
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
