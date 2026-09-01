import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { projectAssignmentStateToken } from "./assignment-state-token";
import { QuickAssignRepository } from "./quick-assign-repository";
import type { QuickAssignFindInput, QuickAssignReadModel } from "./quick-assign-types";

export class QuickAssignQueryService {
  constructor(private readonly repository = new QuickAssignRepository()) {}

  async find(
    actor: Actor,
    athleteUserId: string,
    input: QuickAssignFindInput = {},
  ): Promise<QuickAssignReadModel | null> {
    const scope = await this.repository.findScope(actor, athleteUserId);
    if (!scope) return null;

    const canAssign = scope.relationStatus === "active" && scope.athleteStatus === "active";
    const blockedReason = scope.relationStatus !== "active"
      ? "relation_suspended" as const
      : scope.athleteStatus !== "active"
        ? "athlete_unavailable" as const
        : null;

    if (!canAssign) {
      const assignmentStateToken = projectAssignmentStateToken({
        trainerUserId: actor.userId,
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        assignments: [],
      });
      return {
        readAt: scope.readAt,
        athlete: {
          athleteUserId: scope.athleteUserId,
          relationId: scope.relationId,
          displayName: scope.displayName,
          initials: scope.initials,
          relationStatus: scope.relationStatus,
          athleteStatus: scope.athleteStatus,
          capabilities: {
            canAssign: false,
            canSearchTemplates: false,
            canOpenBuilder: true,
            blockedReason,
          },
          nextAssignment: null,
          upcomingAssignments: [],
          upcomingAssignmentCount: 0,
          assignmentStateToken,
        },
        calendar: calendar(scope.today, scope.tomorrow),
        templates: emptyTemplates(input.query),
        selectedTemplate: input.templateRevisionId ? { status: "unavailable" } : { status: "idle" },
        dataAvailability: {
          athlete: "ready",
          templates: "unavailable",
          preview: input.templateRevisionId ? "unavailable" : "idle",
        },
      };
    }

    const [templates, upcomingAssignments, selectedTemplate] = await Promise.all([
      this.repository.listTemplates(actor, scope, input),
      this.repository.findUpcoming(actor, scope),
      input.templateRevisionId
        ? this.repository.findPreview(actor, input.templateRevisionId)
        : Promise.resolve({ status: "idle" as const }),
    ]);
    const assignmentStateToken = projectAssignmentStateToken({
      trainerUserId: actor.userId,
      athleteUserId: scope.athleteUserId,
      relationId: scope.relationId,
      assignments: upcomingAssignments,
    });
    return {
      readAt: scope.readAt,
      athlete: {
        athleteUserId: scope.athleteUserId,
        relationId: scope.relationId,
        displayName: scope.displayName,
        initials: scope.initials,
        relationStatus: scope.relationStatus,
        athleteStatus: scope.athleteStatus,
        capabilities: {
          canAssign: true,
          canSearchTemplates: true,
          canOpenBuilder: true,
          blockedReason: null,
        },
        nextAssignment: upcomingAssignments[0] ?? null,
        upcomingAssignments,
        upcomingAssignmentCount: upcomingAssignments.length,
        assignmentStateToken,
      },
      calendar: calendar(scope.today, scope.tomorrow),
      templates,
      selectedTemplate,
      dataAvailability: {
        athlete: "ready",
        templates: "ready",
        preview: previewAvailability(selectedTemplate.status),
      },
    };
  }
}

function calendar(today: string, tomorrow: string): QuickAssignReadModel["calendar"] {
  return {
    today,
    tomorrow,
    minScheduledFor: today,
    selectedScheduledFor: null,
    timezone: null,
    timezoneAvailability: "unavailable",
    fallbackExplanation: "Дата сохраняется как календарная дата без привязки к часовому поясу",
  };
}

function emptyTemplates(query: string | undefined): QuickAssignReadModel["templates"] {
  return {
    items: [],
    pageInfo: { endCursor: null, hasNextPage: false },
    search: { query: (query ?? "").trim().toLocaleLowerCase("ru-RU").slice(0, 200), pageSize: 25 },
  };
}

function previewAvailability(status: QuickAssignReadModel["selectedTemplate"]["status"]) {
  if (status === "idle") return "idle" as const;
  if (status === "ready") return "ready" as const;
  if (status === "stale_revision" || status === "archived" || status === "draft") return "stale" as const;
  return "unavailable" as const;
}
