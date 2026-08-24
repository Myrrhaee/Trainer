import type { TrainerReviewQueueItem } from "@/lib/server/reviews/review-types";

export type TrainerDashboardAthlete = {
  relationId: string;
  athleteUserId: string;
  displayName: string;
  initials: string;
  acceptedAt: string;
  latestActivityAt: string;
  nextAssignment: {
    id: string;
    title: string;
    scheduledFor: string;
    sessionId: string | null;
    status: "scheduled" | "in_progress";
  } | null;
};

export type TrainerDashboardActivity = {
  id: string;
  athleteUserId: string;
  athleteDisplayName: string;
  kind: "workout_assigned" | "workout_completed" | "feedback_sent";
  title: string;
  detail: string;
  occurredAt: string;
  sessionId: string | null;
};

export type TrainerDashboardSnapshot = {
  athletes: TrainerDashboardAthlete[];
  reviews: TrainerReviewQueueItem[];
  activities: TrainerDashboardActivity[];
};
