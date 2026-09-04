import { randomUUID } from "node:crypto";
import { expect, test, type Page, type APIResponse, type Locator } from "@playwright/test";
import { Pool } from "pg";
import type { WorkoutSession } from "../../lib/server/workout-sessions/workout-session-types";

const baseURL = "http://127.0.0.1:3101";
const headers = { Origin: baseURL };
async function body<T>(response: APIResponse): Promise<T> { expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true); return response.json(); }
async function authenticate(page: Page, email: string) {
  const challenge = await body<{ challengeId: string; developmentCode: string }>(await page.request.post(`${baseURL}/api/auth/email/request`, { headers, data: { email, intent: "login" } }));
  await body(await page.request.post(`${baseURL}/api/auth/email/verify`, { headers, data: { email, challengeId: challenge.challengeId, code: challenge.developmentCode } }));
  return (await body<{ userId: string }>(await page.request.get(`${baseURL}/api/access/context`))).userId;
}

test("R3D client completion unknowns, mobile gates and original-trainer suspended Review", async ({ browser }, info) => {
  test.setTimeout(240_000);
  const tc = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const ac = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const trainer = await tc.newPage(); const athlete = await ac.newPage();
  const admin = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
  const errors: string[] = [];
  const httpRequests: Array<{ path: string; query: URLSearchParams; method: string }> = [];
  for (const page of [athlete, trainer]) page.on("request", (request) => {
    const url = new URL(request.url());
    httpRequests.push({ path: url.pathname, query: url.searchParams, method: request.method() });
  });
  const measuredRequests: Record<string, number[]> = {};
  const countHttp = (path: string, method = "GET") => httpRequests.filter((request) => request.path === path && request.method === method).length;
  const record = (operation: string, count: number) => { (measuredRequests[operation] ??= []).push(count); };
  athlete.on("pageerror", (error) => errors.push(error.message));
  athlete.on("console", (message) => { if (/hydration|DialogDescription|aria-describedby/i.test(message.text())) errors.push(message.text()); });
  try {
    const trainerId = await authenticate(trainer, "r3d.trainer@example.test");
    const athleteId = await authenticate(athlete, "r3d.athlete@example.test");
    // Fixture-only capabilities. Assignment, Start, progress, Complete and Review use HTTP commands below.
    await admin.query("INSERT INTO app.trainer_profiles(user_id,status,activated_at) VALUES ($1,'active',clock_timestamp())", [trainerId]);
    await admin.query("INSERT INTO app.athlete_profiles(user_id,status) VALUES ($1,'active')", [athleteId]);
    const relationId = (await admin.query<{ id: string }>("INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true) RETURNING id", [trainerId, athleteId])).rows[0].id;
    const templateId = randomUUID(), revisionId = randomUUID();
    const saved = await body<{ template: { editToken: string } }>(await trainer.request.post("/api/trainer/workout-builder/templates", { headers, data: {
      commandId: randomUUID(), templateId, revisionId, expectedEditToken: null,
      content: { id: templateId, revisionId, title: "R3D контрольное завершение", description: "", category: "Сила", estimatedDurationMin: "20", generalInstruction: "",
        items: [{ id: "item", kind: "exercise", exercise: { instanceId: "instance", exerciseId: "completion-squat", title: "Приседание", category: "Сила", equipment: "Штанга",
          prescription: { type: "repetitions", sets: "2", repetitionMode: "fixed", repetitionsMin: "6", repetitionsMax: "6", durationSec: "", targetWeightKg: "50", restSec: "90" },
          perSetMode: false, setOverrides: [], trainerNote: "" } }] },
    } }));
    await body(await trainer.request.post(`/api/trainer/workout-builder/templates/${templateId}/publish`, { headers, data: { commandId: randomUUID(), revisionId, expectedEditToken: saved.template.editToken } }));
    const sessions: WorkoutSession[] = [];
    for (let index = 0; index < 6; index++) {
      const read = await body<{ quickAssign: { athlete: { assignmentStateToken: string } } }>(await trainer.request.get(`/api/trainer/athletes/${athleteId}/quick-assign`));
      const assignment = await body<{ assignment: { id: string } }>(await trainer.request.post("/api/workout-assignments", { headers, data: {
        assignmentId: randomUUID(), athleteUserId: athleteId, templateId, templateRevisionId: revisionId,
        scheduledFor: `2026-09-${String(index + 4).padStart(2, "0")}`, trainerNote: "", assignmentStateToken: read.quickAssign.athlete.assignmentStateToken, allowAdditionalAssignment: false,
        transitionContext: JSON.stringify({ version: 1, origin: "direct", athleteUserId: athleteId, tab: "training" }),
      } }));
      const start = await body<{ session: WorkoutSession }>(await athlete.request.post("/api/workout-sessions", { headers, data: { assignmentId: assignment.assignment.id, clientTimezone: "Europe/Moscow", idempotencyKey: randomUUID() } }));
      sessions.push(start.session);
    }
    async function open(session: WorkoutSession) {
      await athlete.goto(`/client/workouts?session=${session.id}&returnTo=%2Fclient%2Fworkouts`);
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeEnabled();
      const before = countHttp("/api/client/workouts");
      await athlete.getByRole("button", { name: "Завершить", exact: true }).click();
      const dialog = athlete.getByRole("dialog", { name: "Завершить тренировку", exact: true });
      await expect(dialog.getByText("Не записано", { exact: true })).toBeVisible();
      record("preCompletionGet", countHttp("/api/client/workouts") - before);
      return dialog;
    }
    await test.step("dirty, saving and unknown Set block completion with an exact return", async () => {
      await athlete.goto(`/client/workouts?session=${sessions[0].id}`);
      await athlete.getByLabel("Повторы", { exact: true }).first().fill("6");
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeDisabled();
      await athlete.getByRole("button", { name: "Есть несохранённые результаты. К подходу" }).click();
      await athlete.route(`**/api/workout-sessions/${sessions[0].id}/progress`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        await route.fulfill({ status: 503, json: { error: "temporarily_unavailable" } });
      }, { times: 1 });
      await athlete.getByRole("button", { name: "Сохранить", exact: true }).first().click();
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeDisabled();
      await expect(athlete.getByRole("button", { name: "Проверить", exact: true }).first()).toBeVisible();
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeDisabled();
      await athlete.getByRole("button", { name: "Проверить", exact: true }).first().click();
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeEnabled();
      await athlete.route("**/api/client/workouts?**", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
      await athlete.getByRole("button", { name: "Завершить", exact: true }).click();
      const dialog = athlete.getByRole("dialog", { name: "Завершить тренировку", exact: true });
      await expect(dialog.getByText("Не удалось получить сохранённые результаты. Откройте завершение ещё раз.")).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Завершить тренировку", exact: true })).toBeDisabled();
      await dialog.getByRole("button", { name: "Вернуться к тренировке" }).click();
      await athlete.getByRole("button", { name: "Завершить", exact: true }).click();
      await expect(dialog.getByText("Не записано", { exact: true })).toBeVisible();
      await expect(dialog.getByText("Не удалось получить сохранённые результаты. Откройте завершение ещё раз.")).toHaveCount(0);
      await dialog.getByRole("button", { name: "Вернуться к тренировке" }).click();
    });
    await test.step("partial, explicit Yes, field focus, known failure, no-persist replay and mobile", async () => {
      const dialog = await open(sessions[0]);
      await athlete.keyboard.press("Escape");
      await expect(athlete.getByRole("button", { name: "Завершить", exact: true })).toBeFocused();
      await athlete.keyboard.press("Enter");
      await expect(dialog).toContainText("1 из 2 подходов");
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
      await expect(dialog.getByRole("radio", { name: "Нет", exact: true })).toBeFocused();
      await dialog.getByRole("radio", { name: "Да", exact: true }).check();
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
      await expect(dialog.getByLabel("Опишите, что почувствовали")).toBeFocused();
      await dialog.getByLabel("Опишите, что почувствовали").fill("Оригинальный дискомфорт\nБез интерпретации");
      await dialog.getByLabel("Комментарий тренеру (необязательно)").fill("Оригинальный общий комментарий");
      await athlete.setViewportSize({ width: 390, height: 500 });
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).scrollIntoViewIfNeeded();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await athlete.screenshot({ path: info.outputPath("r3d-completion-390x500.png") });
      await athlete.setViewportSize({ width: 390, height: 844 });
      await athlete.screenshot({ path: info.outputPath("r3d-completion-390x844.png") });
      // Equivalent reflow viewport for 200% zoom on 1440x1024; not native browser zoom.
      await athlete.setViewportSize({ width: 720, height: 512 });
      expect(await athlete.evaluate(() => window.innerWidth)).toBe(720);
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).scrollIntoViewIfNeeded();
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect(await athlete.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await athlete.screenshot({ path: info.outputPath("r3d-completion-200-percent-layout-zoom.png") });
      await athlete.setViewportSize({ width: 390, height: 844 });
      const requests: Record<string, unknown>[] = [];
      await athlete.route(`**/api/workout-sessions/${sessions[0].id}/complete`, async (route) => {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) await route.fulfill({ status: 400, json: { error: "invalid_request" } });
        else if (requests.length === 2) await route.fulfill({ status: 503, json: { error: "temporarily_unavailable" } });
        else await route.continue();
      });
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
      await expect(dialog.getByText("Не удалось завершить тренировку. Проверьте поля и повторите.")).toBeVisible();
      await expect(dialog.getByLabel("Комментарий тренеру (необязательно)")).toHaveValue("Оригинальный общий комментарий");
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
      const readBeforeFailure = countHttp("/api/client/workouts");
      await athlete.route("**/api/client/workouts?**completionCommandId=**", (route) => route.fulfill({ status: 503, json: {} }), { times: 1 });
      await dialog.getByRole("button", { name: "Проверить завершение" }).click();
      await expect(dialog.getByRole("button", { name: "Проверить завершение" })).toBeVisible();
      expect(requests).toHaveLength(2);
      record("failedReconciliationGet", countHttp("/api/client/workouts") - readBeforeFailure);
      const readBeforeReplay = countHttp("/api/client/workouts");
      await dialog.getByRole("button", { name: "Проверить завершение" }).click();
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      expect(requests).toHaveLength(3);
      expect(new Set(requests.map((r) => r.idempotencyKey)).size).toBe(1);
      record("reconciliationGet", countHttp("/api/client/workouts") - readBeforeReplay);
      record("sameKeyReplayPost", requests.length - 2);
      await athlete.reload();
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      let failedNavigation = 0;
      await athlete.route("**/client/me**", async (route) => {
        failedNavigation++;
        if (route.request().isNavigationRequest()) await route.fulfill({ status: 503, contentType: "text/html", body: "<main>Navigation unavailable</main>" });
        else await route.abort("failed");
      });
      await athlete.getByRole("link", { name: "На главную", exact: true }).click();
      await expect.poll(() => failedNavigation).toBeGreaterThan(0);
      await expect(athlete.getByText("Navigation unavailable", { exact: true })).toBeVisible();
      await athlete.unroute("**/client/me**");
      await athlete.goto(`/client/workouts?session=${sessions[0].id}`);
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      expect(requests).toHaveLength(3);
    });
    await test.step("zero results, Yes-to-No clears hidden text, persisted unknown does not POST again", async () => {
      const dialog = await open(sessions[1]);
      await dialog.getByLabel("Подтверждаю завершение без выполненных подходов").check();
      await dialog.getByRole("radio", { name: "Да", exact: true }).check();
      await dialog.getByLabel("Опишите, что почувствовали").fill("Hidden text must not persist");
      await dialog.getByRole("radio", { name: "Нет", exact: true }).check();
      let posts = 0;
      await athlete.route(`**/api/workout-sessions/${sessions[1].id}/complete`, async (route) => {
        posts++;
        expect(route.request().postDataJSON().discomfortComment).toBeNull();
        expect((await route.fetch()).ok()).toBe(true);
        await route.fulfill({ status: 503, json: { error: "temporarily_unavailable" } });
      });
      await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
      await dialog.getByRole("button", { name: "Проверить завершение" }).click();
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      expect(posts).toBe(1);
      record("firstPersistedCompletionPost", posts);
    });
    for (const [index, mode] of [[2, "version"], [3, "equivalent"], [4, "different"]] as const) {
      await test.step(`unknown reconciliation: ${mode}`, async () => {
        const session = sessions[index]; const dialog = await open(session);
        await dialog.getByLabel("Подтверждаю завершение без выполненных подходов").check();
        await dialog.getByRole("radio", { name: "Нет", exact: true }).check();
        let request: Record<string, unknown> = {}; let posts = 0;
        await athlete.route(`**/api/workout-sessions/${session.id}/complete`, async (route) => { posts++; request = route.request().postDataJSON(); await route.fulfill({ status: 503, json: {} }); }, { times: 1 });
        await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
        await expect(dialog.getByRole("button", { name: "Проверить завершение" })).toBeVisible();
        if (mode === "version") {
          await body(await athlete.request.post(`/api/workout-sessions/${session.id}/progress`, { headers, data: {
            expectedVersion: 1, idempotencyKey: randomUUID(), sets: [{ setLogId: session.exercises[0].sets[0].id, status: "skipped", actualRepetitions: null, actualDurationSeconds: null, actualWeightKg: null, rpe: null, athleteComment: "" }],
          } }));
        } else await body(await athlete.request.post(`/api/workout-sessions/${session.id}/complete`, { headers, data: { ...request, idempotencyKey: randomUUID(), ...(mode === "different" ? { overallComment: "Other tab fact" } : {}) } }));
        await dialog.getByRole("button", { name: "Проверить завершение" }).click();
        if (mode === "equivalent") await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
        else if (mode === "different") await expect(dialog.getByText("Сохранённый комментарий: Other tab fact")).toBeVisible();
        else {
          await expect(dialog.getByRole("button", { name: "Подтвердить текущие результаты" })).toBeVisible();
          await dialog.getByRole("button", { name: "Подтвердить текущие результаты" }).click();
          await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
          await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
        }
        expect(posts).toBe(1);
      });
    }
    await test.step("suspended completion and minimal trainer Review/feedback stay connected", async () => {
      await admin.query("UPDATE app.trainer_athlete_relations SET status='suspended' WHERE id=$1", [relationId]);
      const dialog = await open(sessions[5]);
      async function tabTo(target: Locator) {
        for (let index = 0; index < 12; index++) {
          if (await target.evaluate((element) => element === document.activeElement)) break;
          await athlete.keyboard.press("Tab");
        }
        await expect(target).toBeFocused();
      }
      await tabTo(dialog.getByLabel("Подтверждаю завершение без выполненных подходов")); await athlete.keyboard.press("Space");
      await tabTo(dialog.getByRole("radio", { name: "Нет", exact: true })); await athlete.keyboard.press("Space");
      await tabTo(dialog.getByRole("button", { name: "Завершить тренировку", exact: true })); await athlete.keyboard.press("Enter");
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      const queue = await body<{ athletes: unknown[]; reviews: Array<{ sessionId: string }> }>(await trainer.request.get("/api/trainer/dashboard"));
      expect(queue.athletes).toHaveLength(0); expect(queue.reviews).toHaveLength(6);
      expect(queue.reviews[0].sessionId).toBe(sessions[0].id);
      const dashboardBefore = countHttp("/api/trainer/dashboard");
      await trainer.goto("/trainer/dashboard");
      await expect(trainer.getByRole("list", { name: "Очередь внимания" }).getByRole("listitem")).toHaveCount(6);
      record("dashboardRefreshGet", countHttp("/api/trainer/dashboard") - dashboardBefore);
      await expect(trainer.getByRole("link", { name: "Контекст клиента", exact: true })).toHaveCount(0);
      await trainer.getByRole("button", { name: "Следующая задача", exact: true }).click();
      await trainer.getByRole("button", { name: "Разобрать", exact: true }).click();
      await expect(trainer).toHaveURL(new RegExp(`/trainer/review/${queue.reviews[1].sessionId}`));
      const reviewBefore = countHttp(`/api/trainer/reviews/${sessions[0].id}`);
      await trainer.goto(`/trainer/review/${sessions[0].id}`);
      await expect(trainer.getByText("Оригинальный дискомфорт\nБез интерпретации", { exact: true })).toBeVisible();
      record("exactReviewGet", countHttp(`/api/trainer/reviews/${sessions[0].id}`) - reviewBefore);
      const discomfortY = await trainer.locator("[data-review-discomfort]").evaluate((e) => e.getBoundingClientRect().top);
      const exceptionsY = await trainer.locator("#review-exceptions").evaluate((e) => e.getBoundingClientRect().top);
      expect(discomfortY).toBeLessThan(exceptionsY);
      await expect(trainer.getByText("Оригинальный общий комментарий", { exact: true })).toBeVisible();
      await trainer.getByLabel("Сообщение спортсмену").fill("Ответ исходного тренера после приостановки");
      await trainer.getByRole("button", { name: "Отправить ответ", exact: true }).click();
      await expect(trainer.getByRole("heading", { name: "Обратная связь сохранена", exact: true })).toBeVisible();
      await expect(trainer.getByRole("link", { name: "Назначить следующую тренировку", exact: true })).toHaveCount(0);
      await expect(trainer.getByRole("link", { name: "К профилю", exact: true })).toHaveCount(0);
      const read = await body<{ review: { existingFeedback: Array<{ id: string }> } }>(await trainer.request.get(`/api/trainer/reviews/${sessions[0].id}`));
      const feedback = await body<{ feedback: Array<{ id: string }> }>(await athlete.request.get(`/api/client/feedback?sessionId=${sessions[0].id}`));
      expect(feedback.feedback[0].id).toBe(read.review.existingFeedback[0].id);
    });
    expect(errors).toEqual([]);
    console.log("R3D observed browser workflow API requests (excludes shell/auth/prefetch)", measuredRequests);
    for (const values of Object.values(measuredRequests)) expect(values.every((value) => value === 1)).toBe(true);
  } finally { await admin.end(); await ac.close(); await tc.close(); }
});
