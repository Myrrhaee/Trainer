import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

import type { APIResponse, Page } from "@playwright/test";
import { Pool } from "pg";

const execFile = promisify(execFileCallback);
const baseURL = "http://127.0.0.1:3101";
const trainerEmail = "long-review.trainer.e2e@example.test";
const athleteEmail = "long-review.athlete.e2e@example.test";

export const longReviewTitle = "R2B.2 · Длинная каноническая тренировка";
export const longExerciseTitle = "Тяга горизонтального блока с пошаговой фиксацией лопаток и контролем нейтрального положения корпуса";
export const secondLongExerciseTitle = "Односторонний жим гантели в положении полустоя с паузой в верхней точке и стабилизацией лопатки";
export const longSetComment = [
  "На первой половине подхода движение ощущалось ровно, но после шестого повтора пришлось сознательно замедлить темп и следить за положением локтя.",
  "Вторая строка сохраняет исходную структуру комментария: дыхание оставалось под контролем, опора не менялась, дискомфорт не оценивался, потому что такого поля в этой сессии не было.",
  `Длинный фрагмент без пробелов проверяет перенос: ${"техникакорпусдыхание".repeat(17)}.`,
  "Финальная строка: в следующей тренировке хочу сравнить тот же вес и не менять остальные условия подхода.",
].join("\n");

type StartedSet = {
  id: string;
  position: number;
  plannedRepetitionsMin: number | null;
  plannedDurationSeconds: number | null;
  plannedWeightKg: number | null;
};

type StartedExercise = {
  assignmentExerciseId: string;
  title: string;
  sets: StartedSet[];
};

type SessionFixture = {
  sessionId: string;
  legacyAnchorId: string;
  legacyNeighborAnchorId: string;
  legacyPlannedWeight: number | null;
  legacyNeighborPlannedWeight: number | null;
  longCommentAnchorId: string;
};

export type LongReviewFixture = {
  open: SessionFixture;
  resolved: SessionFixture;
  athleteName: string;
  prescribedSetCount: number;
};

export async function provisionLongReviewFixture(trainer: Page, athlete: Page): Promise<LongReviewFixture> {
  const trainerId = await authenticate(trainer, trainerEmail, "Тренер длинного разбора");
  await responseJson(await trainer.request.post(`${baseURL}/api/access/trainer-request`, {
    headers: { Origin: baseURL },
  }), 202);
  await activateTrainer(trainerEmail);

  const athleteName = "Александра Контрольная";
  const athleteId = await authenticate(athlete, athleteEmail, athleteName);
  const invitation = await responseJson<{ webInvitationUrl: string }>(await trainer.request.post(`${baseURL}/api/access/invitations`, {
    headers: { Origin: baseURL },
  }), 201);
  const invitationToken = new URL(invitation.webInvitationUrl).searchParams.get("invite");
  if (!invitationToken) throw new Error("long_review_invitation_token_missing");
  await responseJson(await athlete.request.post(`${baseURL}/api/access/invitations/accept`, {
    headers: { Origin: baseURL },
    data: { token: invitationToken },
  }), 200);

  const templateInput = longTemplateInput();
  const templateId = randomUUID();
  const revisionId = randomUUID();
  const draft = await responseJson<{
    template: { id: string; revisionId: string; editToken: string };
  }>(await trainer.request.post(
    `${baseURL}/api/trainer/workout-builder/templates`,
    {
      headers: { Origin: baseURL },
      data: {
        commandId: randomUUID(),
        templateId,
        revisionId,
        expectedEditToken: null,
        content: { ...templateInput, id: templateId, revisionId },
      },
    },
  ), 201);
  const published = await responseJson<{ template: { id: string } }>(await trainer.request.post(
    `${baseURL}/api/trainer/workout-builder/templates/${draft.template.id}/publish`,
    {
      headers: { Origin: baseURL },
      data: {
        commandId: randomUUID(),
        revisionId: draft.template.revisionId,
        expectedEditToken: draft.template.editToken,
      },
    },
  ), 200);

  const open = await createCompletedSession(trainer, athlete, athleteId, published.template.id, "open");
  const resolved = await createCompletedSession(trainer, athlete, athleteId, published.template.id, "resolved");
  await addFeedbackTimeline(trainer, resolved.sessionId);

  if (!trainerId || !athleteId) throw new Error("long_review_identity_missing");
  return { open, resolved, athleteName, prescribedSetCount: 48 };
}

