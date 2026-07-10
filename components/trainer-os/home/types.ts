import type { LucideIcon } from "lucide-react";

export type TeamClientState =
  | "on_track"
  | "no_next_workout"
  | "waiting_review"
  | "needs_adjustment"
  | "inactive";

export type TeamMapFilter = "all" | TeamClientState;

export type ActionType = "assign" | "review" | "open_client" | "message";

export type ProgressTrend = "up" | "flat" | "down";

export type TeamClient = {
  id: string;
  name: string;
  initials: string;
  goal: string;
  state: TeamClientState;
  stateLabel: string;
  progressTrend: ProgressTrend;
  isOnline: boolean;
  priority: "high" | "medium" | "low";
  lastActivity: string;
  nextWorkout?: string;
  issue?: string;
  context?: string;
  primaryAction?: ActionType;
};

export type TeamActivityType =
  | "completed_workout"
  | "personal_record"
  | "measurement_updated"
  | "check_in_submitted"
  | "workout_assigned"
  | "message_received"
  | "review_sent";

export type TeamActivityDateGroup = "today" | "yesterday" | "week";

export type TeamActivityItem = {
  id: string;
  clientId: string;
  clientName: string;
  type: TeamActivityType;
  title: string;
  description: string;
  time: string;
  clock: string;
  dateGroup: TeamActivityDateGroup;
  unread?: boolean;
};

export type SecondaryAttentionItem = {
  id: string;
  label: string;
  count: number;
  helper: string;
  icon: LucideIcon;
};

export type TeamSummary = {
  total: number;
  onTrack: number;
  needsAction: number;
  waitingReview: number;
  noNextWorkout: number;
  inactive: number;
};
