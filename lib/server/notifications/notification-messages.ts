import type {
  NotificationEventType,
  NotificationMessage,
} from "@/lib/server/notifications/notification-types";

const messages: Record<NotificationEventType, NotificationMessage> = {
  workout_assigned: {
    text: "Вам назначена новая тренировка.",
    actionLabel: "Открыть тренировки",
    actionPath: "/client/workouts",
  },
  workout_completed: {
    text: "Спортсмен завершил тренировку. Она готова к разбору.",
    actionLabel: "Открыть очередь разбора",
    actionPath: "/trainer/attention",
  },
  review_feedback_ready: {
    text: "Тренер отправил обратную связь по тренировке.",
    actionLabel: "Открыть кабинет",
    actionPath: "/client/me",
  },
};

export function notificationMessage(eventType: NotificationEventType) {
  return messages[eventType];
}
