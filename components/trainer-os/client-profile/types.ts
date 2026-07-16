import type { LucideIcon } from "lucide-react";

export type AthleteTone = "good" | "warning" | "risk" | "muted";

export type AthleteWorkout = {
  id: string;
  title: string;
  date: string;
  meta: string;
  status: string;
  tone: AthleteTone;
};

export type AthleteLoad = {
  exercise: string;
  last: string;
  best: string;
  trend: string;
  tone: AthleteTone;
};

export type AthleteMeasurement = {
  label: string;
  value: string;
  delta: string;
};

export type AthleteTimelineItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  icon: LucideIcon;
  tone: AthleteTone;
};

export type AthleteEquipmentItem = {
  id: string;
  label: string;
  availability: "available" | "limited" | "missing";
};

export type AthleteLimitation = {
  id: string;
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

export type AthleteProgramSnapshot = {
  id: string;
  name: string;
  phase: string;
  week: number;
  totalWeeks: number;
  startedAt: string;
  endsAt: string;
  status: "active" | "needs_update" | "paused" | "completed";
};

export type AthleteAdherence = {
  workouts: number;
  checkIns: number;
  measurements: number;
  overall: number;
  label: string;
};

export type AthleteMembershipSource = "invite" | "manual" | "program_purchase";

export type AthleteSubscriptionStatus = "active" | "trial" | "ending" | "expired" | "paused";

export type AthleteAccessStatus = "enabled" | "limited" | "disabled";

export type AthleteMembership = {
  status: AthleteSubscriptionStatus;
  source: AthleteMembershipSource;
  purchaseName: string;
  purchaseDate: string;
  subscriptionEndDate: string;
  accessStatus: AthleteAccessStatus;
  addedAt: string;
};

export type AthleteCoachNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  pinned?: boolean;
};

export type AthleteCalendarEventType =
  | "workout"
  | "missed_workout"
  | "check_in"
  | "measurements"
  | "review"
  | "subscription";

export type AthleteCalendarEvent = {
  id: string;
  type: AthleteCalendarEventType;
  title: string;
  date: string;
  time?: string;
  status: "planned" | "done" | "missed" | "waiting" | "risk";
  detail: string;
};

export type AthleteAnalyticsCard = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: AthleteTone;
};

export type AthleteBestResult = {
  id: string;
  exercise: string;
  value: string;
  date: string;
  delta: string;
  tone: AthleteTone;
};

export type AthleteProgressPhoto = {
  id: string;
  label: string;
  date: string;
  view: "front" | "side" | "back";
  status: "new" | "reviewed";
};

export type AthleteExerciseTrend = {
  id: string;
  exercise: string;
  description: string;
  values: number[];
  unit: string;
  start: string;
  current: string;
  increase: string;
  bestSet: string;
  tone: AthleteTone;
};

export type AthleteAchievement = {
  id: string;
  levelId?: string;
  collectionId?: string;
  collection?: string;
  title: string;
  description: string;
  assetSrc?: string;
  category: "training" | "progress" | "consistency" | "strength" | "community";
  status: "unlocked" | "in_progress" | "locked";
  rarity: "base" | "rare" | "epic";
  tier?: "bronze" | "silver" | "gold" | "master" | "cup" | "secret";
  score?: number;
  unlockedAt?: string;
  progress?: {
    current: number;
    target: number;
    label: string;
  };
};

export type AthleteTitle = {
  id: string;
  name: string;
  category: "discipline" | "strength" | "transformation" | "form" | "club" | "special";
  description: string;
  asset: string;
  unlockedAt?: string;
  isUnlocked: boolean;
};

export type AthleteReputationRankId =
  | "CONTENDER_I"
  | "CONTENDER_II"
  | "CONTENDER_III"
  | "SPORTSMAN_I"
  | "SPORTSMAN_II"
  | "SPORTSMAN_III"
  | "ATHLETE_I"
  | "ATHLETE_II"
  | "ATHLETE_III"
  | "ELITE_I"
  | "ELITE_II"
  | "ELITE_III"
  | "CHAMPION_I"
  | "CHAMPION_II"
  | "CHAMPION_III"
  | "LEGEND_I"
  | "LEGEND_II"
  | "LEGEND_III";

export type AthleteReputation = {
  score: number;
  rankId: AthleteReputationRankId;
  progress: number;
};

export type AthleteReputationRank = {
  id: AthleteReputationRankId;
  name: string;
  group: "Претендент" | "Спортсмен" | "Атлет" | "Элита" | "Чемпион" | "Легенда";
  division: 1 | 2 | 3;
  minScore: number;
  asset?: string;
};

export type AthleteProfilePost = {
  id: string;
  type: "post" | "workout" | "achievement" | "photo" | "check_in" | "coach_note";
  author: "client" | "coach" | "system";
  title: string;
  body: string;
  time: string;
  meta?: string;
  tone: AthleteTone;
  stats?: {
    reactions?: number;
    comments?: number;
  };
};

export type AthleteManagement = {
  addedAt: string;
  source: AthleteMembershipSource;
  subscriptionStatus: AthleteSubscriptionStatus;
  purchaseName: string;
  purchaseDate: string;
  subscriptionEndDate: string;
  nextPaymentDate: string;
  tariffName: string;
  tariffAmount: string;
  accessStatus: AthleteAccessStatus;
  canMessage: boolean;
  canAccessWorkouts: boolean;
  canUploadProgress: boolean;
  inviteLink: string;
  purchasedPrograms: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
  }>;
  paymentHistory: Array<{
    id: string;
    date: string;
    title: string;
    amount: string;
    status: string;
    tone: AthleteTone;
  }>;
  dangerActions: Array<"pause_access" | "disable_access" | "remove_client">;
};

export type AthleteProfile = {
  id: string;
  name: string;
  initials: string;
  career: {
    completedWorkouts: number;
    weightChange: string;
    streakDays: number;
  };
  goal: string;
  about: string;
  trainingExperience: string;
  equipment: AthleteEquipmentItem[];
  limitations: AthleteLimitation[];
  preferredTrainingDays: string[];
  currentProgram: AthleteProgramSnapshot;
  adherence: AthleteAdherence;
  reputation: AthleteReputation;
  membership: AthleteMembership;
  coachNotes: AthleteCoachNote[];
  calendarEvents: AthleteCalendarEvent[];
  analyticsCards: AthleteAnalyticsCard[];
  bestResults: AthleteBestResult[];
  progressPhotos: AthleteProgressPhoto[];
  achievements: AthleteAchievement[];
  titles: AthleteTitle[];
  activeTitleId: string;
  profilePosts: AthleteProfilePost[];
  management: AthleteManagement;
  currentWeight: string;
  targetWeight: string;
  status: string;
  lastActivity: string;
  phase: string;
  nextWorkout: string;
  lastWorkout: string;
  openIssues: string[];
  upcomingWorkouts: AthleteWorkout[];
  workoutHistory: AthleteWorkout[];
  previousLoads: AthleteLoad[];
  progression: Array<{ label: string; value: string; detail: string; tone: AthleteTone }>;
  measurements: AthleteMeasurement[];
  weightTrend: number[];
  exerciseTrends: AthleteExerciseTrend[];
  photos: Array<{ id: string; label: string; date: string }>;
  checkIns: Array<{ id: string; label: string; score: string; detail: string; tone: AthleteTone }>;
  timeline: AthleteTimelineItem[];
};
