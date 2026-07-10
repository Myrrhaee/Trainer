import type { LucideIcon } from "lucide-react";

export type TrainerClientStatus =
  | "on_track"
  | "needs_assignment"
  | "waiting_review"
  | "missed_workout"
  | "no_program"
  | "needs_correction";

export type TrainerClientPriority = "high" | "medium" | "low";

export type DashboardFilter =
  | "all"
  | "needs_action"
  | "needs_assignment"
  | "waiting_review"
  | "planned_today"
  | "on_track";

export type ClientPrimaryAction = "quick_assign" | "open_review" | "open_client" | "message";

export type WorkoutSnapshot = {
  name: string;
  meta: string;
  detail?: string;
};

export type TrainerOperatingClient = {
  id: string;
  name: string;
  initials: string;
  goal: string;
  todayState: string;
  nextWorkout: WorkoutSnapshot | null;
  lastWorkout: WorkoutSnapshot | null;
  status: TrainerClientStatus;
  priority: TrainerClientPriority;
  plannedToday: boolean;
  action: ClientPrimaryAction;
  actionLabel: string;
  secondaryLabel: string;
  secondaryHref: string;
  reviewHref?: string;
  messageHref?: string;
  reason: string;
  coachNote: string;
  recommendedTemplate?: string;
  rpe?: string;
};

export type WaitingReviewItem = {
  id: string;
  clientId: string;
  client: string;
  workout: string;
  completedAt: string;
  rpe: string;
  signal: string;
  href: string;
};

export type NeedAssignmentItem = {
  id: string;
  clientId: string;
  client: string;
  reason: string;
  recommendedTemplate: string;
};

export type RecentDoneItem = {
  id: string;
  time: string;
  label: string;
  detail: string;
};

export type SummaryMetric = {
  id: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: "neutral" | "lime" | "amber" | "red" | "cyan";
};

export type SecondaryCheckItem = {
  id: string;
  label: string;
  count: number;
  helper: string;
};
