import "server-only";

import { NextResponse } from "next/server";

import { WorkoutBuilderCommandError } from "@/lib/server/workouts/workout-builder-repository";
import { WorkoutBuilderValidationError } from "@/lib/server/workouts/workout-builder-service";

export function workoutBuilderErrorResponse(error: unknown) {
  if (error instanceof WorkoutBuilderValidationError) {
    return NextResponse.json(
      { error: error.validationCode, issues: error.issues },
      { status: error.validationCode === "payload_too_large" ? 413 : 422 },
    );
  }
  if (error instanceof WorkoutBuilderCommandError) {
    const notFound = error.commandCode === "template_not_found"
      || error.commandCode === "source_exercise_forbidden";
    const validation = error.commandCode === "publication_validation_failed"
      || error.commandCode === "draft_validation_failed";
    return NextResponse.json(
      { error: error.commandCode, issues: error.issues },
      { status: notFound ? 404 : validation ? 422 : 409 },
    );
  }
  return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
}
