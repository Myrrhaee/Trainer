import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Pool } from "pg";

import { formatQuickAssignCalendarDate } from "../../components/trainer/quick-assign/quick-assign-presentation";

const execFile = promisify(execFileCallback);
const baseURL = "http://127.0.0.1:3101";
const trainerEmail = "trainer.e2e@example.test";
const athleteOneEmail = "athlete.one.e2e@example.test";
const athleteTwoEmail = "athlete.two.e2e@example.test";
const trainerName = "Тренер E2E";
const athleteOneName = "Анна E2E";
const athleteTwoName = "Иван E2E";
const workoutTitle = "B14 контрольная тренировка";
const feedbackText = "B14: результат проверен, сохраняем технику и спокойный рабочий темп.";
const followUpText = "Уточнение: на следующей тренировке оставляем тот же рабочий вес.";

test.describe("Canonical three-role closed-alpha flow", () => {
  test("guest routes fail closed and preserve a safe role destination", async ({ browser }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    const errors = observeRuntimeErrors(page);
    try {
      await page.goto("/trainer/dashboard");
      await expect(page).toHaveURL(/\/login\?next=%2Ftrainer%2Fdashboard/);
      await expect(page.getByRole("heading", { name: "Вход или регистрация" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Продолжить с Google" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Продолжить с Telegram" })).toHaveCount(0);
      await expect(page.getByText("или email", { exact: true })).toHaveCount(0);

      await page.goto("/client/me");
      await expect(page).toHaveURL(/\/login\?next=%2Fclient%2Fme/);
      await expect(page.getByRole("heading", { name: "Вход или регистрация" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("operator, trainer and two isolated athletes complete the canonical workflow", async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const trainerContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
    const athleteOneContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const athleteTwoContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    contexts.push(trainerContext, athleteOneContext, athleteTwoContext);
    const trainer = await trainerContext.newPage();
    const athleteOne = await athleteOneContext.newPage();
    const athleteTwo = await athleteTwoContext.newPage();
    const observed: string[] = [];
    let athleteOneId = "";
    let athleteTwoId = "";
    let athleteOneRelationId = "";
    let athleteOneProfilePath = "";
    let templateId = "";
    let assignmentId = "";
    let durationExerciseTitle = "";
    [trainer, athleteOne, athleteTwo].forEach((page) => observeRuntimeErrors(page, observed));

    try {
      await test.step("trainer registers, requests access and sees operator activation", async () => {
        await trainer.goto("/login");
        await signInWithDevelopmentOtp(trainer, trainerEmail);
        await expect(trainer).toHaveURL(/\/onboarding$/);
        await saveDisplayName(trainer, trainerName);
        await trainer.getByRole("button", { name: "Запросить доступ" }).click();
        await expect(trainer.getByText("Заявка ожидает активации", { exact: true })).toBeVisible();

        const activation = await runOperator(["activate-trainer", "--email", trainerEmail]);
        expect(activation).toContain("Trainer activation: ACTIVATED");
        await trainer.getByRole("button", { name: "Проверить доступ" }).click();
        await expect(trainer.getByRole("link", { name: "Открыть кабинет" })).toBeVisible();
        await trainer.getByRole("link", { name: "Открыть кабинет" }).click();
        await expect(trainer).toHaveURL(/\/trainer\/dashboard$/);
        await expect(trainer.getByRole("heading", { name: "Команда", exact: true })).toBeVisible();

        const libraryResponse = await trainer.request.get("/api/trainer/exercises?first=5");
        expect(libraryResponse.status()).toBe(200);
        const libraryBody = await libraryResponse.json() as {
          exerciseLibrary: { items: Array<{ exerciseId: string; scope: string }> };
        };
        expect(libraryBody.exerciseLibrary.items).toHaveLength(5);
        expect(libraryBody.exerciseLibrary.items.every((item) => item.scope === "system")).toBe(true);
        const detailResponse = await trainer.request.get(
          `/api/trainer/exercises/${libraryBody.exerciseLibrary.items[0].exerciseId}`,
        );
        expect(detailResponse.status()).toBe(200);
      });

      let athleteOneInvite = "";
      let athleteTwoInvite = "";
      await test.step("trainer creates two independent invitation links", async () => {
        await trainer.goto("/trainer/clients");
        await expect(trainer.getByRole("heading", { name: "Спортсмены", exact: true })).toBeVisible();
        athleteOneInvite = await createInvitation(trainer);
        athleteTwoInvite = await createInvitation(trainer);
        expect(athleteOneInvite).not.toBe(athleteTwoInvite);
      });

      await test.step("two athletes register and accept only their own invitation", async () => {
        await registerAthlete(athleteOne, athleteOneInvite, athleteOneEmail, athleteOneName);
        await registerAthlete(athleteTwo, athleteTwoInvite, athleteTwoEmail, athleteTwoName);
        expect((await athleteOne.request.get("/api/trainer/exercises")).status()).toBe(403);
        await expectNoHorizontalOverflow(athleteOne);
        await expectNoHorizontalOverflow(athleteTwo);

        const status = await runOperator([
          "status",
          "--trainer-email", trainerEmail,
          "--athlete-email", athleteOneEmail,
          "--athlete-email", athleteTwoEmail,
        ]);
        expect(status).toContain("Local pilot readiness: READY");
        expect(status).not.toContain("BLOCKER");
      });

      await test.step("trainer sees canonical names and assigns a workout", async () => {
        await trainer.goto("/trainer/clients");
        const athleteOneRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        const athleteTwoRow = trainer.getByRole("row", { name: new RegExp(athleteTwoName) });
        await expect(athleteOneRow).toBeVisible();
        await expect(athleteTwoRow).toBeVisible();
        const athleteTwoHref = await athleteTwoRow.getByRole("link", { name: athleteTwoName, exact: true }).getAttribute("href");
        athleteTwoId = athleteTwoHref?.split("/").at(-1) ?? "";
        expect(athleteTwoId).not.toBe("");
        await athleteOneRow.getByRole("button", { name: `Назначить тренировку для ${athleteOneName}` }).click();
        const sheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(sheet).toBeVisible();
        athleteOneProfilePath = new URL(trainer.url()).pathname;
        athleteOneId = athleteOneProfilePath.split("/").at(-1) ?? "";
        await expect(sheet.getByText("Нет опубликованных шаблонов", { exact: true })).toBeVisible();
        await sheet.getByRole("button", { name: "Создать шаблон", exact: true }).click();
        await expect.poll(() => {
          const url = new URL(trainer.url());
          return [url.pathname, Boolean(url.searchParams.get("handoff")), Boolean(url.searchParams.get("returnTo"))];
        }).toEqual(["/trainer/builder/new", true, true]);
        await expect(trainer.getByText("Вы создаёте шаблон для последующего назначения", { exact: true })).toBeVisible();
        await trainer.getByLabel("Название", { exact: true }).fill(workoutTitle);
        await trainer.getByRole("button", { name: "Добавить упражнение" }).first().click();
        const library = trainer.getByRole("dialog", { name: "Библиотека упражнений" });
        const libraryExercise = library.getByRole("list", { name: "Упражнения" }).getByRole("button").first();
        const exerciseTitle = (await libraryExercise.locator("p").first().textContent())?.trim() ?? "";
        expect(exerciseTitle).not.toBe("");
        await libraryExercise.click();
        const exerciseDetail = trainer.getByRole("dialog", { name: exerciseTitle });
        await exerciseDetail.getByRole("button", { name: "Добавить упражнение" }).click();
        const exerciseRow = trainer.getByRole("list", { name: "Упражнения шаблона" }).getByRole("listitem").first();
        const exerciseDisclosure = exerciseRow.locator('button[aria-expanded]');
        if (await exerciseDisclosure.getAttribute("aria-expanded") !== "true") await exerciseDisclosure.click();
        await expect(exerciseDisclosure).toHaveAttribute("aria-expanded", "true");
        await exerciseRow.getByLabel("Подходы").fill("1");
        await exerciseRow.getByLabel("Повторения", { exact: true }).fill("8");
        await exerciseRow.getByLabel("Отдых, сек").fill("90");
        await trainer.getByRole("button", { name: "Добавить упражнение" }).first().click();
        const secondLibrary = trainer.getByRole("dialog", { name: "Библиотека упражнений" });
        const durationLibraryExercise = secondLibrary.getByRole("list", { name: "Упражнения" }).getByRole("button").nth(1);
        durationExerciseTitle = (await durationLibraryExercise.locator("p").first().textContent())?.trim() ?? "";
        expect(durationExerciseTitle).not.toBe("");
        await durationLibraryExercise.click();
        const durationExerciseDetail = trainer.getByRole("dialog", { name: durationExerciseTitle });
        await durationExerciseDetail.getByRole("button", { name: "Добавить упражнение" }).click();
        const durationExerciseRow = trainer.getByRole("list", { name: "Упражнения шаблона" }).getByRole("listitem").nth(1);
        const durationDisclosure = durationExerciseRow.locator('button[aria-expanded]');
        if (await durationDisclosure.getAttribute("aria-expanded") !== "true") await durationDisclosure.click();
        await durationExerciseRow.getByLabel("Формат").selectOption("duration");
        await durationExerciseRow.getByLabel("Подходы").fill("1");
        await durationExerciseRow.getByLabel("Длительность, сек").fill("30");
        await durationExerciseRow.getByLabel("Отдых, сек").fill("60");
        expect((await athleteOne.request.get("/api/workout-assignments")).status()).toBe(200);
        expect((await (await athleteOne.request.get("/api/workout-assignments")).json() as { assignments: unknown[] }).assignments).toHaveLength(0);
        await trainer.getByRole("button", { name: "Сохранить черновик" }).click();
        await expect(trainer).toHaveURL(/\/trainer\/builder\/[0-9a-f-]{36}\?.*handoff=/);
        templateId = new URL(trainer.url()).pathname.split("/").at(-1) ?? "";
        await trainer.reload();
        await expect(trainer.getByLabel("Название", { exact: true })).toHaveValue(workoutTitle);
        await expect(trainer.getByText("Вы создаёте шаблон для последующего назначения", { exact: true })).toBeVisible();
        await trainer.getByRole("button", { name: "Опубликовать" }).click();
        const publishReceipt = trainer.getByRole("main").filter({ has: trainer.getByRole("heading", { name: "Шаблон опубликован" }) });
        await expect(publishReceipt.getByText("Назначение спортсмену подтверждается отдельно.", { exact: false })).toBeVisible();
        expect((await (await athleteOne.request.get("/api/workout-assignments")).json() as { assignments: unknown[] }).assignments).toHaveLength(0);
        await publishReceipt.getByRole("button", { name: "Перейти к назначению" }).click();
        await expect(trainer).toHaveURL(new RegExp(`/trainer/clients/${athleteOneId}\\?tab=training&assign=1.*handoff=`));
        const returnedSheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(returnedSheet).toBeVisible();
        const selectedTemplate = returnedSheet.getByRole("radio", { name: new RegExp(workoutTitle) });
        await expect(selectedTemplate).toHaveAttribute("aria-checked", "true");
        const publishedRevisionId = await selectedTemplate.getAttribute("data-template-revision-id");
        expect(publishedRevisionId).toMatch(/^[0-9a-f-]{36}$/);
        await expect(returnedSheet.getByText(workoutTitle, { exact: true }).last()).toBeVisible();
        await returnedSheet.getByRole("button", { name: "Сегодня" }).click();
        await returnedSheet.getByLabel("Заметка спортсмену").fill("Остановись с запасом в два повтора.");
        const assignmentResponsePromise = trainer.waitForResponse((response) => response.url().endsWith("/api/workout-assignments") && response.request().method() === "POST");
        await returnedSheet.getByRole("button", { name: "Назначить тренировку", exact: true }).click();
        const assignmentResponse = await assignmentResponsePromise;
        expect(assignmentResponse.status()).toBe(201);
        const assignmentResult = await assignmentResponse.json() as { assignment: { id: string; sourceRevisionId: string } };
        assignmentId = assignmentResult.assignment.id;
        expect(assignmentResult.assignment.sourceRevisionId).toBe(publishedRevisionId);
        const athleteAssignments = await (await athleteOne.request.get("/api/workout-assignments")).json() as { assignments: Array<{ id: string; sourceRevisionId: string; title: string }> };
        expect(athleteAssignments.assignments[0]).toMatchObject({ id: assignmentResult.assignment.id, title: workoutTitle });
        expect(athleteAssignments.assignments[0].sourceRevisionId).toBe(publishedRevisionId);
        await expect(returnedSheet.getByRole("status").getByText("Тренировка назначена", { exact: true })).toBeVisible();
        await returnedSheet.getByRole("link", { name: "К списку спортсменов", exact: true }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients/);
      });

      await test.step("trainer opens the canonical athlete profile and URL-driven tabs", async () => {
        const athleteRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        await athleteRow.getByRole("link", { name: athleteOneName, exact: true }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients\/[0-9a-f-]+$/);
        athleteOneProfilePath = new URL(trainer.url()).pathname;
        athleteOneId = athleteOneProfilePath.split("/").at(-1) ?? athleteOneId;
        await expect(trainer.getByRole("heading", { name: athleteOneName, exact: true })).toBeVisible();
        await expect(trainer.getByText("Тренировка назначена", { exact: true })).toBeVisible();
        await trainer.getByRole("link", { name: "Тренировки", exact: true }).click();
        await expect(trainer).toHaveURL(/\?tab=training$/);
        await expect(trainer.getByRole("heading", { name: "Работа сейчас", exact: true })).toBeVisible();
        await expect(trainer.getByRole("region", { name: "Работа сейчас" }).getByText(workoutTitle, { exact: true })).toBeVisible();
        await trainer.reload();
        await expect(trainer).toHaveURL(/\?tab=training$/);
        await expect(trainer.getByRole("heading", { name: "Работа сейчас", exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(trainer);
      });

      let sessionPath = "";
      await test.step("assigned athlete completes the workout on mobile", async () => {
        await athleteOne.goto("/client/workouts?assignment=99999999-9999-4999-8999-999999999999");
        await expect(athleteOne.getByRole("heading", { name: "Тренировка недоступна" })).toBeVisible();
        await expect(athleteOne.getByText(workoutTitle, { exact: true })).toHaveCount(0);
        await athleteTwo.goto(`/client/workouts?assignment=${assignmentId}`);
        await expect(athleteTwo.getByRole("heading", { name: "Тренировка недоступна" })).toBeVisible();
        await expect(athleteTwo.getByText(workoutTitle, { exact: true })).toHaveCount(0);
        const expectedUnavailableConsole = (error: string) => error === "console:/client/workouts:Failed to load resource: the server responded with a status of 404 (Not Found)";
        await expect.poll(() => observed.filter(expectedUnavailableConsole).length).toBe(2);
        removeObserved(observed, expectedUnavailableConsole);
        await athleteOne.goto("/client/me");
        await expect(athleteOne.getByText(workoutTitle, { exact: true })).toBeVisible();
        await athleteOne.getByRole("link", { name: "Начать тренировку" }).click();
        const startCommandIds: string[] = [];
        let startRequestCount = 0;
        await athleteOne.route("**/api/workout-sessions", async (route) => {
          if (route.request().method() !== "POST") return route.continue();
          startRequestCount += 1;
          startCommandIds.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey);
          if (startRequestCount === 1) {
            await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
            return;
          }
          const persisted = await route.fetch();
          await route.fulfill({ response: persisted, status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
        });
        await athleteOne.getByRole("button", { name: "Начать тренировку" }).click();
        await expect(athleteOne.getByText("Не удалось подтвердить, началась ли тренировка.", { exact: true })).toBeVisible();
        await athleteOne.getByRole("button", { name: "Проверить" }).click();
        await expect.poll(() => startRequestCount).toBe(2);
        expect(new Set(startCommandIds).size).toBe(1);
        await expect(athleteOne.getByText("Не удалось подтвердить, началась ли тренировка.", { exact: true })).toBeVisible();
        await athleteOne.unroute("**/api/workout-sessions");
        await athleteOne.getByRole("button", { name: "Проверить" }).click();
        await expect(athleteOne).toHaveURL(/\/client\/workouts\?session=[0-9a-f-]{36}&returnTo=%2Fclient%2Fme/);
        const startedSessionId = new URL(athleteOne.url()).searchParams.get("session");
        expect(startedSessionId).toMatch(/^[0-9a-f-]{36}$/);
        sessionPath = `/client/workouts?session=${startedSessionId}`;
        await athleteOne.reload();
        await expect(athleteOne.getByText("Тренировка идёт", { exact: true })).toBeVisible();
        await athleteOne.getByRole("link", { name: "Мои тренировки" }).click();
        await expect(athleteOne).toHaveURL(/\/client\/me$/);
        await athleteOne.getByRole("link", { name: "Продолжить тренировку" }).click();
        await expect(athleteOne).toHaveURL(new RegExp(`session=${startedSessionId}`));
        await athleteOne.goBack();
        await expect(athleteOne).toHaveURL(/\/client\/me$/);
        await athleteOne.goForward();
        await expect(athleteOne).toHaveURL(new RegExp(`session=${startedSessionId}`));
        const secondTab = await athleteOneContext.newPage();
        observeRuntimeErrors(secondTab, observed);
        await secondTab.goto("/client/me");
        await secondTab.getByRole("link", { name: "Продолжить тренировку" }).click();
        await expect(secondTab).toHaveURL(new RegExp(`session=${startedSessionId}`));
        await secondTab.close();
        const expectedStartFailure = (error: string) => error === "http:503:/api/workout-sessions";
        expect(observed.filter(expectedStartFailure)).toHaveLength(2);
        removeObserved(observed, expectedStartFailure);
        const expectedStartConsole = (error: string) => error === "console:/client/workouts:Failed to load resource: the server responded with a status of 503 (Service Unavailable)";
        expect(observed.filter(expectedStartConsole)).toHaveLength(2);
        removeObserved(observed, expectedStartConsole);
        await athleteOne.getByLabel("Повторы", { exact: true }).fill("8");
        await athleteOne.getByLabel("RPE", { exact: true }).fill("7");
        await athleteOne.getByLabel("Комментарий", { exact: true }).fill("B14: подход выполнен через мобильный сценарий.");
        const progressPattern = "**/api/workout-sessions/*/progress";
        const progressCommandIds: string[] = [];
        let progressRequests = 0;
        await athleteOne.route(progressPattern, async (route) => {
          progressRequests += 1;
          progressCommandIds.push((route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey);
          if (progressRequests === 1) {
            await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
            return;
          }
          await route.continue();
        });
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Не удалось подтвердить, сохранился ли подход.", { exact: true })).toBeVisible();
        await expect(athleteOne.getByLabel("Повторы", { exact: true })).toHaveValue("8");
        await athleteOne.getByRole("button", { name: "Проверить", exact: true }).click();
        await expect.poll(() => progressRequests).toBe(2);
        expect(new Set(progressCommandIds).size).toBe(1);
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();
        await athleteOne.unroute(progressPattern);
        removeObserved(observed, (item) => item === "http:503:/api/workout-sessions/" + startedSessionId + "/progress");
        removeObserved(observed, (item) => item.startsWith("console:/client/workouts:Failed to load resource") && item.includes("503"));
        await athleteOne.reload();
        await expect(athleteOne.getByLabel("Повторы", { exact: true })).toHaveValue("8");

        await athleteOne.getByLabel("Повторы", { exact: true }).fill("9");
        let knownFailureCommand = "";
        await athleteOne.route(progressPattern, async (route) => {
          knownFailureCommand = (route.request().postDataJSON() as { idempotencyKey: string }).idempotencyKey;
          await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "invalid_number" }) });
        });
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Не удалось сохранить подход. Введённые значения сохранены на экране.", { exact: true })).toBeVisible();
        await expect(athleteOne.getByLabel("Повторы", { exact: true })).toHaveValue("9");
        await athleteOne.unroute(progressPattern);
        const retryRequest = athleteOne.waitForRequest((request) => request.url().includes("/progress") && request.method() === "POST");
        await athleteOne.getByRole("button", { name: "Повторить", exact: true }).click();
        expect(((await retryRequest).postDataJSON() as { idempotencyKey: string }).idempotencyKey).toBe(knownFailureCommand);
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();

        await athleteOne.getByLabel("Повторы", { exact: true }).fill("10");
        let persistedUnknownPosts = 0;
        await athleteOne.route(progressPattern, async (route) => {
          persistedUnknownPosts += 1;
          const persisted = await route.fetch();
          await route.fulfill({ response: persisted, status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
        });
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Не удалось подтвердить, сохранился ли подход.", { exact: true })).toBeVisible();
        await athleteOne.unroute(progressPattern);
        await athleteOne.getByRole("button", { name: "Проверить", exact: true }).click();
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();
        expect(persistedUnknownPosts).toBe(1);
        removeObserved(observed, (item) => item === "http:503:/api/workout-sessions/" + startedSessionId + "/progress");
        removeObserved(observed, (item) => item.startsWith("console:/client/workouts:Failed to load resource") && (item.includes("503") || item.includes("400")));
        const persistedSecondTab = await athleteOneContext.newPage();
        observeRuntimeErrors(persistedSecondTab, observed);
        await persistedSecondTab.goto(sessionPath);
        await expect(persistedSecondTab.getByLabel("Повторы", { exact: true })).toHaveValue("10");
        await persistedSecondTab.close();

        await athleteOne.getByRole("tab", { name: new RegExp(durationExerciseTitle) }).click();
        await athleteOne.getByLabel("Секунды", { exact: true }).fill("32");
        await athleteOne.getByLabel("RPE", { exact: true }).fill("6.5");
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();
        await athleteOne.reload();
        await athleteOne.getByRole("tab", { name: new RegExp(durationExerciseTitle) }).click();
        await expect(athleteOne.getByLabel("Секунды", { exact: true })).toHaveValue("32");
        await athleteOne.getByRole("button", { name: "Пропустить подход 1" }).click();
        await expect(athleteOne.getByText("Подход отмечен как пропущенный", { exact: true })).toBeVisible();
        await athleteOne.reload();
        await athleteOne.getByRole("tab", { name: new RegExp(durationExerciseTitle) }).click();
        await expect(athleteOne.getByText("Пропущен", { exact: true })).toBeVisible();
        await expect(athleteOne.getByLabel("Секунды", { exact: true })).toHaveValue("");
        await athleteOne.getByLabel("Секунды", { exact: true }).fill("32");
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();
        await athleteOne.setViewportSize({ width: 390, height: 500 });
        await athleteOne.getByLabel("Секунды", { exact: true }).focus();
        await expectNoHorizontalOverflow(athleteOne);
        await athleteOne.setViewportSize({ width: 390, height: 844 });
        await expectNoHorizontalOverflow(athleteOne);

        const completeButton = athleteOne.getByRole("button", { name: "Завершить", exact: true });
        await completeButton.scrollIntoViewIfNeeded();
        await completeButton.click();
        const dialog = athleteOne.getByRole("dialog", { name: "Завершить тренировку", exact: true });
        await expect(dialog).toContainText("2 из 2 подходов");
        await dialog.getByRole("radio", { name: "Нет", exact: true }).check();
        await dialog.getByRole("button", { name: "Завершить тренировку", exact: true }).click();
        await expect(athleteOne.getByRole("heading", { name: "Тренировка завершена" })).toBeVisible();
        await expectNoHorizontalOverflow(athleteOne);
      });

      await test.step("unassigned athlete cannot open another athlete session", async () => {
        await athleteTwo.goto(sessionPath);
        await expect(athleteTwo.getByRole("heading", { name: "Тренировка недоступна" })).toBeVisible();
        await expect(athleteTwo.getByText(workoutTitle, { exact: true })).toHaveCount(0);
        const expectedUnavailableConsole = (error: string) => error === "console:/client/workouts:Failed to load resource: the server responded with a status of 404 (Not Found)";
        await expect.poll(() => observed.filter(expectedUnavailableConsole).length).toBe(1);
        removeObserved(observed, expectedUnavailableConsole);
      });

      await test.step("trainer reviews exact facts and athlete receives feedback", async () => {
        await trainer.goto("/trainer/dashboard");
        const decisionWorkspace = trainer.getByRole("region", { name: "Следующее решение" });
        await decisionWorkspace.getByRole("button", { name: new RegExp(athleteOneName) }).click();
        await expect(decisionWorkspace.getByRole("heading", { name: athleteOneName })).toBeVisible();
        await trainer.evaluate(() => window.scrollTo(0, 600));
        await decisionWorkspace.getByRole("link", { name: "Контекст клиента" }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients\/[0-9a-f-]+\?from=dashboard.*attentionItem=/);
        const entryContext = trainer.getByRole("region", { name: "Причина открытия профиля" });
        await expect(entryContext.getByText("Тренировка ждёт разбора", { exact: true })).toBeVisible();
        await expect.poll(() => trainer.evaluate(() => window.scrollY)).toBe(0);
        await trainer.getByRole("link", { name: "Тренировки", exact: true }).click();
        await expect(trainer).toHaveURL(/tab=training.*from=dashboard.*attentionItem=/);
        const currentWork = trainer.getByRole("region", { name: "Работа сейчас" });
        await expect(currentWork.getByText("Причина открытия профиля", { exact: true })).toBeVisible();
        await expect(currentWork.getByRole("link", { name: `Открыть разбор: ${workoutTitle}` })).toBeVisible();
        await trainer.getByRole("link", { name: "Обзор", exact: true }).click();
        await expect(trainer).toHaveURL(/tab=overview.*from=dashboard.*attentionItem=/);
        await expect(entryContext.getByText("Тренировка ждёт разбора", { exact: true })).toBeVisible();
        await trainer.getByRole("link", { name: "К главной" }).click();
        await decisionWorkspace.getByRole("button", { name: new RegExp(athleteOneName) }).click();
        await decisionWorkspace.getByRole("button", { name: "Разобрать", exact: true }).click();
        const reviewResults = trainer.getByRole("region", { name: "Результаты по упражнениям" });
        await expect(reviewResults.getByText("B14: подход выполнен через мобильный сценарий.", { exact: true })).toBeVisible();
        await trainer.getByLabel("Сообщение спортсмену").fill(feedbackText);
        let failedIdempotencyKey = "";
        await trainer.route("**/api/trainer/reviews/*/feedback", async (route) => {
          const payload = route.request().postDataJSON() as { idempotencyKey: string };
          failedIdempotencyKey = payload.idempotencyKey;
          await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "idempotency_conflict" }) });
        });
        await trainer.getByRole("button", { name: "Отправить ответ", exact: true }).click();
        await expect(trainer.getByRole("region", { name: "Обратная связь" }).getByRole("alert")).toContainText("Повтор команды не совпадает");
        await expect(trainer.getByLabel("Сообщение спортсмену")).toHaveValue(feedbackText);
        const expectedConflict = (error: string) => (
          error.startsWith("console:/trainer/review/")
          && error.includes("Failed to load resource")
          && error.includes("409 (Conflict)")
        );
        await expect.poll(() => observed.filter(expectedConflict).length).toBe(1);
        observed.splice(observed.findIndex(expectedConflict), 1);
        await trainer.unroute("**/api/trainer/reviews/*/feedback");
        const retryRequestPromise = trainer.waitForRequest((request) => (
          request.url().includes(`/api/trainer/reviews/`) && request.url().endsWith("/feedback")
        ));
        await trainer.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
        const retryPayload = (await retryRequestPromise).postDataJSON() as { idempotencyKey: string };
        expect(retryPayload.idempotencyKey).toBe(failedIdempotencyKey);
        await expect(trainer.getByRole("status").getByText("Обратная связь сохранена", { exact: true })).toBeVisible();
        const reviewReceipt = trainer.getByRole("status");
        await expect(reviewReceipt.getByRole("link", { name: "К профилю" })).toBeVisible();
        await trainer.reload();
        await expect(trainer.getByRole("status").getByText("Обратная связь сохранена", { exact: true })).toBeVisible();
        await trainer.getByRole("button", { name: "Добавить уточнение", exact: true }).click();
        await trainer.getByLabel("Текст уточнения", { exact: true }).fill(followUpText);
        await trainer.getByRole("button", { name: "Отправить уточнение", exact: true }).click();
        await expect(trainer.getByRole("status").getByText("Уточнение сохранено", { exact: true })).toBeVisible();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("review-completion-receipt-heading");
        await trainer.getByRole("status").getByRole("link", { name: "К профилю" }).click();
        await expect(trainer).toHaveURL(/tab=training.*receipt=review.*receiptId=/);
        await expect(trainer.getByRole("status").getByText("Обратная связь сохранена", { exact: true })).toBeVisible();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("latest-feedback-section");

        await athleteOne.goto(sessionPath);
        await expect(athleteOne.getByText(feedbackText, { exact: true })).toBeVisible();
        await expect(athleteOne.getByText(followUpText, { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(athleteOne);
      });

      await test.step("training tab shows persisted feedback and cursor history without duplicates", async () => {
        await trainer.goto(`${athleteOneProfilePath}?tab=training`);
        await expect(trainer.getByRole("heading", { name: "Последняя обратная связь", exact: true })).toBeVisible();
        await expect(trainer.getByText(followUpText, { exact: true })).toBeVisible();
        await expect(trainer.locator("[data-training-history-row]")).toHaveCount(1);

        await seedTerminalHistory(athleteOneId, 12);
        await trainer.reload();
        await expect(trainer.locator("[data-training-history-row]")).toHaveCount(10);
        const firstPageIds = await trainer.locator("[data-training-history-row]").evaluateAll((rows) => (
          rows.map((row) => row.getAttribute("data-training-history-row"))
        ));
        await trainer.getByRole("button", { name: "Показать ещё" }).click();
        await expect(trainer.locator("[data-training-history-row]")).toHaveCount(13);
        const allIds = await trainer.locator("[data-training-history-row]").evaluateAll((rows) => (
          rows.map((row) => row.getAttribute("data-training-history-row"))
        ));
        expect(new Set(firstPageIds).size).toBe(firstPageIds.length);
        expect(new Set(allIds).size).toBe(allIds.length);
        await trainer.evaluate(() => window.scrollTo(0, 0));
        await trainer.screenshot({ path: "test-results/canonical/r2a-training-desktop.png", fullPage: true });
      });

      await test.step("training tab remains usable on 390×844", async () => {
        await trainer.setViewportSize({ width: 390, height: 844 });
        await trainer.goto(`${athleteOneProfilePath}?tab=training`);
        await expect(trainer.getByRole("heading", { name: "Работа сейчас", exact: true })).toBeVisible();
        await expect(trainer.getByRole("link", { name: "Назначить тренировку", exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(trainer);
        await trainer.screenshot({ path: "test-results/canonical/r2a-training-mobile.png", fullPage: true });
        await trainer.setViewportSize({ width: 1440, height: 1024 });
      });

      await test.step("acknowledgement closes a new review only after explicit submit", async () => {
        const sessionId = await createCompletedReviewFixture(trainer, athleteOne, athleteOneId, templateId, "ack");
        await trainer.goto(`/trainer/review/${sessionId}`);
        await expect(trainer.getByRole("heading", { name: workoutTitle, exact: true })).toBeVisible();
        await trainer.getByRole("button", { name: "Коротко подтвердить", exact: true }).click();
        await trainer.getByRole("button", { name: "Тренировку посмотрел. Результаты принял.", exact: true }).click();
        await expect(trainer.getByText("Открыто", { exact: true })).toBeVisible();
        await expect(trainer.getByLabel("Сообщение спортсмену")).toHaveValue("Тренировку посмотрел. Результаты принял.");
        await trainer.getByRole("button", { name: "Подтвердить и закрыть разбор", exact: true }).click();
        await expect(trainer.getByRole("status").getByText("Обратная связь сохранена", { exact: true })).toBeVisible();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("review-completion-receipt-heading");
        await trainer.getByRole("link", { name: "Назначить следующую тренировку", exact: true }).click();
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toContainText(athleteOneName);
        await trainer.getByRole("button", { name: "Закрыть назначение" }).click();
        await expect(trainer).toHaveURL(new RegExp(`/trainer/review/${sessionId}$`));
      });

      await test.step("manual resolution stores a private reason and sends no athlete feedback", async () => {
        const sessionId = await createCompletedReviewFixture(trainer, athleteOne, athleteOneId, templateId, "manual");
        await trainer.goto(`/trainer/review/${sessionId}`);
        await trainer.getByText("Дополнительные действия", { exact: true }).click();
        await trainer.getByRole("button", { name: "Закрыть без сообщения", exact: true }).first().click();
        const dialog = trainer.getByRole("dialog", { name: "Закрыть разбор без сообщения?" });
        await dialog.getByLabel("Причина *").selectOption("Другое");
        await dialog.getByLabel("Своя причина").fill("Проверено на очной тренировке");
        await dialog.getByRole("button", { name: "Закрыть без сообщения", exact: true }).click();
        await expect(trainer.getByRole("status").getByText("Разбор закрыт без сообщения спортсмену", { exact: true })).toBeVisible();
        const athleteFeedback = await athleteOne.request.get(`/api/client/feedback?sessionId=${sessionId}`);
        expect(athleteFeedback.status()).toBe(200);
        const athleteFeedbackBody = await athleteFeedback.json() as { feedback: unknown[] };
        expect(athleteFeedbackBody.feedback).toEqual([]);
        expect(JSON.stringify(athleteFeedbackBody)).not.toContain("Проверено на очной тренировке");
      });

      await test.step("dashboard and roster open the same athlete-bound Quick Assign host", async () => {
        await trainer.goto("/trainer/dashboard");
        const dashboardItem = trainer.locator("article").filter({ hasText: athleteOneName });
        await dashboardItem.getByRole("button", { name: "Назначить", exact: true }).click();
        await expect(trainer).toHaveURL(new RegExp(`/trainer/clients/${athleteOneId}\\?[^#]*tab=training[^#]*assign=1`));
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toContainText(athleteOneName);
        await trainer.getByRole("button", { name: "Закрыть назначение" }).click();
        await expect(trainer).toHaveURL(/\/trainer\/dashboard/);

        await trainer.goto(`/trainer/clients?search=${encodeURIComponent("Анна")}&filter=attention`);
        await trainer.getByRole("button", { name: `Назначить тренировку для ${athleteOneName}` }).click();
        await expect(trainer).toHaveURL(new RegExp(`/trainer/clients/${athleteOneId}\\?[^#]*tab=training[^#]*assign=1`));
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toContainText("Из списка спортсменов");
        await trainer.getByRole("button", { name: "Закрыть назначение" }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients\?[^#]*search=/);
        await expect(trainer.getByLabel("Поиск спортсмена")).toHaveValue("Анна");
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.getAttribute("data-roster-athlete"))).toBe(athleteOneId);
      });

      await test.step("legacy Builder handoff normalizes to the new Editor and returns without assigning", async () => {
        const token = "r2c3_builder_handoff_token_000001";
        const scheduledFor = new Date().toISOString().slice(0, 10);
        const flow = JSON.stringify({
          version: 1,
          origin: "profile",
          athleteUserId: athleteTwoId,
          tab: "training",
          returnTo: `/trainer/clients/${athleteTwoId}?tab=training`,
          returnAnchor: "next-assignment",
        });
        await trainer.goto("/trainer/dashboard");
        await trainer.evaluate(({ tokenValue, athleteUserId, transitionContext, date }) => {
          const createdAt = Date.now();
          window.sessionStorage.setItem(`quick-assign-builder-handoff:v1:${tokenValue}`, JSON.stringify({
            version: 1,
            token: tokenValue,
            createdAt,
            expiresAt: createdAt + 30 * 60 * 1000,
            athleteUserId,
            transitionContext,
            query: "контрольная",
            scheduledFor: date,
            trainerNote: "Восстановленная заметка",
            status: "editing",
          }));
        }, { tokenValue: token, athleteUserId: athleteTwoId, transitionContext: flow, date: scheduledFor });
        const before = await athleteTwo.request.get("/api/workout-assignments");
        const beforeBody = await before.json() as { assignments: Array<{ id: string }> };
        const returnTo = `/trainer/clients/${athleteTwoId}?${new URLSearchParams({ tab: "training", assign: "1", flow, handoff: token })}`;
        await trainer.goto(`/trainer/builder?${new URLSearchParams({ handoff: token, returnTo })}`);
        await expect.poll(() => {
          const url = new URL(trainer.url());
          return [url.pathname, Boolean(url.searchParams.get("handoff")), Boolean(url.searchParams.get("returnTo"))];
        }).toEqual(["/trainer/builder/new", true, true]);
        await expect(trainer.getByText("Вы создаёте шаблон для последующего назначения", { exact: true })).toBeVisible();
        await trainer.getByRole("button", { name: "Назад" }).click();
        await expect(trainer).toHaveURL(new RegExp(`/trainer/clients/${athleteTwoId}\\?[^#]*assign=1[^#]*handoff=`));
        const sheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(sheet.getByLabel("Поиск шаблонов")).toHaveValue("контрольная");
        await expect(sheet.getByRole("radio", { checked: true })).toHaveCount(0);
        await sheet.getByRole("radio", { name: new RegExp(workoutTitle) }).click();
        await expect(sheet.getByLabel("Выбрать дату тренировки")).toHaveValue(scheduledFor);
        await expect(sheet.getByLabel("Заметка спортсмену")).toHaveValue("Восстановленная заметка");
        const after = await athleteTwo.request.get("/api/workout-assignments");
        const afterBody = await after.json() as { assignments: Array<{ id: string }> };
        expect(afterBody.assignments.map((item) => item.id)).toEqual(beforeBody.assignments.map((item) => item.id));
        await trainer.getByRole("button", { name: "Закрыть назначение" }).click();
      });

      await test.step("quick assign uses a saved template and returns a durable profile receipt", async () => {
        await trainer.goto(`${athleteOneProfilePath}?tab=training`);
        await trainer.getByRole("link", { name: "Назначить тренировку", exact: true }).click();
        await expect(trainer).toHaveURL(/tab=training.*assign=1.*flow=/);
        let sheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(sheet).toContainText(athleteOneName);
        await expect(sheet.getByRole("radio", { checked: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(trainer);

        await trainer.goBack();
        await expect(sheet).toHaveCount(0);
        await expect(trainer).toHaveURL(/tab=training/);
        await expect(trainer).not.toHaveURL(/assign=1/);

        await trainer.getByRole("link", { name: "Назначить тренировку", exact: true }).click();
        await expect(trainer).toHaveURL(/tab=training.*assign=1.*flow=/);
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toBeVisible();
        await trainer.reload();
        sheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(sheet).toBeVisible();
        await expect(sheet.getByRole("radio", { checked: true })).toHaveCount(0);

        await trainer.setViewportSize({ width: 390, height: 844 });
        await sheet.getByLabel("Поиск шаблонов").fill("контрольная");
        const templateRow = sheet.getByRole("radio", { name: new RegExp(workoutTitle) });
        await expect(templateRow).toBeVisible();
        await templateRow.click();
        await expect(sheet.getByRole("heading", { name: workoutTitle, exact: true })).toBeVisible();
        await expect(sheet.getByRole("button", { name: "К выбору шаблона" })).toBeVisible();
        await expect(sheet.getByText(/Версия 1 · 2 упражнения · 2 подхода/)).toBeVisible();
        await expect(sheet.getByText(/ОПУБЛИКОВАННАЯ ВЕРСИЯ/)).toHaveCount(0);
        await expectNoHorizontalOverflow(trainer);
        await trainer.screenshot({ path: "test-results/canonical/r2c2p-quick-assign-mobile-selected.png" });
        await sheet.getByRole("button", { name: "К выбору шаблона" }).click();
        await expect(sheet.getByLabel("Поиск шаблонов")).toHaveValue("контрольная");
        await expect(templateRow).toHaveAttribute("aria-checked", "true");

        await trainer.setViewportSize({ width: 1440, height: 1024 });
        await templateRow.click();
        await sheet.getByRole("button", { name: "Сегодня" }).click();
        await sheet.getByLabel("Заметка спортсмену").fill("R2C.2 exact revision assignment");
        const assignmentResponsePromise = trainer.waitForResponse((response) => (
          response.url().endsWith("/api/workout-assignments") && response.request().method() === "POST"
        ));
        const assignmentRequestPromise = trainer.waitForRequest((request) => (
          request.url().endsWith("/api/workout-assignments") && request.method() === "POST"
        ));
        await sheet.getByRole("button", { name: "Назначить тренировку", exact: true }).click();
        const assignmentPayload = (await assignmentRequestPromise).postDataJSON() as Record<string, unknown>;
        expect(assignmentPayload).toMatchObject({
          athleteUserId: athleteOneId,
          templateId,
          trainerNote: "R2C.2 exact revision assignment",
          allowAdditionalAssignment: false,
        });
        expect(assignmentPayload.assignmentId).toMatch(/^[0-9a-f-]{36}$/);
        expect(assignmentPayload.templateRevisionId).toMatch(/^[0-9a-f-]{36}$/);
        expect(assignmentPayload.assignmentStateToken).toMatch(/^qa1\./);
        expect(typeof assignmentPayload.transitionContext).toBe("string");
        const assignmentResponse = await assignmentResponsePromise;
        expect(assignmentResponse.status()).toBe(201);
        const assignmentResult = await assignmentResponse.json() as {
          assignment: { scheduledFor: string; titleSnapshot: string; sourceRevisionNumber: number };
        };
        const localizedAssignmentDate = formatQuickAssignCalendarDate(assignmentResult.assignment.scheduledFor);
        await expect(sheet.getByRole("status").getByText("Тренировка назначена", { exact: true })).toBeVisible();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("quick-assign-receipt-heading");
        await expect(sheet.getByText(assignmentResult.assignment.titleSnapshot, { exact: true })).toBeVisible();
        await expect(sheet.getByText(`Версия ${assignmentResult.assignment.sourceRevisionNumber} · ${localizedAssignmentDate}`, { exact: true })).toBeVisible();
        await expect(sheet.getByText("Назначение создано ·", { exact: false })).toBeVisible();
        await expect(sheet.getByText("Будущих тренировок нет", { exact: true })).toHaveCount(0);
        await expect(sheet.getByText(assignmentResult.assignment.scheduledFor, { exact: true })).toHaveCount(0);
        await expect(sheet.getByText("Статус: Сохранено", { exact: true })).toHaveCount(0);
        await expect(sheet.getByText("Ссылка", { exact: true })).toHaveCount(0);
        await expect(sheet.getByRole("link", { name: "Вернуться к тренировкам", exact: true })).toBeVisible();
        await expect(sheet.getByText("Следующая задача", { exact: true })).toHaveCount(0);
        await expectNoHorizontalOverflow(trainer);
        await trainer.screenshot({ path: "test-results/canonical/r2c2p-quick-assign-desktop-receipt.png" });
        await trainer.setViewportSize({ width: 720, height: 512 });
        await expectNoHorizontalOverflow(trainer);
        await trainer.setViewportSize({ width: 390, height: 844 });
        await expect(sheet.getByRole("heading", { name: "Тренировка назначена", exact: true })).toBeVisible();
        await expect(sheet.getByRole("link", { name: "Вернуться к тренировкам", exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(trainer);
        await trainer.screenshot({ path: "test-results/canonical/r2c2p-quick-assign-mobile-receipt.png" });
        await sheet.getByRole("link", { name: "Вернуться к тренировкам", exact: true }).click();
        await expect(trainer).toHaveURL(/tab=training.*receipt=assignment.*receiptId=/);
        await expect(trainer.getByRole("status").getByText("Тренировка назначена", { exact: true })).toBeVisible();
        await trainer.setViewportSize({ width: 1440, height: 1024 });
      });

      await test.step("suspended relation reveals no training facts", async () => {
        const rosterResponse = await trainer.request.get("/api/trainer/athletes");
        expect(rosterResponse.status()).toBe(200);
        const roster = await rosterResponse.json() as {
          athletes: Array<{ athleteUserId: string; relationId: string }>;
        };
        athleteOneRelationId = roster.athletes.find((athlete) => athlete.athleteUserId === athleteOneId)?.relationId ?? "";
        expect(athleteOneRelationId).not.toBe("");
        const suspendResponse = await trainer.request.patch(`/api/access/relations/${athleteOneRelationId}`, {
          data: { status: "suspended" },
          headers: { Origin: baseURL },
        });
        expect(suspendResponse.status()).toBe(200);
        await trainer.goto(`${athleteOneProfilePath}?tab=training`);
        await expect(trainer.getByRole("heading", { name: "Тренировочные данные временно недоступны" })).toBeVisible();
        await expect(trainer.getByText(workoutTitle, { exact: true })).toHaveCount(0);
        await expect(trainer.getByText(feedbackText, { exact: true })).toHaveCount(0);
        await trainer.goto(`${athleteOneProfilePath}?tab=training&assign=1`);
        const unavailableSheet = trainer.getByRole("dialog", { name: "Назначить тренировку" });
        await expect(unavailableSheet.getByRole("heading", { name: "Связь со спортсменом приостановлена" })).toBeVisible();
        await expect(unavailableSheet.getByRole("button", { name: "Назначить тренировку" })).toHaveCount(0);
        await expect(unavailableSheet.getByText(workoutTitle, { exact: true })).toHaveCount(0);
      });

      await assertNoReactOverlay(trainer);
      await assertNoReactOverlay(athleteOne);
      await assertNoReactOverlay(athleteTwo);
      expect(observed).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});

async function signInWithDevelopmentOtp(page: Page, email: string) {
  await expect(page.getByRole("heading", { name: "Вход или регистрация" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Получить код" }).click();
  const localCode = page.locator("p.font-mono");
  await expect(localCode).toBeVisible();
  const code = (await localCode.textContent())?.trim() ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Код из письма").fill(code);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByRole("heading", { name: "Email подтверждён" })).toBeVisible();
  await page.getByRole("link", { name: "Продолжить" }).click();
}

async function saveDisplayName(page: Page, displayName: string) {
  await expect(page.getByRole("heading", { name: "Настройка рабочего пространства" })).toBeVisible();
  await page.getByLabel("Как вас зовут").fill(displayName);
  const save = page.getByRole("button", { name: "Сохранить", exact: true });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Имя сохранено.", { exact: true })).toBeVisible();
}

async function createInvitation(page: Page) {
  const responsePromise = page.waitForResponse((response) => (
    response.url().endsWith("/api/access/invitations")
    && response.request().method() === "POST"
  ));
  await page.getByRole("button", { name: "Пригласить", exact: true }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const body = await response.json() as { webInvitationUrl: string };
  await expect(page.getByLabel("Ссылка приглашения")).toHaveValue(body.webInvitationUrl);
  const url = new URL(body.webInvitationUrl);
  return `${url.pathname}${url.search}`;
}

async function registerAthlete(page: Page, invitationPath: string, email: string, displayName: string) {
  await page.goto(invitationPath);
  await page.getByRole("link", { name: "Войти" }).click();
  await signInWithDevelopmentOtp(page, email);
  await expect(page).toHaveURL(/\/onboarding\?invite=/);
  await saveDisplayName(page, displayName);
  await page.getByRole("button", { name: "Принять приглашение" }).click();
  await expect(page).toHaveURL(/\/client\/me$/);
  await expect(page.getByRole("heading", { name: "Что делаем сейчас" })).toBeVisible();
}

async function runOperator(args: string[]) {
  const currentOptions = process.env.NODE_OPTIONS?.trim();
  const { stdout } = await execFile(
    process.execPath,
    ["--import", "tsx", "scripts/ops/local-pilot.ts", ...args],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_OPTIONS: [currentOptions, "--conditions=react-server"].filter(Boolean).join(" "),
      },
      maxBuffer: 1024 * 1024,
    },
  );
  return String(stdout);
}

async function seedTerminalHistory(athleteUserId: string, count: number) {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) throw new Error("database_migration_url_required");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await pool.query(`
      WITH source AS (
        SELECT assignment.*,
               session.relation_id AS session_relation_id,
               session.trainer_user_id AS session_trainer_user_id,
               session.athlete_user_id AS session_athlete_user_id
        FROM app.workout_assignments assignment
        JOIN app.workout_sessions session ON session.assignment_id = assignment.id
        WHERE assignment.athlete_user_id = $1
          AND session.status IN ('completed', 'completed_with_omissions')
        ORDER BY session.completed_at DESC
        LIMIT 1
      ), fixture AS (
        SELECT generate_series(1, $2::int) AS sequence,
               gen_random_uuid() AS assignment_id,
               gen_random_uuid() AS session_id
      ), inserted_assignments AS (
        INSERT INTO app.workout_assignments (
          id, relation_id, trainer_user_id, athlete_user_id,
          source_template_id, source_revision_id, source_revision_number,
          title_snapshot, instruction_snapshot, trainer_note,
          scheduled_for, status, created_at, updated_at
        )
        SELECT fixture.assignment_id, source.relation_id, source.trainer_user_id, source.athlete_user_id,
               source.source_template_id, source.source_revision_id, source.source_revision_number,
               source.title_snapshot || ' · архив ' || fixture.sequence,
               source.instruction_snapshot, source.trainer_note,
               current_date - fixture.sequence, 'available',
               clock_timestamp() - fixture.sequence * interval '1 day',
               clock_timestamp() - fixture.sequence * interval '1 day'
        FROM source CROSS JOIN fixture
        RETURNING id
      )
      INSERT INTO app.workout_sessions (
        id, assignment_id, relation_id, trainer_user_id, athlete_user_id,
        status, version, client_timezone, start_idempotency_key_hash,
        started_at, completed_at, created_at, updated_at
      )
      SELECT fixture.session_id, fixture.assignment_id,
             source.session_relation_id, source.session_trainer_user_id, source.session_athlete_user_id,
             'active', 1, 'Europe/Moscow',
             md5(fixture.assignment_id::text) || md5(fixture.session_id::text),
             clock_timestamp() - fixture.sequence * interval '1 day' - interval '1 hour',
             NULL,
             clock_timestamp() - fixture.sequence * interval '1 day' - interval '1 hour',
             clock_timestamp() - fixture.sequence * interval '1 day'
      FROM source CROSS JOIN fixture
      WHERE EXISTS (SELECT 1 FROM inserted_assignments)
      RETURNING id
    `, [athleteUserId, count]);
    expect(result.rowCount).toBe(count);
    // Pagination-only fixture follows the new active -> terminal context constraint.
    await pool.query(`UPDATE app.workout_sessions SET status='completed', version=version+1,
      completed_at=started_at + interval '1 hour', discomfort_reported=false
      WHERE id=ANY($1::uuid[])`, [result.rows.map((row: { id: string }) => row.id)]);
  } finally {
    await pool.end();
  }
}

async function createCompletedReviewFixture(
  trainer: Page,
  athlete: Page,
  athleteUserId: string,
  templateId: string,
  suffix: string,
) {
  const strict = await strictAssignmentData(trainer, athleteUserId, templateId);
  const assignmentResponse = await trainer.request.post("/api/workout-assignments", {
    headers: { Origin: baseURL },
    data: {
      assignmentId: crypto.randomUUID(),
      athleteUserId,
      templateId,
      templateRevisionId: strict.templateRevisionId,
      scheduledFor: new Date().toISOString().slice(0, 10),
      trainerNote: `Canonical Review ${suffix}`,
      assignmentStateToken: strict.assignmentStateToken,
      allowAdditionalAssignment: false,
      transitionContext: JSON.stringify({ version: 1, origin: "direct", athleteUserId, tab: "training" }),
    },
  });
  expect(assignmentResponse.status()).toBe(201);
  const assignmentBody = await assignmentResponse.json() as { assignment: { id: string } };
  const startResponse = await athlete.request.post("/api/workout-sessions", {
    headers: { Origin: baseURL },
    data: {
      assignmentId: assignmentBody.assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKey: `review-${suffix}-start-${assignmentBody.assignment.id}`,
    },
  });
  expect(startResponse.status()).toBe(201);
  const startBody = await startResponse.json() as {
    session: {
      id: string;
      version: number;
      exercises: Array<{
        sets: Array<{
          id: string;
          plannedRepetitionsMin: number | null;
          plannedWeightKg: number | null;
        }>;
      }>;
    };
  };
  const session = startBody.session;
  const sets = session.exercises.flatMap((exercise) => exercise.sets).map((set) => ({
    setLogId: set.id,
    status: "completed",
    actualRepetitions: set.plannedRepetitionsMin ?? 8,
    actualDurationSeconds: null,
    actualWeightKg: set.plannedWeightKg,
    rpe: 7,
    athleteComment: "",
  }));
  const progressResponse = await athlete.request.post(`/api/workout-sessions/${session.id}/progress`, {
    headers: { Origin: baseURL },
    data: {
      expectedVersion: session.version,
      idempotencyKey: `review-${suffix}-progress-${session.id}`,
      sets,
    },
  });
  expect(progressResponse.status()).toBe(200);
  const progressBody = await progressResponse.json() as { session: { version: number } };
  const completeResponse = await athlete.request.post(`/api/workout-sessions/${session.id}/complete`, {
    headers: { Origin: baseURL },
    data: {
      expectedVersion: progressBody.session.version,
      idempotencyKey: `review-${suffix}-complete-${session.id}`,
      discomfortReported: false,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    },
  });
  expect(completeResponse.status()).toBe(200);
  return session.id;
}

async function strictAssignmentData(trainer: Page, athleteUserId: string, templateId: string) {
  const response = await trainer.request.get(`/api/trainer/athletes/${athleteUserId}/quick-assign?first=50`);
  expect(response.status()).toBe(200);
  const body = await response.json() as {
    quickAssign: {
      athlete: { assignmentStateToken: string };
      templates: { items: Array<{ templateId: string; revisionId: string }> };
    };
  };
  const template = body.quickAssign.templates.items.find((item) => item.templateId === templateId);
  expect(template?.revisionId).toMatch(/^[0-9a-f-]{36}$/);
  return {
    templateRevisionId: template!.revisionId,
    assignmentStateToken: body.quickAssign.athlete.assignmentStateToken,
  };
}

function observeRuntimeErrors(page: Page, errors: string[] = []) {
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${new URL(page.url()).pathname}:${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page:${new URL(page.url()).pathname}:${error.message}`));
  page.on("response", (response) => {
    if (response.url().startsWith(baseURL) && response.status() >= 500) {
      errors.push(`http:${response.status()}:${new URL(response.url()).pathname}`);
    }
  });
  return errors;
}

function removeObserved(errors: string[], predicate: (error: string) => boolean) {
  for (let index = errors.length - 1; index >= 0; index -= 1) {
    if (predicate(errors[index])) errors.splice(index, 1);
  }
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function assertNoReactOverlay(page: Page) {
  await expect(page.getByText("Console Error", { exact: true })).toHaveCount(0);
  await expect(page.getByText("A tree hydrated but some attributes", { exact: false })).toHaveCount(0);
}
