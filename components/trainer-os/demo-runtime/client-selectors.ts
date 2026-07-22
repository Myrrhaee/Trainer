import type {
  RuntimeTrainerFeedback,
  RuntimeWorkoutAssignment,
  RuntimeWorkoutSession,
  TrainerDemoState,
} from "./types";

export type ClientActorView = {
  id: string;
  displayName: string;
  initials: string;
  goal: string;
};

export type ClientHomeState = "assignment" | "in_progress" | "awaiting_feedback" | "feedback_received" | "empty";

export type ClientHomeView = {
  actor: ClientActorView;
  state: ClientHomeState;
  assignment: RuntimeWorkoutAssignment | null;
  session: RuntimeWorkoutSession | null;
  latestFeedback: RuntimeTrainerFeedback | null;
  primaryAction: { label: string; href: string } | null;
  progress: ClientProgressView;
};

export type ClientHistoryItem = {
  id: string;
  assignment: RuntimeWorkoutAssignment;
  session: RuntimeWorkoutSession | null;
  feedback: RuntimeTrainerFeedback[];
  state: "scheduled" | "in_progress" | "completed" | "completed_with_omissions" | "feedback_received";
};

export type ClientProgressView = {
  completedWorkoutCount: number;
  consistency: number;
  bestSet: { exercise: string; weightKg?: number; repetitions: number } | null;
  strengthTrend: Array<{ label: string; value: number }>;
  bodyweightTrend: Array<{ label: string; value: number }>;
};

export type ClientActivityItem = {
  id: string;
  label: string;
  detail: string;
  dateLabel: string;
};

export function getClientActor(state: TrainerDemoState, actorId: string): ClientActorView | null {
  const athlete = state.athletes.find((item) => item.id === actorId);
  const profile = state.athleteProfiles.find((item) => item.id === actorId);
  if (!athlete && !profile) return null;
  const displayName = athlete?.name ?? profile!.name;
  return {
    id: actorId,
    displayName,
    initials: athlete?.initials ?? displayName.split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join(""),
    goal: athlete?.goal ?? profile!.goal,
  };
}

export function getClientHomeView(state: TrainerDemoState, actorId: string): ClientHomeView | null {
  const actor = getClientActor(state, actorId);
  if (!actor) return null;
  const assignment = getLatestAssignment(state, actorId);
  const session = assignment
    ? state.workoutSessions.find((item) => item.assignmentEntityId === assignment.id) ?? null
    : null;
  const latestFeedback = session
    ? state.trainerFeedback.filter((item) => item.athleteId === actorId && item.workoutSessionId === session.session.id).at(-1) ?? null
    : null;
  const query = `actor=${encodeURIComponent(actorId)}`;
  const stateName: ClientHomeState = !assignment
    ? "empty"
    : !session
      ? "assignment"
      : session.lifecycleStatus === "active"
        ? "in_progress"
        : latestFeedback
          ? "feedback_received"
          : "awaiting_feedback";
  const primaryAction = stateName === "empty"
    ? null
    : stateName === "assignment"
      ? { label: "Начать тренировку", href: `/client/workouts?${query}&assignment=${assignment!.id}` }
      : stateName === "in_progress"
        ? { label: "Продолжить тренировку", href: `/client/workouts?${query}&session=${session!.session.id}` }
        : stateName === "feedback_received"
          ? { label: "Посмотреть отзыв тренера", href: `/client/workouts?${query}&session=${session!.session.id}&view=history` }
          : { label: "Посмотреть результат", href: `/client/workouts?${query}&session=${session!.session.id}&view=history` };
  return { actor, state: stateName, assignment, session, latestFeedback, primaryAction, progress: getClientProgressView(state, actorId)! };
}

