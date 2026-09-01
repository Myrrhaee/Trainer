import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";

export type QuickAssignReceiptAction = {
  label: string;
  href: string;
  emphasis: "primary" | "secondary" | "tertiary";
};

export type QuickAssignReceiptNavigation = {
  actions: QuickAssignReceiptAction[];
  allCalmCopy: string | null;
};

export function formatQuickAssignCalendarDate(value: string, includeYear = true) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date).replace(/\s?г\.$/u, "");
}

export function quickAssignHeaderSummary(input: {
  persistedScheduledFor?: string | null;
  nextAssignment: { title: string; scheduledFor: string } | null;
  upcomingAssignmentCount: number;
}) {
  if (input.persistedScheduledFor) {
    return `Назначение создано · ${formatQuickAssignCalendarDate(input.persistedScheduledFor, false)}`;
  }
  if (!input.nextAssignment) return "Будущих тренировок нет";
  return `${input.nextAssignment.title} · ${formatQuickAssignCalendarDate(input.nextAssignment.scheduledFor)} · будущих: ${input.upcomingAssignmentCount}`;
}

export function quickAssignReceiptNavigation(
  transition: TrainerWorkflowTransition,
): QuickAssignReceiptNavigation {
  const origin = transition.context.origin;
  if (transition.allCalm) {
    return {
      allCalmCopy: "Других задач сейчас нет.",
      actions: [
        { label: "К спортсменам", href: "/trainer/clients", emphasis: "primary" },
        { label: "На главную", href: "/trainer/dashboard", emphasis: "secondary" },
      ],
    };
  }

  if (origin === "profile") {
    return {
      allCalmCopy: null,
      actions: compactActions([
        { label: "Вернуться к тренировкам", href: transition.profileHref, emphasis: "primary" },
        { label: "К рабочей очереди", href: transition.queueHref, emphasis: "secondary" },
      ]),
    };
  }

  if (origin === "dashboard") {
    return {
      allCalmCopy: null,
      actions: compactActions([
        transition.nextItem ? { label: "Следующая задача", href: transition.nextItem.href, emphasis: "primary" } : null,
        { label: "К профилю", href: transition.profileHref, emphasis: transition.nextItem ? "secondary" : "primary" },
        { label: "К рабочей очереди", href: transition.queueHref, emphasis: "tertiary" },
      ]),
    };
  }

  if (origin === "clients") {
    return {
      allCalmCopy: null,
      actions: compactActions([
        { label: "К списку спортсменов", href: "/trainer/clients", emphasis: "primary" },
        { label: "Открыть профиль", href: transition.profileHref, emphasis: "secondary" },
      ]),
    };
  }

  if (origin === "review") {
    return {
      allCalmCopy: null,
      actions: compactActions([
        transition.nextItem ? { label: "Следующая задача", href: transition.nextItem.href, emphasis: "primary" } : null,
        { label: "Открыть профиль", href: transition.profileHref, emphasis: transition.nextItem ? "secondary" : "primary" },
        { label: "К рабочей очереди", href: transition.queueHref, emphasis: "tertiary" },
      ]),
    };
  }

  return {
    allCalmCopy: null,
    actions: compactActions([
      { label: "Открыть профиль", href: transition.profileHref, emphasis: "primary" },
      { label: "На главную", href: "/trainer/dashboard", emphasis: "secondary" },
    ]),
  };
}

function compactActions(actions: Array<QuickAssignReceiptAction | null>) {
  const seen = new Set<string>();
  return actions.filter((action): action is QuickAssignReceiptAction => {
    if (!action?.href || seen.has(action.href)) return false;
    seen.add(action.href);
    return true;
  });
}
