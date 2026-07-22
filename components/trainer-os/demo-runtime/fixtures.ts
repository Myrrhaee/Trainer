import { createWorkoutAssignment } from "./commands";
import { createInitialTrainerDemoState } from "./seed";
import { getQuickAssignView } from "./selectors";
import { TRAINER_DEMO_ACTOR_ID, type DemoFixtureId, type TrainerDemoState } from "./types";
import { createAssignmentReceipt, type WorkoutAssignmentDraft } from "../quick-assign/quick-assign-model";

export type DemoFixtureDefinition = {
  id: DemoFixtureId;
  label: string;
  description: string;
  athleteId: string;
  primaryEntry: string;
  trainerEntry: string;
  clientEntry: string;
};

const CLIENT_ASSIGNMENT_ID = "demo-assignment-maria-volkova-strength-base-v3-2026-07-23";

export const demoFixtureDefinitions: DemoFixtureDefinition[] = [
  {
    id: "review-required",
    label: "A · Review required",
    description: "Артём завершил тренировку, разбор и feedback ещё не выполнены.",
    athleteId: "artem-smirnov",
    primaryEntry: "/trainer/dashboard",
    trainerEntry: "/trainer/review/artem-smirnov-2026-06-10?from=dashboard&attentionItem=attention-artem-smirnov-review",
    clientEntry: "/client/me?actor=artem-smirnov",
  },
  {
    id: "discomfort",
    label: "B · Discomfort",
    description: "Ольга оставила исходный сигнал о дискомфорте после тренировки.",
    athleteId: "olga-sokolova",
    primaryEntry: "/trainer/dashboard",
    trainerEntry: "/trainer/review/olga-sokolova-2026-06-16?from=dashboard&attentionItem=attention-olga-sokolova-discomfort",
    clientEntry: "/client/me?actor=olga-sokolova",
  },
  {
    id: "needs-assignment",
    label: "C · Needs assignment",
    description: "У Егора нет следующей тренировки; профиль готов к Quick Assign.",
    athleteId: "egor-nikitin",
    primaryEntry: "/trainer/clients/egor-nikitin",
    trainerEntry: "/trainer/clients/egor-nikitin?quickAssign=1",
    clientEntry: "/client/me?actor=egor-nikitin",
  },
  {
    id: "no-suitable-template",
    label: "D · No suitable template",
    description: "Для Александры нет доступного шаблона; путь ведёт через Builder.",
    athleteId: "alexandra-konstantinova",
    primaryEntry: "/trainer/clients/alexandra-konstantinova?quickAssign=1",
    trainerEntry: "/trainer/builder?clientId=alexandra-konstantinova&from=quick-assign&demo=empty",
    clientEntry: "/client/me?actor=alexandra-konstantinova",
  },
  {
    id: "calm-team",
    label: "E · Calm team",
    description: "Открытых задач нет; команда доступна через карту и список.",
    athleteId: "maria-volkova",
    primaryEntry: "/trainer/dashboard?demo=calm",
    trainerEntry: "/trainer/clients/maria-volkova",
    clientEntry: "/client/me?actor=maria-volkova",
  },
  {
    id: "client-execution",
    label: "F · Client execution",
    description: "Марии назначена Силовая база; session ещё не начата.",
    athleteId: "maria-volkova",
    primaryEntry: "/client/me?actor=maria-volkova",
    trainerEntry: "/trainer/clients/maria-volkova",
    clientEntry: `/client/workouts?actor=maria-volkova&assignment=${CLIENT_ASSIGNMENT_ID}`,
  },
];

export function isDemoFixtureId(value: string | null): value is DemoFixtureId {
  return demoFixtureDefinitions.some((fixture) => fixture.id === value);
}

export function getDemoFixtureDefinition(fixtureId: DemoFixtureId) {
  return demoFixtureDefinitions.find((fixture) => fixture.id === fixtureId)!;
}

export function withResearchParams(href: string, fixtureId: DemoFixtureId) {
  const [pathname, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("research", "1");
  params.set("fixture", fixtureId);
  return `${pathname}?${params.toString()}`;
}

export function createDemoFixtureState(fixtureId: DemoFixtureId): TrainerDemoState {
  const base = createInitialTrainerDemoState();
  if (fixtureId === "review-required") return selectAttentionFixture(base, "attention-artem-smirnov-review");
  if (fixtureId === "discomfort") return selectAttentionFixture(base, "attention-olga-sokolova-discomfort");
  if (fixtureId === "needs-assignment") {
    const attention = base.attentionItems.find((item) => item.athleteId === "egor-nikitin" && item.kind === "assignment");
    return attention ? { ...base, attentionItems: [attention], selectedAttentionItemId: attention.id } : base;
  }
  if (fixtureId === "no-suitable-template" || fixtureId === "calm-team") {
    return { ...base, attentionItems: [], selectedAttentionItemId: null };
  }
  return createClientExecutionFixture(base);
}

function selectAttentionFixture(base: TrainerDemoState, attentionId: string) {
  const attention = base.attentionItems.find((item) => item.id === attentionId);
  return attention ? { ...base, attentionItems: [attention], selectedAttentionItemId: attention.id } : base;
}

function createClientExecutionFixture(base: TrainerDemoState) {
  const clean = { ...base, attentionItems: [], selectedAttentionItemId: null, workoutAssignments: [] };
  const context = { source: "direct" as const, reason: "External trainer pilot fixture F" };
  const view = getQuickAssignView(clean, "maria-volkova", context);
  const template = view?.templates.find((item) => item.id === "strength-base-v3" && item.state === "published");
  if (!view || !template) return clean;
  const draft: WorkoutAssignmentDraft = {
    athleteId: view.athlete.id,
    templateId: template.id,
    scheduledDate: "2026-07-23",
    trainerNote: "",
    generalInstruction: template.instruction,
    exerciseOverrides: {},
    conflictAccepted: false,
  };
  return createWorkoutAssignment(clean, {
    actor: { id: TRAINER_DEMO_ACTOR_ID, role: "trainer" },
    receipt: createAssignmentReceipt(view, draft, template),
  }).state;
}
