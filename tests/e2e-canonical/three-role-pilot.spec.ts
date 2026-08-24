import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

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
    const trainerContext = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
    const athleteOneContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    const athleteTwoContext = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
    contexts.push(trainerContext, athleteOneContext, athleteTwoContext);
    const trainer = await trainerContext.newPage();
    const athleteOne = await athleteOneContext.newPage();
    const athleteTwo = await athleteTwoContext.newPage();
    const observed: string[] = [];
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
        await trainer.goto("/trainer/clients");
        const athleteOneRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        const athleteTwoRow = trainer.getByRole("row", { name: new RegExp(athleteTwoName) });
        await expect(athleteOneRow).toBeVisible();
        await expect(athleteTwoRow).toBeVisible();
        await athleteOneRow.getByRole("button", { name: `Назначить тренировку для ${athleteOneName}` }).click();
        await expect(trainer.getByRole("dialog", { name: "Назначить тренировку" })).toBeVisible();
        await trainer.getByLabel("Название тренировки").fill(workoutTitle);
        await trainer.getByLabel("Общая инструкция").fill("Один технический подход без отказа.");
        await trainer.getByLabel("Упражнение 1").fill("Приседание с собственным весом");
        await trainer.getByLabel("Подходы").fill("1");
        await trainer.getByLabel("Повторения").fill("8");
        await trainer.getByLabel("Комментарий спортсмену").fill("Остановись с запасом в два повтора.");
        await trainer.getByRole("button", { name: "Сохранить и назначить" }).click();
        await expect(trainer.getByText(`Назначено: ${workoutTitle} · ${athleteOneName}`, { exact: true })).toBeVisible();
      });

      await test.step("trainer opens the canonical athlete profile and URL-driven tabs", async () => {
        const athleteRow = trainer.getByRole("row", { name: new RegExp(athleteOneName) });
        await athleteRow.getByRole("link", { name: athleteOneName, exact: true }).click();
        await expect(trainer).toHaveURL(/\/trainer\/clients\/[0-9a-f-]+$/);
        await expect(trainer.getByRole("heading", { name: athleteOneName, exact: true })).toBeVisible();
        await expect(trainer.getByText("Тренировка назначена", { exact: true })).toBeVisible();
        await trainer.getByRole("link", { name: "Тренировки", exact: true }).click();
        await expect(trainer).toHaveURL(/\?tab=training$/);
        await expect(trainer.getByRole("heading", { name: "Текущее назначение", exact: true })).toBeVisible();
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
        await trainer.getByRole("link", { name: "К главной" }).click();
        await decisionWorkspace.getByRole("button", { name: new RegExp(athleteOneName) }).click();
        await decisionWorkspace.getByRole("button", { name: "Разобрать", exact: true }).click();
        await expect(trainer.getByText("B14: подход выполнен через мобильный сценарий.", { exact: false })).toBeVisible();
        await trainer.getByLabel("Сообщение спортсмену").fill(feedbackText);
        await trainer.getByRole("button", { name: "Отправить", exact: true }).click();
        await expect(trainer.getByText("Ответ отправлен, задача разбора закрыта.", { exact: true })).toBeVisible();

        await athleteOne.goto(sessionPath);
        await expect(athleteOne.getByText(feedbackText, { exact: true })).toBeVisible();
        await expectNoHorizontalOverflow(athleteOne);
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