function longTemplateInput() {
  return {
    title: longReviewTitle,
    revision: 1,
    description: "Canonical PostgreSQL fixture для browser quality gate длинного Review.",
    category: "Полное тело",
    estimatedDurationMin: "95",
    generalInstruction: "Фиксировать факты каждого подхода без субъективной интерпретации.",
    items: Array.from({ length: 12 }, (_, index) => {
      const number = index + 1;
      const duration = index >= 10;
      const title = index === 2 ? longExerciseTitle
        : index === 8 ? secondLongExerciseTitle
          : `Контрольное упражнение ${number}`;
      const baseWeight = 20 + number * 3;
      return {
        id: `long-item-${number}`,
        kind: "exercise",
        exercise: {
          instanceId: `long-instance-${number}`,
          exerciseId: `long-exercise-${number}`,
          title,
          category: duration ? "Выносливость" : "Сила",
          equipment: duration ? "Собственный вес" : "Тренажёр",
          prescription: {
            type: duration ? "duration" : "repetitions",
            sets: "4",
            repetitionMode: "fixed",
            repetitionsMin: duration ? "" : "10",
            repetitionsMax: duration ? "" : "10",
            durationSec: duration ? "45" : "",
            targetWeightKg: duration ? "" : String(baseWeight),
            restSec: "75",
          },
          perSetMode: true,
          setOverrides: Array.from({ length: 4 }, (_, setIndex) => ({
            id: `long-set-${number}-${setIndex + 1}`,
            order: setIndex + 1,
            kind: setIndex === 0 ? "warmup" : "working",
            repetitionsMin: duration ? "" : "10",
            repetitionsMax: duration ? "" : "10",
            durationSec: duration ? String(40 + setIndex * 5) : "",
            targetWeightKg: duration ? "" : String(baseWeight + setIndex),
            restSec: "75",
            usesOverride: true,
          })),
          trainerNote: `Инструкция к упражнению ${number}: сохранять контроль и не менять порядок подходов.`,
        },
      };
    }),
  };
}

