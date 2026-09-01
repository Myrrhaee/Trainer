import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { AthleteTrainingProjector } from "./athlete-training-projector";
import { AthleteTrainingRepository } from "./athlete-training-repository";
import type {
  AthleteTrainingCurrentSnapshot,
  AthleteTrainingCurrentViewResult,
  AthleteTrainingHistoryInput,
  AthleteTrainingHistoryPage,
  AthleteTrainingReadModel,
  AthleteTrainingViewResult,
} from "./athlete-training-types";

const EMPTY_CURRENT: Omit<AthleteTrainingCurrentSnapshot, "readAt"> = {
  trainingAvailable: false,
  pendingReviews: [],
  activeExecutions: [],
  nextAssignment: null,
  upcomingAssignmentCount: 0,
  latestFeedback: null,
};

export class AthleteTrainingQueryService {
  constructor(
    private readonly repository = new AthleteTrainingRepository(),
    private readonly projector = new AthleteTrainingProjector(),
  ) {}

  async find(
    actor: Actor,
    athleteUserId: string,
    history: AthleteTrainingHistoryInput = {},
  ): Promise<AthleteTrainingReadModel | null> {
    const scope = await this.repository.findScope(actor, athleteUserId);
    if (!scope) return null;

    const permissions = this.projector.permissions(scope);
    if (!permissions.canReadTraining) return this.unavailable(scope);

    const [snapshot, historyPage] = await Promise.all([
      this.repository.findCurrent(actor, scope),
      this.repository.findHistory(actor, scope, history),
    ]);
    if (!snapshot.trainingAvailable) {
      const refreshedScope = await this.repository.findScope(actor, athleteUserId);
      return refreshedScope ? this.unavailable(refreshedScope) : null;
    }
    const current = this.projector.current(scope, snapshot, permissions);
    const anomalies: AthleteTrainingReadModel["dataAvailability"]["anomalies"] = [];
    if (current.activeExecution.conflict) anomalies.push(current.activeExecution.conflict);
    if (current.pendingReviews.items.some((item) => item.sourceAvailability === "unavailable")) {
      anomalies.push("source_unavailable");
    }
    return {
      scope: {
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        relationStatus: scope.relationStatus,
        readAt: snapshot.readAt,
      },
      relation: { status: scope.relationStatus, capabilities: permissions },
      current,
      history: historyPage,
      dataAvailability: {
        hasCurrentWork: Boolean(
          current.pendingReviews.totalCount
          || current.activeExecution.totalCount
          || current.nextAssignment.totalCount,
        ),
        hasHistory: historyPage.items.length > 0,
        currentStatus: "ready",
        historyStatus: "ready",
        anomalies,
      },
    };
  }

  async findView(
    actor: Actor,
    athleteUserId: string,
    history: AthleteTrainingHistoryInput = {},
  ): Promise<AthleteTrainingViewResult | null> {
    const scope = await this.repository.findScope(actor, athleteUserId);
    if (!scope) return null;
    const permissions = this.projector.permissions(scope);
    const readAt = new Date().toISOString();
    const base = {
      scope: {
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        relationStatus: scope.relationStatus,
        readAt,
      },
      relation: { status: scope.relationStatus, capabilities: permissions },
    };
    if (!permissions.canReadTraining) {
      return {
        ...base,
        current: { status: "unavailable" },
        feedback: { status: "unavailable" },
        history: { status: "unavailable" },
      };
    }

    const [currentResult, feedbackResult, historyResult] = await Promise.allSettled([
      this.repository.findCurrent(actor, scope),
      this.repository.findLatestFeedback(actor, scope),
      this.repository.findHistory(actor, scope, history),
    ]);
    if (currentResult.status === "fulfilled" && !currentResult.value.trainingAvailable) {
      const refreshedScope = await this.repository.findScope(actor, athleteUserId);
      if (!refreshedScope) return null;
      const refreshedPermissions = this.projector.permissions(refreshedScope);
      return {
        scope: {
          athleteUserId: refreshedScope.athleteUserId,
          relationId: refreshedScope.relationId,
          relationStatus: refreshedScope.relationStatus,
          readAt: new Date().toISOString(),
        },
        relation: { status: refreshedScope.relationStatus, capabilities: refreshedPermissions },
        current: { status: "unavailable" },
        feedback: { status: "unavailable" },
        history: { status: "unavailable" },
      };
    }

    const current = currentResult.status === "fulfilled"
      ? { status: "ready" as const, value: this.projector.current(scope, currentResult.value, permissions) }
      : { status: "error" as const };
    const page = historyResult.status === "fulfilled"
      ? { status: "ready" as const, value: historyResult.value }
      : { status: "error" as const };
    return {
      ...base,
      scope: { ...base.scope, readAt: currentResult.status === "fulfilled" ? currentResult.value.readAt : readAt },
      current,
      feedback: feedbackResult.status === "fulfilled"
        ? { status: "ready", value: feedbackResult.value }
        : { status: "error" },
      history: page,
    };
  }

