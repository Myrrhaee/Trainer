import type {
  AthleteProfileAction,
  AthleteProfileCurrentState,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";
import { createTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

export class AthleteCapabilitiesService {
  primaryAction(
    snapshot: AthleteProfileSnapshot,
    state: AthleteProfileCurrentState,
  ): AthleteProfileAction | null {
    if (snapshot.relationStatus !== "active" || snapshot.athleteStatus !== "active") return null;

    const profileHref = `/trainer/clients/${snapshot.athleteUserId}?tab=overview`;
    if ((state.kind === "discomfort" || state.kind === "review_required") && state.sessionId) {
      const context = createTrainerWorkflowContext({
        origin: "profile",
        athleteUserId: snapshot.athleteUserId,
        sourceAttentionItemId: state.attentionItemId ?? undefined,
        sourceSessionId: state.sessionId,
        returnTo: profileHref,
        returnAnchor: "latest-feedback",
      });
      return {
        kind: "review",
        label: "Разобрать тренировку",
        href: trainerWorkflowHref(`/trainer/review/${state.sessionId}`, context),
      };
    }

    if (state.kind === "no_next_assignment") {
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