async function createCompletedSession(
  trainer: Page,
  athlete: Page,
  athleteId: string,
  templateId: string,
  suffix: string,
): Promise<SessionFixture> {
  const strict = await strictAssignmentData(trainer, athleteId, templateId);
  const assignment = await responseJson<{ assignment: { id: string } }>(await trainer.request.post(
    `${baseURL}/api/workout-assignments`,
    {
      headers: { Origin: baseURL },
      data: {
        assignmentId: crypto.randomUUID(),
        athleteUserId: athleteId,
        templateId,
        templateRevisionId: strict.templateRevisionId,
        scheduledFor: "2026-08-31",
        trainerNote: `Long Review ${suffix}`,
        assignmentStateToken: strict.assignmentStateToken,
        allowAdditionalAssignment: false,
        transitionContext: JSON.stringify({ version: 1, origin: "direct", athleteUserId: athleteId, tab: "training" }),
      },
    },
  ), 201);
  const started = await responseJson<{
    session: { id: string; version: number; exercises: StartedExercise[] };
  }>(await athlete.request.post(`${baseURL}/api/workout-sessions`, {
    headers: { Origin: baseURL },
    data: {
      assignmentId: assignment.assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKey: `long-review-${suffix}-start-${assignment.assignment.id}`,
    },
  }), 201);

  const flattened = started.session.exercises.flatMap((exercise) => (
    exercise.sets.map((set) => ({ exercise, set }))
  ));
  const progress = flattened.map(({ set }, index) => {
    const skipped = index === 4;
    const incomplete = index === 5;
    const repetitions = set.plannedRepetitionsMin;
    const duration = set.plannedDurationSeconds;
    const weight = set.plannedWeightKg;
    const athleteComment = index === 2 ? "Короткий комментарий к первому источнику."
      : index === 9 ? longSetComment
        : index === 25 ? "Отдельный комментарий к другому подходу.\nОн не должен объединяться с длинным комментарием."
          : "";
    return {
      setLogId: set.id,
      status: skipped ? "skipped" : incomplete ? "incomplete" : "completed",
      actualRepetitions: skipped || duration !== null ? null
        : index === 8 ? Math.max(1, (repetitions ?? 10) - 2)
          : incomplete ? Math.max(1, (repetitions ?? 10) - 4) : repetitions,
      actualDurationSeconds: skipped || duration === null ? null
        : index === 40 ? duration + 15 : duration,
      actualWeightKg: skipped ? null : index === 12 && weight !== null ? Math.max(0, weight - 5) : weight,
      rpe: skipped ? null : index % 3 === 0 ? 8 : 7,
      athleteComment,
    };
  });

  let version = started.session.version;
  for (let offset = 0; offset < progress.length; offset += 20) {
    const saved = await responseJson<{ session: { version: number } }>(await athlete.request.post(
      `${baseURL}/api/workout-sessions/${started.session.id}/progress`,
      {
        headers: { Origin: baseURL },
        data: {
          expectedVersion: version,
          idempotencyKey: `long-review-${suffix}-progress-${offset}`,
          sets: progress.slice(offset, offset + 20),
        },
      },
    ), 200);
    version = saved.session.version;
  }
  await responseJson(await athlete.request.post(`${baseURL}/api/workout-sessions/${started.session.id}/complete`, {
    headers: { Origin: baseURL },
    data: {
      expectedVersion: version,
      idempotencyKey: `long-review-${suffix}-complete`,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    },
  }), 200);

  const legacy = flattened[21];
  const legacyNeighbor = flattened[20];
  const legacySetLogId = await recreateLegacySetLog(legacy.set.id);
  return {
    sessionId: started.session.id,
    legacyAnchorId: setAnchor(legacy.exercise.assignmentExerciseId, legacySetLogId),
    legacyNeighborAnchorId: setAnchor(legacyNeighbor.exercise.assignmentExerciseId, legacyNeighbor.set.id),
    legacyPlannedWeight: legacy.set.plannedWeightKg,
    legacyNeighborPlannedWeight: legacyNeighbor.set.plannedWeightKg,
    longCommentAnchorId: setAnchor(flattened[9].exercise.assignmentExerciseId, flattened[9].set.id),
  };
}

async function strictAssignmentData(trainer: Page, athleteUserId: string, templateId: string) {
  const response = await responseJson<{
    quickAssign: {
      athlete: { assignmentStateToken: string };
      templates: { items: Array<{ templateId: string; revisionId: string }> };
    };
  }>(await trainer.request.get(`${baseURL}/api/trainer/athletes/${athleteUserId}/quick-assign?first=50`), 200);
  const template = response.quickAssign.templates.items.find((item) => item.templateId === templateId);
  if (!template) throw new Error("quick_assign_template_missing");
  return {
    templateRevisionId: template.revisionId,
    assignmentStateToken: response.quickAssign.athlete.assignmentStateToken,
  };
}

