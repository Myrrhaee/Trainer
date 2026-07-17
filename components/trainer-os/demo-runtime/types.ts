import type { AthleteProfile } from "@/components/trainer-os/client-profile/types";
import type { TeamActivityItem, TeamClient } from "@/components/trainer-os/home/types";
import type {
  AssignmentReceipt,
  QuickAssignEntryContext,
  WorkoutTemplateExercise,
} from "@/components/trainer-os/quick-assign/quick-assign-model";
import type {
  TrainerFeedbackRecord,
  WorkoutReviewDetails,
} from "@/components/trainer-os/workout-review/review-model";
import type { WorkoutTemplateDraft } from "@/components/trainer-os/workout-template-builder/builder-model";

export const TRAINER_DEMO_ACTOR_ID = "trainer-alexey-romanov";

export type TrainerFlowSource =
  | "dashboard"
  | "clients"
  | "profile"
  | "review"
  | "quick-assign"
  | "builder"
  | "direct";

export type TrainerFlowContext = {
  source: TrainerFlowSource;
  athleteId?: string;
  attentionItemId?: string;
  workoutSessionId?: string;
  workoutTemplateId?: string;
  returnTo?: string;
};

export type TrainerDemoActor = {
  id: typeof TRAINER_DEMO_ACTOR_ID;
  role: "trainer";
};

export type RuntimeAttentionKind = "discomfort" | "review" | "assignment" | "missed_workout";
export type RuntimeAttentionStatus = "active" | "resolved";

export type RuntimeAttentionItem = {
  id: string;
  athleteId: string;
  kind: RuntimeAttentionKind;
  status: RuntimeAttentionStatus;
  eventLabel: string;
  happenedAt: string;
  reason: string;
  signal: string;
  originalText?: string;
  relatedSignals: string[];
  primaryAction: "review" | "assign" | "open_profile";
  workoutSessionId?: string;
  ageHours: number;
  visualPrototype?: boolean;
  resolvedAt?: string;
  resolutionId?: string;
};

export type RuntimeWorkoutTemplate = {
  draft: WorkoutTemplateDraft;
  createdForAthleteId?: string;
};

export type RuntimeWorkoutAssignment = {
  id: string;
  athleteId: string;
  sourceTemplateId: string;
  sourceTemplateRevision: number;
  sourceTemplateRevisionId: string;
  templateTitle: string;
  scheduledDate: string;
  status: "scheduled";
  snapshotExercises: Array<WorkoutTemplateExercise & { override?: AssignmentReceipt["snapshotExercises"][number]["override"] }>;
  overrideCount: number;
  trainerNote?: string;
  generalInstruction?: string;
  createdContext: QuickAssignEntryContext;
  createdAt: string;
};

export type RuntimeTrainerFeedback = TrainerFeedbackRecord & {
  athleteId: string;
  workoutSessionId: string;
  attentionItemId?: string;
  trainerId: string;
};

export type RuntimeManualResolution = {
  id: string;
  athleteId: string;
  attentionItemId: string;
  workoutSessionId?: string;
  reason: string;
  trainerId: string;
  resolvedAt: string;
};

export type TrainerPilotEventName =
  | "flow_started"
  | "attention_opened"
  | "profile_opened"
  | "review_opened"
  | "feedback_sent"
  | "quick_assign_opened"
  | "builder_opened"
  | "template_saved"
  | "template_published"
  | "assignment_created"
  | "attention_resolved"
  | "flow_completed"
  | "error_encountered";

export type TrainerPilotEvent = {
  id: string;
  name: TrainerPilotEventName;
  at: string;
  athleteId?: string;
  attentionItemId?: string;
  workoutSessionId?: string;
  workoutTemplateId?: string;
  assignmentId?: string;
  errorCode?: TrainerDemoCommandErrorCode;
};

