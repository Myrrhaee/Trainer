import type {
  AthleteProfileAction,
  AthleteProfileCurrentState,
  AthleteProfileSnapshot,
} from "@/lib/server/athlete-profile/athlete-profile-types";

export class AthleteCapabilitiesService {
  primaryAction(
    snapshot: AthleteProfileSnapshot,
    state: AthleteProfileCurrentState,
  ): AthleteProfileAction | null {
    if (snapshot.relationStatus !== "active" || snapshot.athleteStatus !== "active") return null;

    const profileHref = `/trainer/clients/${snapshot.athleteUserId}?tab=overview`;
    if ((state.kind === "discomfort" || state.kind === "review_required") && state.sessionId) {
      const params = new URLSearchParams({ from: "profile", returnTo: profileHref });
      if (state.attentionItemId) params.set("attentionItem", state.attentionItemId);
      return {
        kind: "review",
        label: "Разобрать тренировку",
        href: `/trainer/review/${state.sessionId}?${params.toString()}`,
      };
    }

    if (state.kind === "no_next_assignment") {
      const params = new URLSearchParams({
        athleteId: snapshot.athleteUserId,
        from: "quick-assign",
        returnTo: profileHref,
      });
      return {
        kind: "assign",
        label: "Назначить тренировку",
        href: `/trainer/builder?${params.toString()}`,
      };
    }

    return null;
  }
}
