import type { AthleteProfile } from "@/components/trainer-os/client-profile/types";
import type { TeamActivityItem, TeamClient } from "@/components/trainer-os/home/types";
import type {
  AssignmentReceipt,
  QuickAssignEntryContext,
  WorkoutTemplateExercise,
} from "@/components/trainer-os/quick-assign/quick-assign-model";
import type {
  ReviewSetPlan,
  TrainerFeedbackRecord,
  WorkoutReviewDetails,
} from "@/components/trainer-os/workout-review/review-model";
import type { WorkoutTemplateDraft } from "@/components/trainer-os/workout-template-builder/builder-model";

export const TRAINER_DEMO_ACTOR_ID = "trainer-alexey-romanov";

export type DemoFixtureId =
  | "review-required"
  | "discomfort"
  | "needs-assignment"
  | "no-suitable-template"
  | "calm-team"
  | "client-execution";

export type DemoBuildMetadata = {
  label: "trainer-core-pilot-v1";
  stage: "Stage 14";
  commit: string;
};

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

export type ClientDemoActor = {
  id: string;
  role: "client";
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
  snapshotExercises: Array<WorkoutTemplateExercise & {
    assignmentExerciseId: string;
    supersetId?: string;
    supersetLabel?: string;
    supersetInstruction?: string;
    supersetOrder?: number;
    setPlans: ReviewSetPlan[];
    override?: AssignmentReceipt["snapshotExercises"][number]["override"];
  }>;
  overrideCount: number;
  trainerNote?: string;
  generalInstruction?: string;
  createdContext: QuickAssignEntryContext;
  createdAt: string;
};

export type RuntimeSetLog = {
  id: string;
  workoutSessionId: string;
  assignmentExerciseId: string;
  order: number;
  kind: "warmup" | "working";
  plan: ReviewSetPlan;
  actualRepetitions?: number;
  actualWeightKg?: number;
  rpe?: number;
  completed: boolean;
  comment?: string;
};

export type RuntimeExerciseLog = {
  id: string;
  workoutSessionId: string;
  assignmentExerciseId: string;
  exerciseId: string;
  title: string;
  order: number;
  supersetId?: string;
  supersetLabel?: string;
  supersetInstruction?: string;
  supersetOrder?: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  skipReason?: string;
  clientComment?: string;
  sets: RuntimeSetLog[];
};

export type RuntimeDiscomfortSignal = {
  originalText: string;
  area?: string;
  severity?: "low" | "medium" | "high";
};

export type RuntimeWorkoutSession = WorkoutReviewDetails & {
  assignmentEntityId?: string;
  lifecycleStatus: "active" | "completed" | "completed_with_omissions";
  startedAt?: string;
  exerciseLogs: RuntimeExerciseLog[];
  discomfort?: RuntimeDiscomfortSignal;
  completionReceiptId?: string;
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
  | "error_encountered"
  | "client_assignment_viewed"
  | "session_started"
  | "session_resumed"
  | "set_saved"
  | "exercise_skipped"
  | "client_comment_saved"
  | "discomfort_added"
  | "session_completed"
  | "review_item_created"
  | "feedback_viewed"
  | "command_failed";

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
  workoutSessions: RuntimeWorkoutSession[];
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
  | "COMMAND_FAILED"
  | "UNKNOWN_ASSIGNMENT"
  | "UNKNOWN_EXERCISE_LOG"
  | "UNKNOWN_SET_LOG"
  | "SESSION_ALREADY_COMPLETED"
  | "INVALID_SET_RESULT"
  | "INVALID_DISCOMFORT"
  | "ACTOR_ATHLETE_MISMATCH";

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

export type ClientAssignmentCommandInput = {
  actor: ClientDemoActor;
  assignmentId: string;
};

export type ClientSessionCommandInput = {
  actor: ClientDemoActor;
  workoutSessionId: string;
};

export type SaveSetLogInput = ClientSessionCommandInput & {
  setLogId: string;
  repetitions: number;
  weightKg?: number;
  rpe?: number;
  comment?: string;
};

export type SkipExerciseInput = ClientSessionCommandInput & {
  exerciseLogId: string;
  reason?: string;
};

export type SaveClientSessionCommentInput = ClientSessionCommandInput & {
  comment: string;
};

export type SetDiscomfortSignalInput = ClientSessionCommandInput & {
  originalText: string;
  area?: string;
  severity?: "low" | "medium" | "high";
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
  startWorkoutSession: (
    input: ClientAssignmentCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { session: RuntimeWorkoutSession }>;
  resumeWorkoutSession: (
    input: ClientSessionCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { session: RuntimeWorkoutSession }>;
  saveSetLog: (input: SaveSetLogInput) => TrainerDemoCommandResult;
  updateSetLog: (input: SaveSetLogInput) => TrainerDemoCommandResult;
  skipExercise: (input: SkipExerciseInput) => TrainerDemoCommandResult;
  saveClientSessionComment: (input: SaveClientSessionCommentInput) => TrainerDemoCommandResult;
  setDiscomfortSignal: (input: SetDiscomfortSignalInput) => TrainerDemoCommandResult;
  completeWorkoutSession: (
    input: ClientSessionCommandInput
  ) => TrainerDemoCommandResult<TrainerDemoCommandReceipt & { attentionItemId: string; session: RuntimeWorkoutSession }>;
  selectAttentionItem: (attentionItemId: string | null) => TrainerDemoCommandResult;
  recordPilotEvent: (event: Omit<TrainerPilotEvent, "id" | "at">) => void;
};

export type TrainerDemoRuntimeValue = {
  actor: TrainerDemoActor;
  state: TrainerDemoState;
  commands: TrainerDemoCommands;
  research: {
    ready: boolean;
    enabled: boolean;
    fixtureId: DemoFixtureId | null;
    isDirty: boolean;
    revision: number;
    build: DemoBuildMetadata;
    loadFixture: (fixtureId: DemoFixtureId) => void;
    resetFixture: (fixtureId?: DemoFixtureId) => void;
    clearTransientState: () => void;
  };
};
