import assert from "node:assert/strict";
import test from "node:test";

import { AthleteCapabilitiesService } from "../../lib/server/athlete-profile/athlete-capabilities-service";
import { AthleteCurrentStateProjector } from "../../lib/server/athlete-profile/athlete-current-state-projector";
import {
  AthleteOverviewQueryService,
  AthleteProfileFrameQueryService,
} from "../../lib/server/athlete-profile/athlete-profile-query-service";
import type { AthleteProfileSnapshot } from "../../lib/server/athlete-profile/athlete-profile-types";

test("athlete profile current state follows the canonical priority order", () => {
  const projector = new AthleteCurrentStateProjector();
  const base = snapshot();

  assert.equal(projector.project({ ...base, relationStatus: "suspended" }).kind, "relation_unavailable");
  assert.equal(projector.project({
    ...base,
    openAttention: attention(["discomfort"]),
  }).kind, "discomfort");
  assert.equal(projector.project({
    ...base,
    openAttention: attention([]),
  }).kind, "review_required");
  assert.equal(projector.project(base).kind, "no_next_assignment");
  assert.equal(projector.project({
    ...base,
    currentAssignment: assignment("in_progress"),
  }).kind, "workout_active");
  assert.equal(projector.project({
    ...base,
    currentAssignment: assignment("scheduled"),
  }).kind, "assignment_ready");
});

test("athlete profile exposes only one state-dependent primary action", () => {
  const projector = new AthleteCurrentStateProjector();
  const capabilities = new AthleteCapabilitiesService();
  const base = snapshot();

  const noAssignment = projector.project(base);
  assert.equal(capabilities.primaryAction(base, noAssignment)?.kind, "assign");

  const reviewSnapshot = { ...base, openAttention: attention([]) };
  const review = projector.project(reviewSnapshot);
  assert.equal(capabilities.primaryAction(reviewSnapshot, review)?.kind, "review");

  const scheduledSnapshot = { ...base, currentAssignment: assignment("scheduled") };
  assert.equal(capabilities.primaryAction(
    scheduledSnapshot,
    projector.project(scheduledSnapshot),
  ), null);

  const suspended = { ...base, relationStatus: "suspended" as const };
  assert.equal(capabilities.primaryAction(suspended, projector.project(suspended)), null);
});

test("profile frame validates attention context and overview keeps local empty states", () => {
  const base = snapshot();
  const frame = new AthleteProfileFrameQueryService().project(
    { ...base, openAttention: attention([]) },
    { from: "dashboard", attentionItem: "attention-1" },
    {
      id: "attention-1",
      sessionId: "session-1",
      title: "Силовая база",
      status: "open",
      priorityReasons: [],
    },
  );
  const overview = new AthleteOverviewQueryService().project(base);

  assert.equal(frame.entryContext.mode, "attention");
  assert.equal(frame.entryContext.returnHref, "/trainer/dashboard");
  assert.equal(frame.entryContext.attention?.reason, "Тренировка ждёт разбора");
  assert.equal(frame.permissions.canEditAthleteFacts, false);
  assert.equal(overview.dataAvailability.hasAbout, false);
  assert.equal(overview.dataAvailability.hasTrainingContext, false);
  assert.equal(overview.recentWork.nextStep, "Назначить следующую тренировку");
});

function snapshot(): AthleteProfileSnapshot {
  return {
    athleteUserId: "athlete-1",
    displayName: "Анна Смирнова",
    initials: "АС",
    athleteStatus: "active",
    relationId: "relation-1",
    relationStatus: "active",
    acceptedAt: "2026-08-01T10:00:00.000Z",
    profile: {
      goal: null,
      biography: null,
      trainingExperience: null,
      athleteContext: null,
      preferences: [],
      availableEquipment: [],
      schedule: null,
      athleteReportedLimitations: null,
    },
    currentAssignment: null,
    lastSession: null,
    lastFeedback: null,
    openAttention: null,
  };
}

function assignment(status: "scheduled" | "in_progress") {
  return {
    id: "assignment-1",
    title: "Силовая база",
    scheduledFor: "2026-08-25",
    status,
    sessionId: status === "in_progress" ? "session-1" : null,
  };
}

function attention(priorityReasons: string[]) {
  return {
    id: "attention-1",
    sessionId: "session-1",
    title: "Силовая база",
    status: "open" as const,
    priorityReasons,
  };
}
