import type {
  AthleteProfileAction,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";
import { resolveTrainerAthletePrimaryAction } from "@/lib/trainer-athlete-primary-action";

export class AthleteCapabilitiesService {
  primaryAction(
    snapshot: AthleteProfileSnapshot,
  ): AthleteProfileAction | null {
    const profileHref = `/trainer/clients/${snapshot.athleteUserId}?tab=overview`;
    const primary = resolveTrainerAthletePrimaryAction({
      relationStatus: snapshot.relationStatus,
      athleteStatus: snapshot.athleteStatus,
      currentAssignmentId: snapshot.currentAssignment?.id ?? null,
      openReview: snapshot.openAttention
        ? { sessionId: snapshot.openAttention.sessionId, attentionItemId: snapshot.openAttention.id }
        : null,
    });
    if (primary?.kind === "review") {
      const context = createTrainerWorkflowContext({
        origin: "profile",
        athleteUserId: snapshot.athleteUserId,
        sourceAttentionItemId: primary.attentionItemId ?? undefined,
        sourceSessionId: primary.sessionId,
        returnTo: profileHref,
        returnAnchor: "latest-feedback",
      });
      return {
        kind: "review",
        label: "Разобрать тренировку",
        href: trainerWorkflowHref(`/trainer/review/${primary.sessionId}`, context),
      };
    }

    if (primary?.kind === "assign") {
      const context = createTrainerWorkflowContext({
        origin: "profile",
        athleteUserId: snapshot.athleteUserId,
        returnTo: profileHref,
        returnAnchor: "next-assignment",
      });
      return {
        kind: "assign",
        label: "Назначить тренировку",
        href: trainerWorkflowHref(`/trainer/clients/${snapshot.athleteUserId}?tab=training&assign=1`, context),
      };
    }

    return null;
  }
}
