import { randomUUID } from "node:crypto";
import { expect, test, type APIResponse, type Response, type Locator, type Page, type TestInfo } from "@playwright/test";
import { Pool } from "pg";
import type { WorkoutSession } from "../../lib/server/workout-sessions/workout-session-types";
import type { ClientWorkoutCollectionReadModel } from "../../lib/server/client-workouts/client-workout-types";
import type { TrainerDashboardSnapshot } from "../../lib/server/trainer-dashboard/trainer-dashboard-types";
import type { ReviewFeedback, TrainerReviewQueueItem } from "../../lib/server/reviews/review-types";
import { buildCanonicalTrainerDashboardView } from "../../components/trainer/canonical-trainer-dashboard-model";

const baseURL = "http://127.0.0.1:3101";
const headers = { Origin: baseURL };
async function body<T>(response: APIResponse | Response): Promise<T> {
  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
  return response.json();
}
async function authenticate(page: Page, email: string) {
  const c = await body<{ challengeId: string; developmentCode: string }>(await page.request.post("/api/auth/email/request", { headers, data: { email, intent: "login" } }));
  await body(await page.request.post("/api/auth/email/verify", { headers, data: { email, challengeId: c.challengeId, code: c.developmentCode } }));
  return (await body<{ userId: string }>(await page.request.get("/api/access/context"))).userId;
}
async function viewports(page: Page, info: TestInfo, surface: string) {
  for (const [width, height] of [[1440, 1024], [390, 844], [390, 500], [720, 512]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: info.outputPath(`${surface}-${width}x${height}.png`) });
    const action = surface === "quick-assign" ? page.getByRole("button", { name: "Назначить тренировку", exact: true })
      : surface === "completion" ? page.getByRole("dialog").getByRole("button", { name: "Завершить тренировку", exact: true })
      : surface === "execution" ? page.getByRole("button", { name: "Завершить", exact: true })
      : surface === "review" ? page.getByRole("button", { name: "Отправить ответ", exact: true })
      : surface === "history" ? page.locator('a[id^="workout-"]').first()
      : page.getByRole("link", { name: "На главную", exact: true }).first();
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
    await action.click({ trial: true });
    await page.screenshot({ path: info.outputPath(`${surface}-action-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

async function responsiveGate(page: Page, info: TestInfo, surface: string, anchor: Locator) {
  for (const [width, height] of [[1440, 1024], [390, 844], [390, 500], [720, 512]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await anchor.scrollIntoViewIfNeeded();
    await expect(anchor).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`${surface}-${width}x${height}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

test("R4 two exact canonical cycles, bounded current work and final pilot fixes", async ({ browser }, info) => {
  test.setTimeout(240_000);
  const tc = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const ac = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
  const trainer = await tc.newPage(), athlete = await ac.newPage();
  const admin = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
  const problems: string[] = [];
  const warnings: Array<{ url: string; text: string }> = [];
  const supabaseRequests: string[] = [];
  const observations: Record<string, unknown> = {};
  for (const page of [trainer, athlete]) {
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.port === "54321" || url.hostname.endsWith(".supabase.co")) supabaseRequests.push(request.url());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    page.on("console", (message) => {
      if (/Missing.*Description|DialogDescription|aria-describedby/i.test(message.text())) warnings.push({ url: page.url(), text: message.text() });
      else if (/hydration|requires a.*Title/i.test(message.text())) problems.push(message.text());
    });
  }
  try {
    const trainerId = await authenticate(trainer, "r4.trainer@example.test");
    const athleteId = await authenticate(athlete, "r4.athlete@example.test");
    // Only identity/capability setup uses SQL. All subsequent domain writes use production HTTP commands.
    await admin.query("UPDATE app.users SET display_name=$2 WHERE id=$1", [athleteId, "R4 Athlete"]);
    await admin.query("INSERT INTO app.trainer_profiles(user_id,status,activated_at) VALUES ($1,'active',clock_timestamp())", [trainerId]);
    await admin.query("INSERT INTO app.athlete_profiles(user_id,status) VALUES ($1,'active')", [athleteId]);
    const relationId = (await admin.query<{ id: string }>("INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true) RETURNING id", [trainerId, athleteId])).rows[0].id;
    const templateId = randomUUID(), revisionId = randomUUID(), title = "R4 две последовательные тренировки";
    const saved = await body<{ template: { editToken: string } }>(await trainer.request.post("/api/trainer/workout-builder/templates", { headers, data: {
      commandId: randomUUID(), templateId, revisionId, expectedEditToken: null,
      content: { id: templateId, revisionId, title, description: "R4 verification", category: "Сила", estimatedDurationMin: "30", generalInstruction: "",
        items: [{ id: "squat-item", kind: "exercise", exercise: { instanceId: "squat-instance", exerciseId: "r4-squat", title: "Приседание R4", category: "Сила", equipment: "Штанга",
          prescription: { type: "repetitions", sets: "3", repetitionMode: "fixed", repetitionsMin: "8", repetitionsMax: "8", durationSec: "", targetWeightKg: "50", restSec: "90" },
          perSetMode: false, setOverrides: [], trainerNote: "" } }] },
    } }));
    await body(await trainer.request.post(`/api/trainer/workout-builder/templates/${templateId}/publish`, { headers, data: { commandId: randomUUID(), revisionId, expectedEditToken: saved.template.editToken } }));
    async function current() { return (await body<{ collection: ClientWorkoutCollectionReadModel }>(await athlete.request.get("/api/client/workouts"))).collection; }
    async function start(assignmentId: string) { return (await body<{ session: WorkoutSession }>(await athlete.request.post("/api/workout-sessions", { headers, data: { assignmentId, clientTimezone: "Europe/Moscow", idempotencyKey: randomUUID() } }))).session; }
    async function assign(scheduledFor: string) {
      const q = await body<{ quickAssign: { athlete: { assignmentStateToken: string } } }>(await trainer.request.get(`/api/trainer/athletes/${athleteId}/quick-assign`));
      return (await body<{ assignment: { id: string } }>(await trainer.request.post("/api/workout-assignments", { headers, data: {
        assignmentId: randomUUID(), athleteUserId: athleteId, templateId, templateRevisionId: revisionId,
        scheduledFor, trainerNote: "", assignmentStateToken: q.quickAssign.athlete.assignmentStateToken,
        allowAdditionalAssignment: false, transitionContext: JSON.stringify({ version: 1, origin: "direct", athleteUserId: athleteId, tab: "training" }),
      } }))).assignment.id;
    }
    const cycles: Array<{ assignmentId: string; sessionId: string; attentionId: string; feedbackId: string }> = [];
    for (let cycle = 1; cycle <= 2; cycle++) {
      await test.step(`cycle ${cycle}: Dashboard/Profile -> Quick Assign -> exact client Assignment`, async () => {
        await athlete.goto("/client/me");
        await expect(athlete.getByText("Сейчас нет назначенной тренировки.", { exact: true })).toBeVisible();
        await trainer.goto("/trainer/dashboard");
        await expect(trainer.getByRole("region", { name: "Следующее решение" })).toBeVisible();
        const beforeAssignment = buildCanonicalTrainerDashboardView(
          await body<TrainerDashboardSnapshot>(await trainer.request.get("/api/trainer/dashboard")),
        ).clients.find((client) => client.id === athleteId);
        expect(beforeAssignment?.primaryAction).toBe("assign");
        await trainer.goto(`/trainer/clients/${athleteId}?tab=training`);
        const profileHeader = trainer.locator("header").filter({ has: trainer.getByRole("heading", { name: "R4 Athlete", exact: true }) });
        await expect(profileHeader.getByRole("link", { name: "Назначить тренировку", exact: true })).toBeVisible();
        await profileHeader.getByRole("link", { name: "Назначить тренировку", exact: true }).click();
        const sheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        const row = sheet.getByRole("radio", { name: new RegExp(title) });
        await expect(row).toHaveAttribute("data-template-revision-id", revisionId);
        await row.click();
        await sheet.getByRole("button", { name: "Сегодня", exact: true }).click();
        if (cycle === 1) await viewports(trainer, info, "quick-assign");
        await expect(sheet.getByRole("button", { name: "Назначить тренировку", exact: true })).toBeEnabled();
        const response = trainer.waitForResponse((r) => r.url().endsWith("/api/workout-assignments") && r.request().method() === "POST");
        await sheet.getByRole("button", { name: "Назначить тренировку", exact: true }).focus();
        await trainer.keyboard.press("Enter");
        const assigned = await body<{ assignment: { id: string; sourceRevisionId: string } }>(await response);
        expect(assigned.assignment.sourceRevisionId).toBe(revisionId);
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("quick-assign-receipt-heading");
        const assignmentId = assigned.assignment.id;
        const c = await current();
        expect(c.assignments.map((a) => a.assignmentId)).toContain(assignmentId);
        // Characterization, not desired behavior: focus refreshes feedback, but not current assignments.
        const focusRead = athlete.waitForResponse((r) => r.url().includes("/api/client/feedback?mode=latest"));
        await athlete.evaluate(() => window.dispatchEvent(new Event("focus")));
        await focusRead;
        await expect(athlete.getByText("Сейчас нет назначенной тренировки.", { exact: true })).toBeVisible();
        observations.homeStaleOnFocus = true;
        await athlete.reload();
        const link = athlete.locator(`a[href*="assignment=${assignmentId}"]`).first();
        await expect(link).toBeVisible();
        await link.click();
        const started = athlete.waitForResponse((r) => r.url().endsWith("/api/workout-sessions") && r.request().method() === "POST");
        await athlete.getByRole("button", { name: /Начать тренировку/ }).click();
        const session = (await body<{ session: WorkoutSession }>(await started)).session;
        expect(session.assignmentId).toBe(assignmentId);
        expect((await admin.query("SELECT relation_id FROM app.workout_sessions WHERE id=$1", [session.id])).rows[0].relation_id).toBe(relationId);
        cycles.push({ assignmentId, sessionId: session.id, attentionId: "", feedbackId: "" });
      });
      const item = cycles[cycle - 1];
      await test.step(`cycle ${cycle}: valid multi-Set command -> reload -> Skip -> Complete`, async () => {
        const s = (await body<{ session: WorkoutSession }>(await athlete.request.get(`/api/workout-sessions/${item.sessionId}`))).session;
        const sets = s.exercises[0].sets;
        const payload = { expectedVersion: s.version, idempotencyKey: randomUUID(), sets: sets.slice(0, 2).map((set, index) => ({
          setLogId: set.id, status: "completed", actualRepetitions: 8 + cycle, actualDurationSeconds: null,
          actualWeightKg: index === 0 ? 55 : null, rpe: 8, athleteComment: `R4 cycle ${cycle}, set ${index + 1}`,
        })) };
        const persisted = await body<{ session: WorkoutSession }>(await athlete.request.post(`/api/workout-sessions/${s.id}/progress`, { headers, data: payload }));
        expect(persisted.session.version).toBe(s.version + 1);
        expect((await body<{ session: WorkoutSession }>(await athlete.request.post(`/api/workout-sessions/${s.id}/progress`, { headers, data: payload }))).session).toEqual(persisted.session);
        await athlete.reload();
        await expect(athlete).toHaveURL(new RegExp(`session=${s.id}`));
        for (const set of sets.slice(0, 2)) await expect(athlete.locator(`#workout-set-${set.id}`).getByLabel("Повторы", { exact: true })).toHaveValue(String(8 + cycle));
        if (cycle === 1) await viewports(athlete, info, "execution");
        await athlete.getByRole("button", { name: "Пропустить подход 3", exact: true }).click();
        await expect(athlete.getByText("Подход отмечен как пропущенный", { exact: true })).toBeVisible();
        await athlete.getByRole("button", { name: "Завершить", exact: true }).click();
        const dialog = athlete.getByRole("dialog", { name: "Завершить тренировку", exact: true });
        await dialog.getByRole("radio", { name: cycle === 1 ? "Да" : "Нет", exact: true }).check();
        if (cycle === 1) await dialog.getByLabel("Опишите, что почувствовали").fill("R4 explicit discomfort");
        await dialog.getByLabel("Комментарий тренеру (необязательно)").fill(`R4 cycle ${cycle}: ${"длинный комментарий ".repeat(12)}`);
        if (cycle === 1) await viewports(athlete, info, "completion");
        const complete = athlete.waitForResponse((r) => r.url().endsWith(`/api/workout-sessions/${s.id}/complete`) && r.request().method() === "POST");
        await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
        const terminal = (await body<{ session: WorkoutSession }>(await complete)).session;
        expect(terminal.id).toBe(s.id);
        expect(terminal.status).toBe("completed_with_omissions");
        expect(terminal.completion?.discomfortReported).toBe(cycle === 1);
        await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();
      });
      await test.step(`cycle ${cycle}: exact Queue/Review -> Feedback -> client latest/detail/history`, async () => {
        const queue = await body<{ items: TrainerReviewQueueItem[] }>(await trainer.request.get("/api/trainer/reviews"));
        const rows = queue.items.filter((row) => row.sessionId === item.sessionId);
        expect(rows).toHaveLength(1);
        item.attentionId = rows[0].id;
        const reviewDashboard = buildCanonicalTrainerDashboardView(
          await body<TrainerDashboardSnapshot>(await trainer.request.get("/api/trainer/dashboard")),
        ).clients.find((client) => client.id === athleteId);
        expect(reviewDashboard?.primaryAction).toBe("review");
        await trainer.goto(`/trainer/clients/${athleteId}?tab=overview`);
        const profileHeader = trainer.locator("header").filter({ has: trainer.getByRole("heading", { name: "R4 Athlete", exact: true }) });
        await expect(profileHeader.getByRole("link", { name: "Разобрать тренировку", exact: true })).toBeVisible();
        await trainer.goto("/trainer/attention");
        await trainer.locator(`a[href*="/trainer/review/${item.sessionId}"]`).click();
        await expect(trainer.getByText(`R4 cycle ${cycle}, set 1`, { exact: true }).first()).toBeVisible();
        if (cycle === 1) await expect(trainer.getByText("R4 explicit discomfort", { exact: true }).first()).toBeVisible();
        const feedbackText = `R4 feedback ${cycle}: ${"Сохраняем технику и темп. ".repeat(12)}`.trim();
        await trainer.getByLabel("Сообщение спортсмену").fill(feedbackText);
        if (cycle === 1) await viewports(trainer, info, "review");
        const send = trainer.waitForResponse((r) => r.url().endsWith(`/api/trainer/reviews/${item.sessionId}/feedback`) && r.request().method() === "POST");
        await trainer.getByRole("button", { name: "Отправить ответ", exact: true }).focus();
        await trainer.keyboard.press("Enter");
        const f = (await body<{ feedback: ReviewFeedback }>(await send)).feedback;
        expect(f).toMatchObject({ sessionId: item.sessionId, attentionItemId: item.attentionId, athleteUserId: athleteId, trainerUserId: trainerId, body: feedbackText });
        item.feedbackId = f.id;
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("review-completion-receipt-heading");
        await athlete.goto("/client/me");
        const latestLink = athlete.getByRole("link", { name: "Посмотреть ответ", exact: true });
        await expect(latestLink).toHaveAttribute("href", new RegExp(`session=${item.sessionId}&feedback=${f.id}`));
        await latestLink.click();
        await expect(athlete.locator(`[data-feedback-id="${f.id}"]`)).toContainText(feedbackText);
        await expect(athlete.locator(`#feedback-${f.id}`)).toBeFocused();
        if (cycle === 1) await viewports(athlete, info, "completed-detail");
        await athlete.goto("/client/workouts");
        await expect(athlete.locator('a[id^="workout-"]')).toHaveCount(cycle);
        const row = athlete.locator(`#workout-${item.sessionId}`);
        if (cycle === 1) await viewports(athlete, info, "history");
        await row.click();
        await expect(athlete.locator(`[data-feedback-id="${f.id}"]`)).toContainText(feedbackText);
        await athlete.getByRole("link", { name: "К тренировкам", exact: true }).first().click();
        await expect(row).toBeFocused();
      });
    }
    expect(new Set(cycles.map((c) => c.sessionId)).size).toBe(2);
    expect(new Set(cycles.map((c) => c.assignmentId)).size).toBe(2);
    expect(new Set(cycles.map((c) => c.feedbackId)).size).toBe(2);
    observations.cycles = cycles;

    await test.step("P2-C: exact client destination survives authentication and unsafe context is rejected", async () => {
      const guest = await browser.newContext({ baseURL });
      try {
        const page = await guest.newPage();
        const exactSession = `/client/workouts?session=${cycles[0].sessionId}&returnTo=${encodeURIComponent("/client/workouts#history")}`;
        await page.goto(exactSession);
        await expect(page).toHaveURL(/\/login\?/);
        expect(new URL(page.url()).searchParams.get("next")).toBe(exactSession);
        const requested = page.waitForResponse((response) => response.url().endsWith("/api/auth/email/request") && response.request().method() === "POST");
        await page.getByLabel("Email", { exact: true }).fill("r4.athlete@example.test");
        await page.getByRole("button", { name: "Получить код", exact: true }).click();
        const challenge = await body<{ developmentCode: string }>(await requested);
        await page.getByLabel("Код из письма", { exact: true }).fill(challenge.developmentCode);
        await page.getByRole("button", { name: "Продолжить", exact: true }).click();
        await page.getByRole("link", { name: "Продолжить", exact: true }).click();
        await expect(page).toHaveURL(`${baseURL}${exactSession}`);
        await expect(page.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();

        await guest.clearCookies();
        const exactAssignment = `/client/workouts?assignment=${cycles[0].assignmentId}`;
        await page.goto(exactAssignment);
        await expect(page).toHaveURL(/\/login\?/);
        expect(new URL(page.url()).searchParams.get("next")).toBe(exactAssignment);

        const unsafe = `/client/workouts?session=${cycles[0].sessionId}&returnTo=${encodeURIComponent("https://outside.example")}`;
        await page.goto(unsafe);
        await expect(page).toHaveURL(/\/login\?/);
        expect(new URL(page.url()).searchParams.get("next")).toBe("/client/me");
        observations.authReturn = { exactSession, exactAssignment, unsafeFallback: "/client/me" };
      } finally { await guest.close(); }
    });
    await test.step("P2-D: exact read offers local Retry for transport failures only", async () => {
      await athlete.route("**/api/client/workouts?**", (route) => route.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }), { times: 1 });
      await athlete.goto(`/client/workouts?session=${cycles[0].sessionId}`);
      const loadError = athlete.getByRole("heading", { name: "Не удалось загрузить тренировку", exact: true });
      await expect(loadError).toBeVisible();
      await expect(loadError).toBeFocused();
      await responsiveGate(athlete, info, "exact-load-error", loadError);
      await athlete.getByRole("button", { name: "Повторить", exact: true }).click();
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();

      await athlete.route("**/api/client/workouts?**", (route) => route.abort("failed"), { times: 1 });
      await athlete.goto(`/client/workouts?session=${cycles[1].sessionId}`);
      await expect(athlete.getByRole("heading", { name: "Не удалось загрузить тренировку", exact: true })).toBeVisible();
      await athlete.getByRole("button", { name: "Повторить", exact: true }).click();
      await expect(athlete.getByRole("heading", { name: "Тренировка завершена", exact: true })).toBeVisible();

      await athlete.goto(`/client/workouts?session=${randomUUID()}`);
      await expect(athlete.getByRole("heading", { name: "Тренировка недоступна", exact: true })).toBeVisible();
      await expect(athlete.getByRole("button", { name: "Повторить", exact: true })).toHaveCount(0);
      observations.exactReadFailures = { server: "retry recovered", network: "retry recovered", notFound: "terminal unavailable" };
    });
    await test.step("P1-B: Dashboard and Profile share no primary action for an active Session", async () => {
      const active = await start(await assign("2026-10-01"));
      const snapshot = await body<TrainerDashboardSnapshot>(await trainer.request.get("/api/trainer/dashboard"));
      const view = buildCanonicalTrainerDashboardView(snapshot);
      const dashboardAthlete = view.clients.find((client) => client.id === athleteId);
      expect(dashboardAthlete?.state).toBe("on_track");
      expect(dashboardAthlete?.primaryAction).toBeUndefined();
      await trainer.goto("/trainer/dashboard");
      await responsiveGate(trainer, info, "trainer-dashboard", trainer.getByRole("heading", { name: "Команда", exact: true }));
      await trainer.goto(`/trainer/clients/${athleteId}?tab=training`);
      const profileHeader = trainer.locator("header").filter({ has: trainer.getByRole("heading", { name: "R4 Athlete", exact: true }) });
      await expect(profileHeader.getByRole("link", { name: /Назначить тренировку|Разобрать тренировку/ })).toHaveCount(0);
      await responsiveGate(trainer, info, "athlete-profile", trainer.getByRole("heading", { name: "R4 Athlete", exact: true }));
      observations.primaryAction = { sessionId: active.id, dashboard: null, profile: null };
    });
    await test.step("P1-A: every active Session is reachable through bounded current-workout pagination", async () => {
      let hidden: WorkoutSession | null = null;
      for (let day = 2; day <= 21; day++) hidden = await start(await assign(`2026-10-${String(day).padStart(2, "0")}`));
      expect(hidden).not.toBeNull();
      const c = await current();
      expect(c.assignments).toHaveLength(20);
      expect(c.hasMore).toBe(true);
      expect(c.pageInfo.hasNextPage).toBe(true);
      expect(c.pageInfo.startCursor).toBeTruthy();
      expect(c.pageInfo.endCursor).toBeTruthy();
      expect(c.assignments.every((a) => a.session?.status === "active")).toBe(true);
      expect(c.assignments.some((a) => a.session?.sessionId === hidden!.id)).toBe(false);
      await athlete.goto("/client/workouts");
      const currentWorkouts = athlete.getByRole("region", { name: "Текущие и ближайшие" });
      await expect(currentWorkouts).toBeVisible();
      await expect(currentWorkouts.locator('article[id^="current-workout-"]')).toHaveCount(20);
      await expect(athlete.locator(`a[href*="session=${hidden!.id}"]`)).toHaveCount(0);
      await athlete.route("**/api/client/workouts?currentAfter=*", (route) => route.fulfill({ status: 503, json: { error: "temporarily_unavailable" } }), { times: 1 });
      await currentWorkouts.getByRole("button", { name: "Показать ещё", exact: true }).click();
      await expect(currentWorkouts.getByRole("alert")).toContainText("Не удалось загрузить следующую часть");
      await expect(currentWorkouts.locator('article[id^="current-workout-"]')).toHaveCount(20);
      await currentWorkouts.getByRole("button", { name: "Повторить", exact: true }).click();
      const hiddenLink = currentWorkouts.locator(`a[href*="session=${hidden!.id}"]`);
      await expect(hiddenLink).toBeVisible();
      await expect(currentWorkouts.locator('article[id^="current-workout-"]')).toHaveCount(21);
      await expect(currentWorkouts.getByText("Все тренировки показаны", { exact: true })).toBeVisible();
      await responsiveGate(athlete, info, "client-workouts", currentWorkouts);
      expect(new URL(athlete.url()).searchParams.get("currentDepth")).toBe("2");
      expect(new URL(athlete.url()).searchParams.get("currentStart")).toBeTruthy();
      await hiddenLink.click();
      await expect(athlete).toHaveURL(new RegExp(`session=${hidden!.id}`));
      await athlete.getByRole("link", { name: "Мои тренировки", exact: true }).click();
      const hiddenRow = athlete.locator(`#current-workout-${hidden!.assignmentId}`);
      await expect(hiddenRow).toBeFocused();
      await expect(athlete.locator('article[id^="current-workout-"]')).toHaveCount(21);
      expect(new URL(athlete.url()).searchParams.get("currentDepth")).toBe("2");
      await athlete.reload();
      await expect(hiddenRow).toBeFocused();
      await expect(athlete.locator('article[id^="current-workout-"]')).toHaveCount(21);
      expect((await body<{ session: WorkoutSession }>(await athlete.request.get(`/api/workout-sessions/${hidden!.id}`))).session.status).toBe("active");
      await athlete.goto("/client/me");
      await responsiveGate(athlete, info, "client-home", athlete.getByRole("heading", { name: "Что делаем сейчас", exact: true }));
      const expectedHomeSession = c.assignments[0].session?.sessionId;
      expect(expectedHomeSession).toBeTruthy();
      await expect(athlete.locator(`a[href*="session=${expectedHomeSession}"]`).first()).toBeVisible();
      observations.currentPagination = { sessionId: hidden!.id, assignmentId: hidden!.assignmentId, initial: 20, appended: 21, restoredDepth: 2, hasMore: false };
    });
    await test.step("two browser tabs: stale Save cannot replace first committed Set", async () => {
      const sessionId = (await current()).assignments[0].session!.sessionId;
      const s = (await body<{ session: WorkoutSession }>(await athlete.request.get(`/api/workout-sessions/${sessionId}`))).session;
      const second = await ac.newPage();
      try {
        await athlete.goto(`/client/workouts?session=${sessionId}`);
        await second.goto(`/client/workouts?session=${sessionId}`);
        const row = athlete.locator(`#workout-set-${s.exercises[0].sets[0].id}`);
        const staleRow = second.locator(`#workout-set-${s.exercises[0].sets[0].id}`);
        await row.getByLabel("Повторы", { exact: true }).fill("7");
        await staleRow.getByLabel("Повторы", { exact: true }).fill("8");
        await row.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(row.getByText("Подход сохранён", { exact: true })).toBeVisible();
        const rejected = second.waitForResponse((r) => r.url().endsWith(`/api/workout-sessions/${sessionId}/progress`) && r.request().method() === "POST");
        await staleRow.getByRole("button", { name: "Сохранить", exact: true }).click();
        expect((await rejected).status()).toBe(409);
        await expect(staleRow.getByRole("button", { name: "Продолжить редактирование", exact: true })).toBeVisible();
        await expect(staleRow.getByLabel("Повторы", { exact: true })).toHaveValue("8");
        await expect(staleRow).toBeFocused();
        const stored = (await body<{ session: WorkoutSession }>(await athlete.request.get(`/api/workout-sessions/${sessionId}`))).session;
        expect(stored.version).toBe(s.version + 1);
        expect(stored.exercises[0].sets[0].actualRepetitions).toBe(7);
        await second.reload();
        await expect(staleRow.getByLabel("Повторы", { exact: true })).toHaveValue("7");
        observations.twoTabStaleSave = { sessionId, status: 409, persisted: 7, rejectedLocal: 8 };
      } finally { await second.close(); }
    });
    expect(supabaseRequests).toEqual([]);
    observations.supabaseRequests = supabaseRequests.length;
    observations.accessibilityWarnings = warnings;
    expect(problems).toEqual([]);
    console.log("R4 two-cycle/P2 evidence", JSON.stringify(observations));
    await info.attach("r4-observations", { body: JSON.stringify(observations, null, 2), contentType: "application/json" });
  } finally {
    await admin.end();
    await tc.close();
    await ac.close();
  }
});
