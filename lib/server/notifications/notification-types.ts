export type NotificationEventType =
  | "workout_assigned"
  | "workout_completed"
  | "review_feedback_ready";

export type NotificationAggregateType =
  | "workout_assignment"
  | "workout_session"
  | "trainer_feedback";

export type ClaimedNotification = {
  id: string;
  eventType: NotificationEventType;
  recipientUserId: string;
  aggregateType: NotificationAggregateType;
  aggregateId: string;
  attemptCount: number;
  lockToken: string;
  expiresAt: Date;
};

export type NotificationMessage = {
  text: string;
  actionLabel: string;
  actionPath: string;
};

export type NotificationDeliveryResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; errorCode: string; retryable: boolean; retryAfterSeconds?: number };
