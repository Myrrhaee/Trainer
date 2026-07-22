import { expect, test, type Page } from "@playwright/test";

const fixtureCases = [
  {
    id: "review-required",
    path: "/trainer/dashboard",
    verify: async (page: Page) => {
      const queue = page.getByRole("list", { name: "Очередь внимания" });
      await expect(queue.getByText("Артём Смирнов", { exact: true })).toBeVisible();
      await expect(queue.getByText("Ольга Соколова", { exact: true })).toHaveCount(0);
    },
  },
  {
    id: "discomfort",
    path: "/trainer/dashboard",
    verify: async (page: Page) => {
      const queue = page.getByRole("list", { name: "Очередь внимания" });
      await expect(queue.getByText("Ольга Соколова", { exact: true })).toBeVisible();
      await expect(page.getByText("После тяговой тренировки появилось тянущее ощущение в плече. Резкой боли не было.", { exact: true })).toBeVisible();
    },
  },
  {
    id: "needs-assignment",
    path: "/trainer/clients/egor-nikitin",
    verify: async (page: Page) => {
      await expect(page.getByRole("heading", { name: "Егор Никитин", exact: true }).first()).toBeVisible();
      await expect(page.getByRole("button", { name: "Назначить тренировку" })).toBeVisible();
    },
  },
  {
    id: "no-suitable-template",
    path: "/trainer/clients/alexandra-konstantinova?quickAssign=1",
    verify: async (page: Page) => {
      await expect(page.getByRole("dialog")).toContainText("Сохранённых шаблонов пока нет");
      await page.getByRole("button", { name: "Закрыть быстрое назначение" }).click();
    },
  },
  {
    id: "calm-team",
    path: "/trainer/dashboard?demo=calm",
    verify: async (page: Page) => {
      await expect(page.getByText("Открытых решений нет.", { exact: false })).toBeVisible();
      await expect(page.getByRole("list", { name: "Очередь внимания" })).toHaveCount(0);
    },
  },
  {
    id: "client-execution",
    path: "/client/me?actor=maria-volkova",
    verify: async (page: Page) => {
      await expect(page.getByText("Тренировка назначена", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Начать тренировку" })).toBeVisible();
    },
  },
] as const;

test.describe("External trainer pilot readiness", () => {
  for (const fixture of fixtureCases) {
    test(`direct launch restores ${fixture.id}`, async ({ page }) => {
      const errors = captureErrors(page);
      await page.goto(researchUrl(fixture.path, fixture.id));
      await fixture.verify(page);
      await expect(page.getByRole("complementary", { name: "Панель модератора" })).toBeVisible();
      await openModeratorTools(page);
      await page.getByRole("button", { name: "Сбросить" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Сбросить", exact: true }).click();
      await fixture.verify(page);
      expect(errors).toEqual([]);
    });
  }

  test("moderator reset confirms dirty state, clears Review drafts, and restores the fixture entry", async ({ page }) => {
    await page.goto(researchUrl("/client/me?actor=maria-volkova", "client-execution"));
    await page.getByRole("link", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Начать тренировку" }).click();
    await expect(page).toHaveURL(/session=session-demo-assignment-maria-volkova/);
    await page.evaluate(() => window.sessionStorage.setItem("workout-review:pilot-reset-check", "draft"));

    await openModeratorTools(page);
    await page.getByRole("button", { name: "Сбросить" }).click();
    const resetDialog = page.getByRole("dialog", { name: "Сбросить изменения сценария?" });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole("button", { name: "Сбросить", exact: true }).click();

    await expect(page).toHaveURL(/\/client\/me\?.*fixture=client-execution/);
    await expect(page.getByRole("link", { name: "Начать тренировку" })).toBeVisible();
    expect(await page.evaluate(() => window.sessionStorage.getItem("workout-review:pilot-reset-check"))).toBeNull();
  });

  test("actor switch preserves fixture markers and clears incompatible route state", async ({ page }) => {
    await page.goto(researchUrl("/client/me?actor=maria-volkova", "client-execution"));
    await openModeratorTools(page);
    await page.getByRole("button", { name: "Вид тренера" }).click();
    await expect(page).toHaveURL(/\/trainer\/clients\/maria-volkova\?.*research=1.*fixture=client-execution/);

    await openModeratorTools(page);
    await page.getByRole("button", { name: "Вид клиента" }).click();
    await expect(page).toHaveURL(/\/client\/workouts\?.*actor=maria-volkova.*research=1.*fixture=client-execution/);
    await expect(page.getByRole("button", { name: "Начать тренировку" })).toBeVisible();
  });

  test("invalid fixture, actor, session, athlete, and template fail closed with recovery", async ({ page }) => {
    await page.goto("/trainer/dashboard?research=1&fixture=unknown-fixture");
    await expect(page.getByRole("heading", { name: "Сценарий не найден" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Открыть стартовый сценарий" })).toBeVisible();

    await page.goto(researchUrl("/client/me?actor=unknown-athlete", "client-execution"));
    await expect(page.getByRole("heading", { name: "Клиент не найден" })).toBeVisible();
    await expect(page.getByText("Мария Волкова", { exact: true })).toHaveCount(0);

    await page.goto(researchUrl("/client/workouts?actor=maria-volkova&session=unknown-session", "client-execution"));
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
    await expect(page.getByRole("link", { name: "На главную" })).toBeVisible();

    await page.goto(researchUrl("/trainer/clients/unknown-athlete", "review-required"));
    await expect(page.getByRole("heading", { name: "Спортсмен не найден" })).toBeVisible();
    await page.goto(researchUrl("/trainer/builder?templateId=unknown-template&from=templates", "review-required"));
    await expect(page.getByRole("heading", { name: "Шаблон не найден" })).toBeVisible();
  });

  test("refresh during an active client session gives a safe route back to the restored fixture", async ({ page }) => {
    await page.goto(researchUrl("/client/me?actor=maria-volkova", "client-execution"));
    await page.getByRole("link", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    await page.reload();

    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
    await page.getByRole("link", { name: "На главную" }).click();
    await expect(page.getByRole("link", { name: "Начать тренировку" })).toBeVisible();
  });

  test("clean fixture loop completes without remote writes or duplicate context", async ({ page }) => {
    const writes = trackRemoteWrites(page);
    const errors = captureErrors(page);
    await page.goto(researchUrl("/client/me?actor=maria-volkova", "client-execution"));
    await page.getByRole("link", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    await page.getByRole("button", { name: "Завершить тренировку" }).click();
    await page.getByRole("button", { name: "Подтвердить завершение" }).click();
    await page.getByRole("link", { name: "Вид тренера" }).click();

    const queue = page.getByRole("list", { name: "Очередь внимания" });
    await queue.getByRole("button", { name: /Мария Волкова/ }).click();
    await page.getByRole("link", { name: /Полный разбор/ }).click();
    const feedback = "Вижу фактический результат. Следующую тренировку оставляем в спокойном рабочем темпе.";
    await page.getByLabel("Сообщение клиенту").fill(feedback);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("link", { name: "Открыть вид клиента" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("metadata is research-only and mobile fixture has no horizontal overflow", async ({ page }) => {
    await page.goto("/trainer/dashboard");
    await expect(page.getByRole("complementary", { name: "Панель модератора" })).toHaveCount(0);
    await expect(page.getByText("trainer-core-pilot-v1", { exact: false })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(researchUrl("/client/me?actor=maria-volkova", "client-execution"));
    await expectNoHorizontalOverflow(page);
    await openModeratorTools(page);
    await expect(page.getByText("trainer-core-pilot-v1", { exact: false })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

function researchUrl(path: string, fixture: string) {
  const url = new URL(path, "http://127.0.0.1:3100");
  url.searchParams.set("research", "1");
  url.searchParams.set("fixture", fixture);
  return `${url.pathname}${url.search}`;
}

async function openModeratorTools(page: Page) {
  await page.getByRole("button", { name: "Показать инструменты модератора" }).click();
  await expect(page.getByLabel("Сценарий")).toBeVisible();
}

function captureErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

function trackRemoteWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().startsWith("http://127.0.0.1:3100/_next/")) writes.push(`${request.method()} ${request.url()}`);
  });
  return writes;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
