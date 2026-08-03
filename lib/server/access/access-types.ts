export type TrainerCapabilityStatus = "pending" | "active" | "suspended" | "archived";
export type AthleteCapabilityStatus = "active" | "suspended" | "archived";
export type RelationStatus = "active" | "suspended" | "ended";

export interface AccessContext {
  userId: string;
  displayName: string | null;
  trainer: { status: TrainerCapabilityStatus } | null;
  athlete: { status: AthleteCapabilityStatus } | null;
  destination: "/trainer/dashboard" | "/client/me" | "/onboarding" | "/workspaces";
}

export interface AthleteInvitationResult {
  invitationId: string;
  token: string;
  expiresAt: Date;
}

export interface TrainerAthleteRelation {
  id: string;
  trainerUserId: string;
  athleteUserId: string;
  status: RelationStatus;
  isPrimary: boolean;
  acceptedAt: Date;
}
