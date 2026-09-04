import { NextResponse } from "next/server";

import { AccessService } from "@/lib/server/access/access-service";
import { resolveRequestActor } from "@/lib/server/auth/actor";
import { ClientHistoryRepository } from "@/lib/server/client-workouts/client-history-repository";
import { ClientHistoryInputError } from "@/lib/server/client-workouts/client-history-cursor";
import { ClientCompletedRepository } from "@/lib/server/client-workouts/client-completed-repository";
import {
  ClientWorkoutInputError,
  ClientWorkoutQueryService,
  clientWorkoutId,
} from "@/lib/server/client-workouts/client-workout-query-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor();
    if (
      !actor ||
      (await new AccessService().context(actor)).athlete?.status !== "active"
    ) {
      return NextResponse.json(
        { error: "unauthorized" },
        { status: 401, headers },
      );
    }
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some(
        (key) =>
          query.getAll(key).length !== 1 ||
          ![
            "mode",
            "first",
            "start",
            "after",
            "assignmentId",
            "sessionId",
            "completionCommandId",
            "completionFingerprint",
          ].includes(key),
      )
    ) {
      return NextResponse.json(
        { error: "invalid_query" },
        { status: 400, headers },
      );
    }
    const mode = query.get("mode");
    if (mode === "history") {
      if (
        [...query.keys()].some(
          (key) => !["mode", "first", "start", "after"].includes(key),
        )
      )
        throw new ClientHistoryInputError("invalid_history_query");
      const history = await new ClientHistoryRepository().history(actor, {
        first: query.get("first") ?? undefined,
        start: query.get("start") ?? undefined,
        after: query.get("after") ?? undefined,
      });
      return NextResponse.json({ history }, { headers });
    }
    if (mode && !["presentation", "completed"].includes(mode))
      return NextResponse.json(
        { error: "invalid_query" },
        { status: 400, headers },
      );
    if (mode === "completed" && !query.has("sessionId"))
      throw new ClientHistoryInputError("invalid_query");
    if (
      mode &&
      (query.has("completionCommandId") || query.has("completionFingerprint"))
    )
      throw new ClientHistoryInputError("invalid_query");
    if (
      [...query.keys()].some((key) => ["first", "start", "after"].includes(key))
    )
      throw new ClientHistoryInputError("invalid_history_query");
    if (mode && query.has("sessionId")) {
      const completed = await new ClientCompletedRepository().find(
        actor,
        clientWorkoutId(query.get("sessionId")),
      );
      if (completed !== "active") {
        if (
          !completed ||
          (query.has("assignmentId") &&
            clientWorkoutId(query.get("assignmentId")) !==
              completed.assignmentId)
        )
          return NextResponse.json(
            { error: "workout_unavailable" },
            { status: 404, headers },
          );
        return NextResponse.json({ completed }, { headers });
      }
      if (mode === "completed")
        return NextResponse.json(
          { error: "workout_unavailable" },
          { status: 404, headers },
        );
    }
    const assignmentId = query.get("assignmentId") ?? undefined;
    const sessionId = query.get("sessionId") ?? undefined;
    const service = new ClientWorkoutQueryService();
    if (assignmentId !== undefined || sessionId !== undefined) {
      const execution = await service.execution(actor, {
        assignmentId,
        sessionId,
        completionCommandId: query.get("completionCommandId") ?? undefined,
        completionFingerprint: query.get("completionFingerprint") ?? undefined,
      });
      return execution
        ? NextResponse.json(
            { execution },
            { headers: { "Cache-Control": "no-store" } },
          )
        : NextResponse.json(
            { error: "workout_unavailable" },
            { status: 404, headers },
          );
    }
    const collection = await service.collection(actor);
    return NextResponse.json(
      { collection },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ClientHistoryInputError)
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof ClientWorkoutInputError) {
      return NextResponse.json(
        { error: "workout_unavailable" },
        { status: 404, headers },
      );
    }
    return NextResponse.json(
      { error: "temporarily_unavailable" },
      { status: 503, headers },
    );
  }
}
