/**
 * Source-of-truth TypeScript contracts for the fitness coaching SaaS MVP.
 * Mirrors the PostgreSQL schema and JSONB contracts.
 */

// =============================================================================
// Enums / literal unions
// =============================================================================

export type UserRole = "trainer" | "client" | "admin";

export type ClientStatus = "active" | "inactive" | "paused";

export type WorkoutStatus = "pending" | "in_progress" | "completed" | "missed";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type TrainingTemplateKind = "single_workout" | "multi_day_program";

export type WorkoutSource =
  | "trainer_assignment"
  | "purchased_program"
  | "free_workout";

export type AssignmentStatus =
  | "scheduled"
  | "available"
  | "in_progress"
  | "completed"
  | "missed"
  | "skipped";

export type ReminderStatus = "pending" | "sent" | "dismissed" | "failed";

export type ReminderType =
  | "trainer_should_send_workout"
  | "client_changed_schedule"
  | "client_missed_workout"
  | "client_completed_workout";

export type ProgramVisibility = "private" | "public";

export type ProgramProductStatus = "draft" | "published" | "archived";

export type PurchaseStatus = "pending" | "paid" | "refunded" | "failed";

// =============================================================================
// Relational entities
// =============================================================================

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Trainer {
  id: string;
  user_id: string;
  display_name?: string | null;
  bio?: string | null;
  telegram_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  trainer_id: string | null;
  status: ClientStatus;
  current_streak: number;
  display_name?: string | null;
  goal?: string | null;
  current_weight?: number | null;
  target_weight?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  trainer_id: string | null;
  name: string;
  muscle_group: string | null;
  video_url: string | null;
  equipment: string | null;
  difficulty: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutTemplate {
  id: string;
  trainer_id: string;
  name: string;
  description?: string | null;
  kind: TrainingTemplateKind;
  visibility: ProgramVisibility;
  plan_data: WorkoutTemplatePlan;
  created_at: string;
  updated_at: string;
}

export interface AssignedProgram {
  id: string;
  template_id: string;
  client_id: string;
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutAssignment {
  id: string;
  client_id: string;
  trainer_id?: string | null;
  template_id?: string | null;
  assigned_program_id?: string | null;
  scheduled_date: string;
  scheduled_time?: string | null;
  status: AssignmentStatus;
  source: WorkoutSource;
  created_at: string;
  updated_at: string;
}

export interface Workout {
  id: string;
  client_id: string;
  assigned_program_id: string | null;
  assignment_id?: string | null;
  date: string;
  status: WorkoutStatus;
  source?: WorkoutSource;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLog {
  id: string;
  workout_id: string;
  log_data: WorkoutSessionPayload;
  created_at: string;
  updated_at: string;
}

export interface ProgressPhoto {
  id: string;
  client_id: string;
  date: string;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  trainer_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientTrainingPreference {
  id: string;
  client_id: string;
  weekday: number; // 0-6, where 0 = Sunday
  preferred_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface TrainerReminder {
  id: string;
  trainer_id: string;
  client_id: string;
  assignment_id: string | null;
  reminder_type: ReminderType;
  scheduled_for: string;
  status: ReminderStatus;
  created_at: string;
  updated_at: string;
}

export interface ProgramProduct {
  id: string;
  template_id: string;
  trainer_id: string;
  title: string;
  description: string | null;
  price_amount: number;
  currency: string;
  status: ProgramProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProgramPurchase {
  id: string;
  client_id: string;
  product_id: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  status: PurchaseStatus;
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// JSONB: workout_templates.plan_data
// =============================================================================

export interface WorkoutTemplateExerciseTarget {
  exercise_id: string;
  exercise_name?: string;
  target_sets?: number;
  target_reps?: number;
  target_weight?: number | null;
  target_rpe?: number | null;
  rest_time_seconds?: number | null;
  order_index?: number;
  notes?: string | null;
}

export interface WorkoutTemplateDay {
  day_index: number;
  label?: string;
  estimated_duration_minutes?: number | null;
  exercises: WorkoutTemplateExerciseTarget[];
}

export interface WorkoutTemplateWeek {
  week_index: number;
  label?: string;
  days: WorkoutTemplateDay[];
}

export interface WorkoutTemplatePlan {
  kind: TrainingTemplateKind;
  weeks: WorkoutTemplateWeek[];
}

// =============================================================================
// JSONB: workout_logs.log_data
// =============================================================================

export interface AssignedDayReference {
  source: WorkoutSource;
  assigned_program_id?: string | null;
  assignment_id?: string | null;
  template_id?: string | null;
  week_index?: number | null;
  day_index?: number | null;
}

export interface WorkoutSessionSet {
  set_index: number;
  target_weight?: number | null;
  target_reps?: number | null;
  target_rpe?: number | null;
  actual_weight?: number | null;
  actual_reps?: number | null;
  actual_rpe?: number | null;
  is_completed: boolean;
  notes?: string | null;
}

export interface WorkoutSessionExercise {
  exercise_id: string;
  exercise_name?: string | null;
  target_sets?: number | null;
  target_reps?: number | null;
  target_weight?: number | null;
  target_rpe?: number | null;
  rest_time_seconds?: number | null;
  sets: WorkoutSessionSet[];
  notes?: string | null;
}

export interface WorkoutSessionPayload {
  workout_date: string;
  source: WorkoutSource;
  is_free_workout: boolean;
  assigned_day_reference: AssignedDayReference;
  completed_exercises: WorkoutSessionExercise[];
  started_at?: string | null;
  completed_at?: string | null;
  notes?: string | null;
}

// =============================================================================
// UI helper types
// =============================================================================

export interface DashboardAchievement {
  id: string;
  title: string;
  description: string;
  status: "earned" | "locked";
  type: "streak" | "record" | "consistency" | "program";
}

export interface ClientDashboardMetric {
  id: string;
  label: string;
  value: string;
  description?: string;
  trend?: "up" | "down" | "neutral";
}

export interface ClientDashboardWorkoutItem {
  id: string;
  title: string;
  date_label: string;
  status: WorkoutStatus;
  source: WorkoutSource;
}