export type TrainerDemoState = {
  athletes: TeamClient[];
  athleteProfiles: AthleteProfile[];
  workoutTemplates: RuntimeWorkoutTemplate[];
  workoutAssignments: RuntimeWorkoutAssignment[];
  workoutSessions: WorkoutReviewDetails[];
  attentionItems: RuntimeAttentionItem[];
  trainerFeedback: RuntimeTrainerFeedback[];
  manualResolutions: RuntimeManualResolution[];
  teamActivity: TeamActivityItem[];
  selectedAttentionItemId: string | null;
  pilotEvents: TrainerPilotEvent[];
};

export type TrainerDemoCommandErrorCode =
  | "UNAUTHORIZED_ACTOR"
  | "UNKNOWN_ATHLETE"
  | "UNKNOWN_SESSION"
  | "UNKNOWN_TEMPLATE"
  | "UNKNOWN_ATTENTION_ITEM"
  | "ATTENTION_ALREADY_RESOLVED"
  | "FEEDBACK_ALREADY_SENT"
  | "INVALID_FEEDBACK"
  | "INVALID_MANUAL_REASON"
  | "INVALID_TEMPLATE_STATE"
  | "ATHLETE_PAUSED"
  | "STALE_ATTENTION_ITEM"
  | "COMMAND_FAILED";

export type TrainerDemoCommandReceipt = {
  commandId: string;
  commandName: string;
  appliedAt: string;
  alreadyApplied: boolean;
  entityId: string;
  resolvedAttentionItemId?: string;
};

export type TrainerDemoCommandResult<TReceipt extends TrainerDemoCommandReceipt = TrainerDemoCommandReceipt> =
  | { ok: true; receipt: TReceipt }
  | { ok: false; error: { code: TrainerDemoCommandErrorCode; message: string } };

export type ResolveAttentionWithFeedbackInput = {
  actor: TrainerDemoActor;
  athleteId: string;
  workoutSessionId: string;
  attentionItemId?: string;
  feedback: TrainerFeedbackRecord;
};

export type ResolveAttentionManuallyInput = {
  actor: TrainerDemoActor;
  athleteId: string;
  attentionItemId: string;
  workoutSessionId?: string;
  reason: string;
};

export type CreateWorkoutAssignmentInput = {
  actor: TrainerDemoActor;
  receipt: AssignmentReceipt;
};

export type WorkoutTemplateCommandInput = {
  actor: TrainerDemoActor;
  template: WorkoutTemplateDraft;
  athleteId?: string;
};

export type CreateFollowUpFeedbackInput = {
  actor: TrainerDemoActor;
  athleteId: string;
  workoutSessionId: string;
  feedback: TrainerFeedbackRecord;
};

export type TrainerDemoCommands = {
  resolveAttentionItemWithFeedback: (
    input: ResolveAttentionWithFeedbackInput
  ) => TrainerDemoCommandResult;
  resolveAttentionItemWithAcknowledgement: (
    input: ResolveAttentionWithFeedbackInput
  ) => TrainerDemoCommandResult;
  resolveAttentionItemManually: (
    input: ResolveAttentionManuallyInput
  ) => TrainerDemoCommandResult;
  createWorkoutAssignment: (
    input: CreateWorkoutAssignmentInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { assignment: RuntimeWorkoutAssignment }>;
  saveWorkoutTemplateDraft: (
    input: WorkoutTemplateCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { template: WorkoutTemplateDraft }>;
  publishWorkoutTemplate: (
    input: WorkoutTemplateCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { template: WorkoutTemplateDraft }>;
  createWorkoutTemplateRevision: (
    input: WorkoutTemplateCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { template: WorkoutTemplateDraft }>;
  archiveWorkoutTemplatePrototype: (
    input: WorkoutTemplateCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { template: WorkoutTemplateDraft }>;
  createFollowUpFeedback: (
    input: CreateFollowUpFeedbackInput
  ) => TrainerDemoCommandResult;
  selectAttentionItem: (attentionItemId: string | null) => TrainerDemoCommandResult;
  recordPilotEvent: (event: Omit<TrainerPilotEvent, "id" | "at">) => void;
};

export type TrainerDemoRuntimeValue = {
  actor: TrainerDemoActor;
  state: TrainerDemoState;
  commands: TrainerDemoCommands;
};