export function getClientWorkoutView(state: TrainerDemoState, actorId: string, requestedAssignmentId?: string, requestedSessionId?: string) {
  const actor = getClientActor(state, actorId);
  if (!actor) return null;
  const session = requestedSessionId
    ? state.workoutSessions.find((item) => item.session.id === requestedSessionId && item.athlete.id === actorId) ?? null
    : null;
  if (requestedSessionId && !session) return { actor, assignment: null, session: null, feedback: [], notFound: "session" as const };
  const assignment = requestedAssignmentId
    ? state.workoutAssignments.find((item) => item.id === requestedAssignmentId && item.athleteId === actorId) ?? null
    : session?.assignmentEntityId
      ? state.workoutAssignments.find((item) => item.id === session.assignmentEntityId) ?? null
      : getLatestAssignment(state, actorId);
  if (requestedAssignmentId && !assignment) return { actor, assignment: null, session: null, feedback: [], notFound: "assignment" as const };
  const resolvedSession = session ?? (assignment
    ? state.workoutSessions.find((item) => item.assignmentEntityId === assignment.id) ?? null
    : null);
  return {
    actor,
    assignment,
    session: resolvedSession,
    feedback: resolvedSession
      ? state.trainerFeedback.filter((item) => item.athleteId === actorId && item.workoutSessionId === resolvedSession.session.id)
      : [],
    notFound: null,
  };
}

export function getClientHistoryView(state: TrainerDemoState, actorId: string): ClientHistoryItem[] | null {
  if (!getClientActor(state, actorId)) return null;
  return state.workoutAssignments
    .filter((item) => item.athleteId === actorId)
    .map((assignment) => {
      const session = state.workoutSessions.find((item) => item.assignmentEntityId === assignment.id) ?? null;
      const feedback = session ? state.trainerFeedback.filter((item) => item.workoutSessionId === session.session.id) : [];
      const itemState: ClientHistoryItem["state"] = !session
        ? "scheduled"
        : session.lifecycleStatus === "active"
          ? "in_progress"
          : feedback.length > 0
            ? "feedback_received"
            : session.lifecycleStatus;
      return { id: assignment.id, assignment, session, feedback, state: itemState };
    })
    .reverse();
}

export function getClientProgressView(state: TrainerDemoState, actorId: string): ClientProgressView | null {
  if (!getClientActor(state, actorId)) return null;
  const completed = state.workoutSessions.filter((item) => item.athlete.id === actorId && item.lifecycleStatus !== "active");
  const sets = completed.flatMap((session) => session.exerciseLogs.flatMap((exercise) => exercise.sets
    .filter((set) => set.completed && set.actualRepetitions !== undefined)
    .map((set) => ({ exercise: exercise.title, repetitions: set.actualRepetitions!, weightKg: set.actualWeightKg }))));
  const bestSet = sets.sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0) || b.repetitions - a.repetitions)[0] ?? null;
  return {
    completedWorkoutCount: completed.length,
    consistency: Math.min(100, completed.length * 20),
    bestSet,
    strengthTrend: sets.slice(-8).map((set, index) => ({ label: `${index + 1}`, value: set.weightKg ?? set.repetitions })),
    bodyweightTrend: [],
  };
}

export function getClientActivityView(state: TrainerDemoState, actorId: string): ClientActivityItem[] | null {
  if (!getClientActor(state, actorId)) return null;
  const items: ClientActivityItem[] = [];
  state.workoutAssignments.filter((assignment) => assignment.athleteId === actorId).forEach((assignment) => {
    items.push({
      id: `activity-assignment-${assignment.id}`,
      label: "Тренер назначил тренировку",
      detail: assignment.templateTitle,
      dateLabel: formatActivityDate(assignment.createdAt),
    });
    const session = state.workoutSessions.find((item) => item.assignmentEntityId === assignment.id);
    if (!session) return;
    if (session.startedAt) {
      items.push({
        id: `activity-started-${session.session.id}`,
        label: "Тренировка начата",
        detail: assignment.templateTitle,
        dateLabel: formatActivityDate(session.startedAt),
      });
    }
    if (session.lifecycleStatus !== "active") {
      items.push({
        id: `activity-completed-${session.session.id}`,
        label: "Тренировка завершена",
        detail: assignment.templateTitle,
        dateLabel: formatActivityDate(session.session.completedAt),
      });
    }
    state.trainerFeedback.filter((feedback) => feedback.workoutSessionId === session.session.id).forEach((feedback) => {
      items.push({
        id: `activity-feedback-${feedback.id}`,
        label: feedback.kind === "follow-up" ? "Получено уточнение тренера" : "Получен отзыв тренера",
        detail: assignment.templateTitle,
        dateLabel: feedback.sentAt,
      });
    });
  });
  return items.reverse();
}

function getLatestAssignment(state: TrainerDemoState, actorId: string) {
  return state.workoutAssignments.filter((item) => item.athleteId === actorId).at(-1) ?? null;
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}