async function addFeedbackTimeline(trainer: Page, sessionId: string) {
  const review = await responseJson<{
    review: { attention: { id: string } };
  }>(await trainer.request.get(`${baseURL}/api/trainer/reviews/${sessionId}`), 200);
  const initial = await responseJson<{ feedback: { id: string } }>(await trainer.request.post(
    `${baseURL}/api/trainer/reviews/${sessionId}/feedback`,
    {
      headers: { Origin: baseURL },
      data: {
        attentionItemId: review.review.attention.id,
        kind: "detailed",
        body: "Подробный ответ по длинной контрольной тренировке.",
        idempotencyKey: `long-review-feedback-${sessionId}`,
      },
    },
  ), 201);
  const firstFollowUp = await responseJson<{ feedback: { id: string } }>(await trainer.request.post(
    `${baseURL}/api/trainer/reviews/${sessionId}/feedback`,
    {
      headers: { Origin: baseURL },
      data: {
        attentionItemId: review.review.attention.id,
        kind: "follow_up",
        body: "Первое уточнение к сохранённому ответу.",
        followUpOfId: initial.feedback.id,
        idempotencyKey: `long-review-follow-up-one-${sessionId}`,
      },
    },
  ), 201);
  await responseJson(await trainer.request.post(`${baseURL}/api/trainer/reviews/${sessionId}/feedback`, {
    headers: { Origin: baseURL },
    data: {
      attentionItemId: review.review.attention.id,
      kind: "follow_up",
      body: "Второе независимое уточнение в immutable timeline.",
      followUpOfId: firstFollowUp.feedback.id,
      idempotencyKey: `long-review-follow-up-two-${sessionId}`,
    },
  }), 201);
}

async function authenticate(page: Page, email: string, displayName: string) {
  const requested = await responseJson<{ challengeId: string; developmentCode: string }>(await page.request.post(
    `${baseURL}/api/auth/email/request`,
    { headers: { Origin: baseURL }, data: { email, intent: "login" } },
  ), 202);
  await responseJson(await page.request.post(`${baseURL}/api/auth/email/verify`, {
    headers: { Origin: baseURL },
    data: { email, challengeId: requested.challengeId, code: requested.developmentCode },
  }), 200);
  await responseJson(await page.request.patch(`${baseURL}/api/account/profile`, {
    headers: { Origin: baseURL }, data: { displayName },
  }), 200);
  const context = await responseJson<{ userId: string }>(await page.request.get(`${baseURL}/api/access/context`), 200);
  return context.userId;
}

async function activateTrainer(email: string) {
  const currentOptions = process.env.NODE_OPTIONS?.trim();
  await execFile(process.execPath, ["--import", "tsx", "scripts/ops/local-pilot.ts", "activate-trainer", "--email", email], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_OPTIONS: [currentOptions, "--conditions=react-server"].filter(Boolean).join(" "),
    },
    maxBuffer: 1024 * 1024,
  });
}

async function recreateLegacySetLog(setLogId: string) {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) throw new Error("database_migration_url_required");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query<{ id: string }>(`
      WITH removed AS (
        DELETE FROM app.workout_set_logs
        WHERE id = $1
        RETURNING exercise_log_id, set_key, position, kind,
          planned_repetitions_min, planned_repetitions_max, planned_duration_seconds,
          planned_weight_kg, status, actual_repetitions, actual_duration_seconds,
          actual_weight_kg, rpe, athlete_comment, created_at, updated_at
      )
      INSERT INTO app.workout_set_logs (
        exercise_log_id, source_assignment_set_id, set_key, position, kind,
        planned_repetitions_min, planned_repetitions_max, planned_duration_seconds,
        planned_weight_kg, status, actual_repetitions, actual_duration_seconds,
        actual_weight_kg, rpe, athlete_comment, created_at, updated_at
      )
      SELECT exercise_log_id, NULL, set_key, position, kind,
        planned_repetitions_min, planned_repetitions_max, planned_duration_seconds,
        planned_weight_kg, status, actual_repetitions, actual_duration_seconds,
        actual_weight_kg, rpe, athlete_comment, created_at, updated_at
      FROM removed
      RETURNING id
    `,
      [setLogId],
    );
    if (result.rowCount !== 1) throw new Error("legacy_source_fixture_not_recreated");
    return result.rows[0].id;
  } finally {
    await pool.end();
  }
}

async function responseJson<T = Record<string, unknown>>(response: APIResponse, expectedStatus: number): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (response.status() !== expectedStatus) {
    throw new Error(`fixture_http_${response.status()}_${body.error ?? "unknown"}`);
  }
  return body;
}

function setAnchor(exerciseId: string, setId: string) {
  return `review-set-${exerciseId}-${setId}`;
}
