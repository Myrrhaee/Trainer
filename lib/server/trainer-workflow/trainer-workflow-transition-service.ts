import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import type { ReviewReadModel } from "@/lib/server/reviews/review-types";
import { TrainerDashboardRepository } from "@/lib/server/trainer-dashboard/trainer-dashboard-repository";
import type { WorkoutAssignment } from "@/lib/server/workouts/workout-types";
import {
  createTrainerWorkflowContext,
  safeTrainerWorkflowDestination,
  trainerWorkflowHref,
  type TrainerWorkflowContext,
  type TrainerWorkflowNextItem,
  type TrainerWorkflowTransition,
} from "@/lib/trainer-workflow-transition";
import { quickAssignHref } from "@/lib/quick-assign-navigation";

type ReviewResult = {
  kind: "review" | "manual_resolution" | "current";
  entityId: string;
  title: string;
  detail: string;
  resolutionState?: "resolved" | "already_resolved";
};

export class TrainerWorkflowTransitionService {
  constructor(private readonly dashboard = new TrainerDashboardRepository()) {}

  async forReview(
    actor: Actor,
    review: ReviewReadModel,
    requested: TrainerWorkflowContext | null,
    result: ReviewResult,
  ): Promise<TrainerWorkflowTransition> {
    const context = validatedReviewContext(requested, review);
    const destination = await this.destinations(actor, context, review.attention.id);
    const profileHref = withReceipt(
      `/trainer/clients/${review.athlete.id}?tab=training`,
      result.kind === "review" ? "review" : result.kind === "manual_resolution" ? "manual-resolution" : "review-current",
      result.entityId,
      result.kind === "review" ? "latest-feedback" : "workflow-receipt",
      context,
    );
    const returnHref = context.origin === "dashboard" && context.returnTo
      ? withReceipt(context.returnTo, "review", result.entityId, "workflow-receipt", context)
      : profileHref;
    return {
      context,
      profileHref,
      queueHref: destination.queueHref,
      returnHref,
      nextItem: destination.nextItem,
      allCalm: destination.allCalm,
      result: {
        ...result,
        athleteUserId: review.athlete.id,
        sessionId: review.session.id,
      },
    };
  }

  async forAssignment(
    actor: Actor,
    assignment: WorkoutAssignment,
    requested: TrainerWorkflowContext | null,
  ): Promise<TrainerWorkflowTransition> {
    const context = validatedAssignmentContext(requested, assignment.athleteUserId);
    const destination = await this.destinations(actor, context);
    const profileHref = withReceipt(
      `/trainer/clients/${assignment.athleteUserId}?tab=training`,
      "assignment",
      assignment.id,
      "next-assignment",
      context,
    );
    const returnHref = (context.origin === "dashboard" || context.origin === "clients") && context.returnTo
      ? withReceipt(context.returnTo, "assignment", assignment.id, context.origin === "clients" ? "row" : "workflow-receipt", context)
      : profileHref;
    return {
      context,
      profileHref,
      queueHref: destination.queueHref,
      returnHref,
      nextItem: destination.nextItem,
      allCalm: destination.allCalm,
      result: {
        kind: "assignment",
        entityId: assignment.id,
        athleteUserId: assignment.athleteUserId,
        title: assignment.title,
        detail: `Назначено на ${assignment.scheduledFor}`,
        resolutionState: "not_applicable",
      },
    };
  }