  async findCurrentView(
    actor: Actor,
    athleteUserId: string,
  ): Promise<AthleteTrainingCurrentViewResult | null> {
    const scope = await this.repository.findScope(actor, athleteUserId);
    if (!scope) return null;
    const permissions = this.projector.permissions(scope);
    const readAt = new Date().toISOString();
    const base = {
      scope: {
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        relationStatus: scope.relationStatus,
        readAt,
      },
      relation: { status: scope.relationStatus, capabilities: permissions },
    };
    if (!permissions.canReadTraining) {
      return {
        ...base,
        current: { status: "unavailable" },
        feedback: { status: "unavailable" },
      };
    }

    const [currentResult, feedbackResult] = await Promise.allSettled([
      this.repository.findCurrent(actor, scope),
      this.repository.findLatestFeedback(actor, scope),
    ]);
    if (currentResult.status === "fulfilled" && !currentResult.value.trainingAvailable) {
      const refreshedScope = await this.repository.findScope(actor, athleteUserId);
      if (!refreshedScope) return null;
      const refreshedPermissions = this.projector.permissions(refreshedScope);
      return {
        scope: {
          athleteUserId: refreshedScope.athleteUserId,
          relationId: refreshedScope.relationId,
          relationStatus: refreshedScope.relationStatus,
          readAt: new Date().toISOString(),
        },
        relation: { status: refreshedScope.relationStatus, capabilities: refreshedPermissions },
        current: { status: "unavailable" },
        feedback: { status: "unavailable" },
      };
    }

    return {
      ...base,
      scope: { ...base.scope, readAt: currentResult.status === "fulfilled" ? currentResult.value.readAt : readAt },
      current: currentResult.status === "fulfilled"
        ? { status: "ready", value: this.projector.current(scope, currentResult.value, permissions) }
        : { status: "error" },
      feedback: feedbackResult.status === "fulfilled"
        ? { status: "ready", value: feedbackResult.value }
        : { status: "error" },
    };
  }

  async findHistoryPage(
    actor: Actor,
    athleteUserId: string,
    history: AthleteTrainingHistoryInput = {},
  ): Promise<{ status: "ready" | "unavailable"; page: AthleteTrainingHistoryPage } | null> {
    const scope = await this.repository.findScope(actor, athleteUserId);
    if (!scope) return null;
    if (!this.projector.permissions(scope).canReadTraining) {
      return { status: "unavailable", page: emptyHistoryPage() };
    }
    const page = await this.repository.findHistory(actor, scope, history);
    const refreshedScope = await this.repository.findScope(actor, athleteUserId);
    if (!refreshedScope || !this.projector.permissions(refreshedScope).canReadTraining) {
      return { status: "unavailable", page: emptyHistoryPage() };
    }
    return { status: "ready", page };
  }

  private unavailable(
    scope: NonNullable<Awaited<ReturnType<AthleteTrainingRepository["findScope"]>>>,
  ): AthleteTrainingReadModel {
    const readAt = new Date().toISOString();
    const permissions = this.projector.permissions(scope);
    const current = this.projector.current(scope, { ...EMPTY_CURRENT, readAt }, permissions);
    return {
      scope: {
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        relationStatus: scope.relationStatus,
        readAt,
      },
      relation: { status: scope.relationStatus, capabilities: permissions },
      current,
      history: { items: [], pageInfo: { endCursor: null, hasNextPage: false } },
      dataAvailability: {
        hasCurrentWork: false,
        hasHistory: false,
        currentStatus: "unavailable",
        historyStatus: "unavailable",
        anomalies: [],
      },
    };
  }
}

function emptyHistoryPage(): AthleteTrainingHistoryPage {
  return { items: [], pageInfo: { endCursor: null, hasNextPage: false } };
}
