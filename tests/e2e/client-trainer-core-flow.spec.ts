import { expect, test, type Page } from "@playwright/test";

test.describe("Client-trainer shared runtime", () => {
  test("A: trainer assignment reaches client, completion reaches Review, feedback returns to client", async ({ page }) => {
    const writes = trackRemoteWrites(page);
    await assignAndOpenClient(page, "maria-volkova", "Силовая база", "Мария Волкова");
    await startCurrentWorkout(page);
    await saveAllVisibleSets(page);
    await page.getByRole("button", { name: "Завершить тренировку" }).click();
    await page.getByRole("button", { name: "Подтвердить завершение" }).click();
    await expect(page.getByText("Завершена", { exact: true }).first()).toBeVisible();

    await page.getByRole("link", { name: "Вернуться в кабинет тренера" }).click();
    await openQueueReview(page, "Мария Волкова");
    await expect(page.getByRole("region", { name: "Силовая база" })).toContainText("12 / 12");
    const feedback = "Отличная ровная работа. Сохраняем текущий темп и технику в следующем цикле.";
    await sendFeedback(page, feedback);
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("link", { name: "Открыть вид клиента" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("B: partial completion preserves skip and comment across roles", async ({ page }) => {
    await assignAndOpenClient(page, "egor-nikitin", "Силовая база", "Егор Никитин");
    await startCurrentWorkout(page);
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    await page.getByRole("tab", { name: /Тяга штанги в наклоне/ }).click();
    await page.getByRole("button", { name: "Пропустить упражнение" }).click();
    const comment = "Закончил раньше: не хватило времени на последний блок.";
    await page.getByRole("textbox", { name: "Комментарий к тренировке" }).fill(comment);
    await page.getByRole("button", { name: "Завершить тренировку" }).click();
    await expect(page.getByRole("dialog")).toContainText("Незаполненных подходов");
    await page.getByRole("button", { name: "Подтвердить завершение" }).click();

    await page.getByRole("link", { name: "Вернуться в кабинет тренера" }).click();
    await openQueueReview(page, "Егор Никитин");
    await expect(page.getByRole("region", { name: "Исходный комментарий клиента" })).toContainText(comment);
    await expect(page.getByText("Упражнение пропущено", { exact: true }).first()).toBeVisible();
    const feedback = "Вижу сокращённую сессию. Спасибо за комментарий, следующий день оставим компактным.";
    await sendFeedback(page, feedback);
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("link", { name: "Открыть вид клиента" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
  });

  test("C: discomfort original text becomes a safety review without diagnosis", async ({ page }) => {
    await assignAndOpenClient(page, "olga-sokolova", "Лёгкий верх", "Ольга Соколова");
    await startCurrentWorkout(page);
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    const original = "Во втором движении появилось тянущее ощущение в левом плече. Резкой боли не было.";
    await page.getByRole("textbox", { name: "Дискомфорт, если был" }).fill(original);
    await page.getByLabel("Область, необязательно").fill("Левое плечо");
    await page.getByRole("button", { name: "Завершить тренировку" }).click();
    await page.getByRole("button", { name: "Подтвердить завершение" }).click();
    await expect(page.getByText("Дискомфорт отмечен", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Вернуться в кабинет тренера" }).click();
    await openQueueReview(page, "Ольга Соколова", true);
    await expect(page.getByText(original, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/диагноз/i)).toHaveCount(0);
    const feedback = "Спасибо, что отметила ощущение. Перед следующей тренировкой отдельно уточним самочувствие.";
    await sendFeedback(page, feedback);
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("link", { name: "Открыть вид клиента" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
  });

  test("D: leaving and returning resumes the same session with saved set", async ({ page }) => {
    await assignAndOpenClient(page, "maria-volkova", "Силовая база", "Мария Волкова");
    await startCurrentWorkout(page);
    const sessionUrl = page.url();
    await expect(page.getByLabel("Вес, кг")).toHaveCount(1);
    await expect(page.getByLabel("Повторы")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Пропустить упражнение" })).toHaveCount(1);
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    await page.reload();
    await expect(page.getByText("1 из 12 подходов сохранено", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Главная" }).click();
    await expect(page.getByRole("link", { name: "Продолжить тренировку" })).toBeVisible();
    await page.getByRole("link", { name: "Продолжить тренировку" }).click();
    await expect(page).toHaveURL(new RegExp(`session=${new URL(sessionUrl).searchParams.get("session")}`));
    await expect(page.getByText("1 из 12 подходов сохранено", { exact: true })).toBeVisible();
  });

  test("E: double start and completion create one session and one attention item", async ({ page }) => {
    await assignAndOpenClient(page, "maria-volkova", "Силовая база", "Мария Волкова");
    await page.getByRole("link", { name: "Начать тренировку" }).click();
    await page.getByRole("button", { name: "Начать тренировку" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await expect(page).toHaveURL(/session=session-demo-assignment-maria-volkova/);
    await page.getByRole("button", { name: "Завершить тренировку" }).click();
    await page.getByRole("button", { name: "Подтвердить завершение" }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
    await page.getByRole("link", { name: "Вернуться в кабинет тренера" }).click();
    await page.getByRole("link", { name: "Главная", exact: true }).click();
    const queue = page.getByRole("list", { name: "Очередь внимания" });
    await expect(queue.getByText("Мария Волкова", { exact: true })).toHaveCount(1);
  });

  test("F: unknown actor, session and cross-athlete IDs fail closed", async ({ page }) => {
    await page.goto("/client/me?actor=unknown-athlete");
    await expect(page.getByRole("heading", { name: "Клиент не найден" })).toBeVisible();
    await expect(page.getByText("Артём Смирнов", { exact: true })).toHaveCount(0);
    await page.goto("/client/workouts?actor=maria-volkova&session=unknown-session");
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
    await page.goto("/client/workouts?actor=egor-nikitin&assignment=demo-assignment-maria-volkova-strength-base-v3-2026-07-22");
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
  });

  test("G: mobile 390x844 completes the linked role loop without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await assignAndOpenClient(page, "maria-volkova", "Силовая база", "Мария Волкова");
    await expectNoHorizontalOverflow(page);
    await startCurrentWorkout(page);
    await expectNoHorizontalOverflow(page);
    await expectControlWithinViewportWidth(page, page.getByRole("button", { name: "Следующий", exact: true }));
    await page.locator("#client-session-comment").scrollIntoViewIfNeeded();
    await expectMobileHeaderPinned(page);
    await page.getByRole("button", { name: "Сохранить" }).first().click();
    const completeWorkout = page.getByRole("button", { name: "Завершить тренировку" });
    await completeWorkout.scrollIntoViewIfNeeded();
    await expectControlAboveNavigation(page, completeWorkout, "Кабинет клиента");
    await completeWorkout.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Подтвердить завершение" }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "Вернуться в кабинет тренера" }).click();
    await openQueueReview(page, "Мария Волкова");
    await expectNoHorizontalOverflow(page);
    const feedback = "Мобильный цикл принят. Следующую тренировку проведём в том же спокойном темпе.";
    await sendFeedback(page, feedback);
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("link", { name: "Открыть вид клиента" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

async function assignAndOpenClient(page: Page, athleteId: string, templateName: string, athleteName: string) {
  await page.goto(`/trainer/clients/${athleteId}`);
  await page.getByRole("tab", { name: "Тренировки" }).click();
  await page.getByRole("button", { name: "Назначить из шаблона" }).click();
  await page.getByRole("tab", { name: "Все шаблоны" }).click();
  await page.getByRole("option", { name: new RegExp(`^${templateName}`) }).first().click();
  await page.getByRole("button", { name: "Сегодня" }).click();
  await page.getByRole("button", { name: "Назначить тренировку" }).click();
  await expect(page.getByRole("status")).toContainText(athleteName);
  await page.getByRole("link", { name: "Открыть вид клиента" }).click();
  await expect(page).toHaveURL(new RegExp(`/client/me\\?actor=${athleteId}`));
  await expect(page.getByRole("heading", { name: new RegExp(athleteName.split(" ")[0]) }).first()).toBeVisible();
}

async function startCurrentWorkout(page: Page) {
  await page.getByRole("link", { name: "Начать тренировку" }).click();
  await page.getByRole("button", { name: "Начать тренировку" }).click();
  await expect(page).toHaveURL(/\/client\/workouts\?.*session=/);
}

async function saveAllVisibleSets(page: Page) {
  while (await page.getByRole("button", { name: "Сохранить" }).count()) {
    await page.getByRole("button", { name: "Сохранить" }).first().click();
  }
}

async function openQueueReview(page: Page, athleteName: string, useLast = false) {
  if (!new URL(page.url()).pathname.endsWith("/trainer/dashboard")) {
    await page.getByRole("link", { name: "Главная", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/trainer\/dashboard/);
  const candidates = page.getByRole("list", { name: "Очередь внимания" }).getByRole("button", { name: new RegExp(athleteName) });
  await (useLast ? candidates.last() : candidates.first()).click();
  await page.getByRole("link", { name: /Полный разбор/ }).click();
  await expect(page.getByText(athleteName, { exact: true }).first()).toBeVisible();
}

async function sendFeedback(page: Page, feedback: string) {
  await page.getByLabel("Сообщение клиенту").fill(feedback);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(page.getByText("Задача закрыта", { exact: true })).toBeVisible();
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

async function expectMobileHeaderPinned(page: Page) {
  await expect.poll(async () => Math.round((await page.getByRole("banner").boundingBox())?.y ?? -999)).toBe(0);
}

async function expectControlWithinViewportWidth(page: Page, control: ReturnType<Page["getByRole"]>) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
}

async function expectControlAboveNavigation(page: Page, control: ReturnType<Page["getByRole"]>, navigationName: string) {
  const controlBox = await control.boundingBox();
  const navigationBox = await page.getByRole("navigation", { name: navigationName }).last().boundingBox();
  expect(controlBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(controlBox!.y + controlBox!.height).toBeLessThanOrEqual(navigationBox!.y);
}
