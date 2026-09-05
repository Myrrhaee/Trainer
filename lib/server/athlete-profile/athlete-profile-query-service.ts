import "server-only";

import type { Actor } from "@/lib/server/database/actor-context";
import { AthleteCapabilitiesService } from "@/lib/server/athlete-profile/athlete-capabilities-service";
import { AthleteCurrentStateProjector } from "@/lib/server/athlete-profile/athlete-current-state-projector";
import { AthleteProfileRepository } from "@/lib/server/athlete-profile/athlete-profile-repository";
import type {
  AthleteOverviewReadModel,
  AthleteProfileAttentionSnapshot,
  AthleteProfileEntryContext,
  AthleteProfileEntryInput,
  AthleteProfileFrameReadModel,
  AthleteProfileReadModel,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";
import { resolveTrainerAthletePrimaryAction } from "@/lib/trainer-athlete-primary-action";

export class AthleteProfileFrameQueryService {
  constructor(
    private readonly projector = new AthleteCurrentStateProjector(),
    private readonly capabilities = new AthleteCapabilitiesService(),
  ) {}

  project(
    snapshot: AthleteProfileSnapshot,
    entry: AthleteProfileEntryInput,
    attention: AthleteProfileAttentionSnapshot | null,
  ): AthleteProfileFrameReadModel {
    const currentState = this.projector.project(snapshot);
    const primary = this.capabilities.primaryAction(snapshot);
    return {
      identity: {
        athleteUserId: snapshot.athleteUserId,
        displayName: snapshot.displayName,
        initials: snapshot.initials,
        goal: snapshot.profile.goal,
      },
      relation: {
        id: snapshot.relationId,
        status: snapshot.relationStatus,
        acceptedAt: snapshot.acceptedAt,
      },
      currentState,
      entryContext: entryContext(entry, attention),
      availableActions: { primary },
      permissions: {
        canRead: true,
        canAssign: snapshot.relationStatus === "active" && snapshot.athleteStatus === "active",
        canReview: Boolean(primary?.kind === "review"),
        canEditAthleteFacts: false,
      },
    };
  }
}

export class AthleteOverviewQueryService {
  project(snapshot: AthleteProfileSnapshot): AthleteOverviewReadModel {
    const about = {
      biography: snapshot.profile.biography,
      trainingExperience: snapshot.profile.trainingExperience,
      athleteContext: snapshot.profile.athleteContext,
    };
    const trainingContext = {
      preferences: snapshot.profile.preferences,
      availableEquipment: snapshot.profile.availableEquipment,
      schedule: snapshot.profile.schedule,
      athleteReportedLimitations: snapshot.profile.athleteReportedLimitations,
    };
    return {
      about,
      trainingContext,
      recentWork: {
        currentAssignment: snapshot.currentAssignment,
        lastSession: snapshot.lastSession,
        lastFeedback: snapshot.lastFeedback,
        nextStep: nextStep(snapshot),
      },
      dataAvailability: {
        hasAbout: Boolean(about.biography || about.trainingExperience || about.athleteContext),
        hasTrainingContext: Boolean(
          trainingContext.preferences.length
          || trainingContext.availableEquipment.length
          || trainingContext.schedule
          || trainingContext.athleteReportedLimitations
        ),
        hasCompletedWork: Boolean(snapshot.lastSession),
      },
    };
  }
}

export class AthleteProfileQueryService {
  constructor(
    private readonly repository = new AthleteProfileRepository(),
    private readonly frame = new AthleteProfileFrameQueryService(),
    private readonly overview = new AthleteOverviewQueryService(),
  ) {}

  async find(
    actor: Actor,
    athleteUserId: string,
    entry: AthleteProfileEntryInput,
  ): Promise<AthleteProfileReadModel | null> {
    const snapshot = await this.repository.findSnapshot(actor, athleteUserId);
    if (!snapshot) return null;
    const attention = entry.attentionItem
      ? await this.repository.findAttention(actor, athleteUserId, entry.attentionItem)
      : null;
    return {
      frame: this.frame.project(snapshot, entry, attention),
      overview: this.overview.project(snapshot),
    };
  }
}

function nextStep(snapshot: AthleteProfileSnapshot) {
  const primary = resolveTrainerAthletePrimaryAction({
    relationStatus: snapshot.relationStatus,
    athleteStatus: snapshot.athleteStatus,
    currentAssignmentId: snapshot.currentAssignment?.id ?? null,
    openReview: snapshot.openAttention
      ? { sessionId: snapshot.openAttention.sessionId, attentionItemId: snapshot.openAttention.id }
      : null,
  });
  if (primary?.kind === "review") return "Разобрать завершённую тренировку";
  if (primary?.kind === "assign") return "Назначить следующую тренировку";
  if (snapshot.relationStatus !== "active" || snapshot.athleteStatus !== "active") {
    return "Дождаться возобновления связи";
  }
  if (snapshot.currentAssignment?.status === "in_progress") return "Дождаться завершения тренировки";
  return "Дождаться выполнения назначения";
}

function entryContext(
  input: AthleteProfileEntryInput,
  attention: AthleteProfileAttentionSnapshot | null,
): AthleteProfileEntryContext {
  const source = input.from === "dashboard" || input.from === "review" || input.from === "history"
    || input.from === "clients" ? input.from : "direct";
  const returns = {
    clients: { href: "/trainer/clients", label: "К спортсменам" },
    dashboard: { href: "/trainer/dashboard", label: "К главной" },
    review: { href: attention ? `/trainer/review/${attention.sessionId}` : "/trainer/attention", label: "К разбору" },
    history: { href: "/trainer/dashboard", label: "К журналу" },
    direct: { href: "/trainer/clients", label: "К спортсменам" },
  } as const;
  const target = returns[source];
  if (!attention) {
    return {
      mode: "neutral",
      source,
      returnHref: target.href,
      returnLabel: target.label,
      attention: null,
    };
  }
  const resolved = attention.status !== "open";
  return {
    mode: "attention",
    source,
    returnHref: target.href,
    returnLabel: target.label,
    attention: {
      id: attention.id,
      status: attention.status,
      sessionId: attention.sessionId,
      title: attention.title,
      reason: resolved
        ? "Эта задача уже закрыта"
        : attention.priorityReasons.includes("discomfort")
          ? "Спортсмен отметил дискомфорт"
          : "Тренировка ждёт разбора",
    },
  };
}
