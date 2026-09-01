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
    let athleteOneRelationId = "";
    let athleteOneProfilePath = "";
    let templateId = "";
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
        const templateResponse = await trainer.request.post("/api/trainer/workout-templates", {
          headers: { Origin: baseURL },
          data: {
            title: workoutTitle,
            description: "Контрольная тренировка для canonical E2E.",
            generalInstruction: "Один технический подход без отказа.",
            estimatedDurationMin: 20,
            exercises: [{
              instanceKey: "canonical-e2e-squat",
              title: "Приседание с собственным весом",
              sets: 1,
              repetitions: 8,
              targetWeightKg: null,
              restSeconds: 90,
              trainerNote: "Остановись с запасом в два повтора.",
            }],
          },
        });
        expect(templateResponse.status()).toBe(201);
        const templateBody = await templateResponse.json() as { template: { id: string } };
        templateId = templateBody.template.id;

        await trainer.goto("/trainer/clients");
        const athleteOneRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        const athleteTwoRow = trainer.getByRole("row", { name: new RegExp(athleteTwoName) });
        await expect(athleteOneRow).toBeVisible();
        await expect(athleteTwoRow).toBeVisible();
        await athleteOneRow.getByRole("button", { name: `Назначить тренировку для ${athleteOneName}` }).click();
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toBeVisible();
        await trainer.getByLabel("Комментарий спортсмену").fill("Остановись с запасом в два повтора.");
        await trainer.getByRole("button", { name: "Назначить", exact: true }).click();
        await expect(trainer.getByText(`Назначено: ${workoutTitle} · ${athleteOneName}`, { exact: true })).toBeVisible();
      });

      await test.step("trainer opens the canonical athlete profile and URL-driven tabs", async () => {
        const athleteRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        await athleteRow.getByRole("link", { name: athleteOneName, exact: true }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients\/[0-9a-f-]+$/);
        athleteOneProfilePath = new URL(trainer.url()).pathname;
        athleteOneId = athleteOneProfilePath.split("/").at(-1) ?? "";
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
        await athleteOne.goto("/client/me");
        await expect(athleteOne.getByText(workoutTitle, { exact: true })).toBeVisible();
        await athleteOne.getByRole("link", { name: "Начать тренировку" }).click();
        const startResponsePromise = athleteOne.waitForResponse((response) => (
          response.url().endsWith("/api/workout-sessions")
          && response.request().method() === "POST"
        ));
        await athleteOne.getByRole("button", { name: "Начать тренировку" }).click();
        const startResponse = await startResponsePromise;
        expect(startResponse.status()).toBe(201);
        const startBody = await startResponse.json() as { session: { id: string } };
        sessionPath = `/client/workouts?session=${startBody.session.id}`;
        await athleteOne.getByLabel("Повторы", { exact: true }).fill("8");
        await athleteOne.getByLabel("RPE", { exact: true }).fill("7");
        await athleteOne.getByLabel("Комментарий", { exact: true }).fill("B14: подход выполнен через мобильный сценарий.");
        await athleteOne.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect(athleteOne.getByText("Подход сохранён", { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(athleteOne);

        const completeButton = athleteOne.getByRole("button", { name: "Завершить", exact: true });
        await completeButton.scrollIntoViewIfNeeded();
        await completeButton.click();
        const dialog = athleteOne.getByRole("dialog", { name: "Завершить тренировку?" });
        await expect(dialog).toContainText("Выполнено 1 из 1 подходов");
        await dialog.getByRole("button", { name: "Завершить", exact: true }).click();
        await expect(athleteOne.getByRole("heading", { name: "Результат сохранён" })).toBeVisible();
        await expectNoHorizontalOverflow(athleteOne);
      });

      await test.step("unassigned athlete cannot open another athlete session", async () => {
        await athleteTwo.goto(sessionPath);
        await expect(athleteTwo.getByRole("heading", { name: "Нет доступной тренировки" })).toBeVisible();
        await expect(athleteTwo.getByText(workoutTitle, { exact: true })).toHaveCount(0);
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
        await expect(sheet.getByText(/Версия 1 · 1 упражнение · 1 подход/)).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Мои тренировки" })).toBeVisible();
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
             'completed', 1, 'Europe/Moscow',
             md5(fixture.assignment_id::text) || md5(fixture.session_id::text),
             clock_timestamp() - fixture.sequence * interval '1 day' - interval '1 hour',
             clock_timestamp() - fixture.sequence * interval '1 day',
             clock_timestamp() - fixture.sequence * interval '1 day' - interval '1 hour',
             clock_timestamp() - fixture.sequence * interval '1 day'
      FROM source CROSS JOIN fixture
      WHERE EXISTS (SELECT 1 FROM inserted_assignments)
    `, [athleteUserId, count]);
    expect(result.rowCount).toBe(count);
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
  const assignmentResponse = await trainer.request.post("/api/workout-assignments", {
    headers: { Origin: baseURL },
    data: {
      athleteUserId,
      templateId,
      scheduledFor: new Date().toISOString().slice(0, 10),
      trainerNote: `Canonical Review ${suffix}`,
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
      zeroResultConfirmed: false,
      zeroResultReason: "",
    },
  });
  expect(completeResponse.status()).toBe(200);
  return session.id;
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

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function assertNoReactOverlay(page: Page) {
  await expect(page.getByText("Console Error", { exact: true })).toHaveCount(0);
  await expect(page.getByText("A tree hydrated but some attributes", { exact: false })).toHaveCount(0);
}