  private async destinations(actor: Actor, context: TrainerWorkflowContext, excludeAttentionItemId?: string) {
    const fallbackQueueHref = queueHref(context);
    let snapshot;
    try {
      snapshot = await this.dashboard.snapshot(actor);
    } catch {
      return { nextItem: null, queueHref: fallbackQueueHref, allCalm: false };
    }
    const reviewedAthletes = new Set(snapshot.reviews.map((item) => item.athleteUserId));
    const reviews = snapshot.reviews
      .filter((item) => item.id !== excludeAttentionItemId)
      .map((item) => ({
        kind: "review" as const,
        athleteUserId: item.athleteUserId,
        athleteDisplayName: item.athleteDisplayName,
        attentionItemId: item.id,
        sessionId: item.sessionId,
      }));
    const assignments = snapshot.athletes
      .filter((athlete) => !athlete.nextAssignment && !reviewedAthletes.has(athlete.athleteUserId))
      .map((athlete) => ({
        kind: "assignment" as const,
        athleteUserId: athlete.athleteUserId,
        athleteDisplayName: athlete.displayName,
      }));
    const filter = context.queue?.filter ?? "all";
    const candidates = filter === "review" ? reviews : filter === "assignment" ? assignments : [...reviews, ...assignments];
    const selected = candidates[0];
    let nextItem: TrainerWorkflowNextItem | null = null;
    if (selected?.kind === "review") {
      const nextContext = createTrainerWorkflowContext({
        origin: "dashboard",
        athleteUserId: selected.athleteUserId,
        sourceAttentionItemId: selected.attentionItemId,
        sourceSessionId: selected.sessionId,
        queue: context.queue ?? { filter: "all", order: "priority" },
        returnTo: queueHref(context),
        returnAnchor: "workflow-receipt",
      });
      nextItem = {
        kind: "review",
        athleteUserId: selected.athleteUserId,
        athleteDisplayName: selected.athleteDisplayName,
        href: trainerWorkflowHref(`/trainer/review/${selected.sessionId}`, nextContext),
      };
    } else if (selected) {
      const nextContext = createTrainerWorkflowContext({
        origin: "dashboard",
        athleteUserId: selected.athleteUserId,
        queue: context.queue ?? { filter: "all", order: "priority" },
        returnTo: queueHref(context),
        returnAnchor: "workflow-receipt",
      });
      nextItem = {
        kind: "assignment",
        athleteUserId: selected.athleteUserId,
        athleteDisplayName: selected.athleteDisplayName,
        href: quickAssignHref({ athleteUserId: selected.athleteUserId, context: nextContext }),
      };
    }
    return { nextItem, queueHref: fallbackQueueHref, allCalm: candidates.length === 0 };
  }
}

function validatedReviewContext(requested: TrainerWorkflowContext | null, review: ReviewReadModel) {
  if (!requested
    || (requested.athleteUserId && requested.athleteUserId !== review.athlete.id)
    || (requested.sourceSessionId && requested.sourceSessionId !== review.session.id)
    || (requested.sourceAttentionItemId && requested.sourceAttentionItemId !== review.attention.id)) {
    return createTrainerWorkflowContext({ origin: "direct", athleteUserId: review.athlete.id, sourceSessionId: review.session.id });
  }
  return createTrainerWorkflowContext({
    ...requested,
    athleteUserId: review.athlete.id,
    sourceSessionId: review.session.id,
    sourceAttentionItemId: review.attention.id,
  });
}

function validatedAssignmentContext(requested: TrainerWorkflowContext | null, athleteUserId: string) {
  if (!requested || (requested.athleteUserId && requested.athleteUserId !== athleteUserId)) {
    return createTrainerWorkflowContext({ origin: "direct", athleteUserId });
  }
  return createTrainerWorkflowContext({ ...requested, athleteUserId, sourceSessionId: undefined, sourceAttentionItemId: undefined });
}

function queueHref(context: TrainerWorkflowContext) {
  const url = new URL(context.returnTo && /^\/trainer\/(dashboard|attention)/.test(context.returnTo)
    ? context.returnTo
    : "/trainer/dashboard", "http://trainer.local");
  const queue = context.queue ?? { filter: "all" as const, order: "priority" as const };
  url.searchParams.set("filter", queue.filter);
  url.searchParams.set("order", queue.order);
  if (queue.position !== undefined) url.searchParams.set("position", String(queue.position));
  url.searchParams.set("focus", "queue");
  return safeTrainerWorkflowDestination(`${url.pathname}${url.search}`) ?? "/trainer/dashboard";
}

function withReceipt(
  destination: string,
  receipt: string,
  receiptId: string,
  focus: string,
  context: TrainerWorkflowContext,
) {
  const safe = safeTrainerWorkflowDestination(destination) ?? `/trainer/clients/${context.athleteUserId}?tab=training`;
  const url = new URL(safe, "http://trainer.local");
  url.searchParams.set("receipt", receipt);
  url.searchParams.set("receiptId", receiptId);
  url.searchParams.set("focus", focus);
  if (/^\/trainer\/clients\/[0-9a-f-]{36}$/i.test(url.pathname)) {
    if (context.origin !== "direct") url.searchParams.set("from", context.origin);
    if (context.sourceAttentionItemId) url.searchParams.set("attentionItem", context.sourceAttentionItemId);
  }
  return `${url.pathname}${url.search}`;
}
