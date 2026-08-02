import { expect, test, type Page } from "@playwright/test";

test.describe("Trainer core flow integration", () => {
  test("A: review to next assignment keeps one athlete and advances the queue", async ({ page }) => {
    const writes = trackRemoteWrites(page);
    await page.goto("/trainer/dashboard");
    await selectQueueAthlete(page, "Артём Смирнов");
    await page.getByRole("button", { name: "Разобрать", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("Артём Смирнов");

    const feedback = "Вижу снижение нагрузки. На следующей тренировке держим спокойный темп и RPE до 7.";
    await page.getByLabel("Сообщение клиенту").fill(feedback);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(page.getByRole("button", { name: "Отправляем…" })).toBeDisabled();
    await expect(page.getByText("Задача закрыта", { exact: true })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText(feedback, { exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Назначить следующую" }).click();
    await expect(page.getByRole("dialog")).toContainText("Артём Смирнов");
    await page.getByRole("option", { name: /День тяги/ }).click();
    await page.getByRole("button", { name: "Назначить тренировку" }).click();
    await expect(page.getByRole("button", { name: "Назначаем…" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Назначено");
    await page.getByRole("link", { name: "Открыть профиль" }).click();

    await expect(page).toHaveURL(/\/trainer\/clients\/artem-smirnov/);
    await page.getByRole("tab", { name: "Обзор" }).click();
    await expect(page.getByText(feedback, { exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await expect(page.getByText("День тяги", { exact: true }).first()).toBeVisible();
    await page.getByRole("link", { name: "Главная", exact: true }).first().click();

    await expect(page).toHaveURL(/\/trainer\/dashboard/);
    await expect(page.getByRole("list", { name: "Очередь внимания" })).not.toContainText("Артём Смирнов");
    await expect(page.getByText("Ольга Соколова", { exact: true }).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("B: no-template flow publishes in Builder and assigns through Quick Assign", async ({ page }) => {
    const writes = trackRemoteWrites(page);
    await page.goto("/trainer/clients/alexandra-konstantinova");
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await page.getByRole("button", { name: "Назначить из шаблона" }).click();
    await expect(page.getByText("Сохранённых шаблонов пока нет")).toBeVisible();
    await page.getByRole("button", { name: "Создать шаблон" }).click();

    await expect(page).toHaveURL(/\/trainer\/builder\?/);
    await page.getByLabel("Название шаблона").fill("Стартовая силовая Александры");
    await page.getByRole("button", { name: "Опубликовать и назначить" }).click();
    await expect(page.getByRole("dialog")).toContainText("Шаблон пока нельзя опубликовать");
    await expect(page.getByRole("dialog")).toContainText("Добавьте минимум одно упражнение");
    await page.getByRole("button", { name: "Вернуться к исправлениям" }).click();
    await page.getByRole("tab", { name: "Базовая библиотека" }).click();
    await page.getByRole("button", { name: "Добавить в шаблон" }).first().click();
    await page.getByRole("button", { name: "Опубликовать и назначить" }).click();
    await expect(page.getByRole("button", { name: "Публикуем…" })).toBeDisabled();

    await expect(page.getByRole("dialog")).toContainText("Быстрое назначение");
    await expect(page.getByRole("option", { name: /Стартовая силовая Александры/ })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Назначить тренировку" }).click();
    await expect(page.getByRole("status")).toContainText("Стартовая силовая Александры");
    await page.getByRole("link", { name: "Открыть профиль" }).click();
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await expect(page.getByText("Стартовая силовая Александры", { exact: true }).first()).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("C: calm athlete assignment appears in Profile without a fabricated attention item", async ({ page }) => {
    await page.goto("/trainer/clients/maria-volkova");
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await page.getByRole("button", { name: "Назначить из шаблона" }).click();
    await page.getByRole("option", { name: /^Силовая база Базовая/ }).click();
    await page.getByRole("button", { name: "Сегодня" }).click();
    await page.getByRole("button", { name: "Назначить тренировку" }).click();
    await expect(page.getByRole("button", { name: "Назначаем…" })).toBeDisabled();
    await page.getByRole("button", { name: "Открыть тренировку" }).click();
    await expect(page.getByText("Силовая база", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/искусственн/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Назначить из шаблона" }).click();
    await page.getByRole("option", { name: /^Силовая база Базовая/ }).click();
    await page.getByRole("button", { name: "Сегодня" }).click();
    await expect(page.getByRole("alert")).toContainText("уже назначена на эту дату");
    await expect(page.getByRole("button", { name: "Назначить тренировку" })).toBeDisabled();
  });

  test("Builder restores an unsaved draft after reload and saves it without silent renaming", async ({ page }) => {
    const draftTitle = "Черновик для восстановления";
    await page.goto("/trainer/builder");
    await page.getByRole("button", { name: "Новый шаблон" }).click();
    await expect(page.getByText("Есть несохранённые изменения", { exact: true })).toBeVisible();
    await page.getByLabel("Название шаблона").fill(draftTitle);
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("ai-strength-coach:builder-active-draft:v1"))).toContain(draftTitle);
    await page.reload();
    await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("ai-strength-coach:builder-active-draft:v1"))).toContain(draftTitle);

    await expect(page.getByRole("dialog")).toContainText("Восстановить черновик?");
    await page.getByRole("button", { name: "Восстановить черновик" }).click();
    await expect(page.getByLabel("Название шаблона")).toHaveValue(draftTitle);
    await expect(page.getByText("Есть несохранённые изменения", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByRole("button", { name: "Сохраняем…" })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText(`Черновик «${draftTitle}» сохранён.`);
    await expect(page.getByText("Сохранено", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Вернуться к шаблонам" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(draftTitle, { exact: true })).toBeVisible();
  });

  test("core surfaces use product language and hide internal identifiers", async ({ page }) => {
    const internalTerms = /WorkoutTemplate|WorkoutSession|SetLog|AttentionItem|Assignment semantics|revision|snapshot|Demo actor|browser session|drawer/i;

    await page.goto("/trainer/dashboard");
    await expect(page.getByRole("region", { name: /\d+ клиент(?:а|ов)? требу(?:ет|ют) решения/ })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(internalTerms);

    await page.goto("/trainer/clients/alexandra-konstantinova");
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await page.getByRole("button", { name: "Назначить из шаблона" }).click();
    expect(await page.getByRole("dialog").innerText()).not.toMatch(internalTerms);

    await page.goto("/trainer/builder?templateId=missing-template");
    await expect(page.getByRole("heading", { name: "Шаблон не найден" })).toBeVisible();
    let bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("missing-template");
    expect(bodyText).not.toMatch(internalTerms);

    await page.goto("/trainer/review/missing-review");
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" }).last()).toBeVisible();
    bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("missing-review");
    expect(bodyText).not.toMatch(internalTerms);

    await page.goto("/client/workouts?actor=maria-volkova&session=missing-session");
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
    bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("missing-session");
    expect(bodyText).not.toMatch(internalTerms);
  });

  test("D: discomfort keeps original athlete text after careful feedback", async ({ page }) => {
    const originalText = "После тяговой тренировки появилось тянущее ощущение в плече. Резкой боли не было.";
    const feedback = "Спасибо, что отметила ощущение. Пока уберём провоцирующее движение и уточним самочувствие перед следующим днём.";
    await page.goto("/trainer/dashboard");
    await selectQueueAthlete(page, "Ольга Соколова");
    await page.getByRole("link", { name: /Полный разбор/ }).click();
    await expect(page.getByText(originalText).first()).toBeVisible();
    await page.getByLabel("Сообщение клиенту").fill(feedback);
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await expect(page.getByText("Задача закрыта", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "К профилю" }).click();
    await page.getByRole("tab", { name: "Обзор" }).click();
    await expect(page.getByText(feedback, { exact: true }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Тренировки" }).click();
    await expect(page.getByText(originalText, { exact: true })).toBeVisible();
  });

  test("manual resolution closes attention without creating trainer feedback", async ({ page }) => {
    await page.goto("/trainer/dashboard");
    await selectQueueAthlete(page, "Артём Смирнов");
    await page.getByRole("button", { name: "Разобрать", exact: true }).click();
    await page.getByRole("button", { name: "Закрыть без сообщения" }).click();
    await page.getByRole("button", { name: "Подтвердить закрытие" }).click();
    await expect(page.getByText("Задача закрыта", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Профиль", exact: true }).click();
    await expect(page.getByText("Разбор закрыт без сообщения", { exact: true })).toBeVisible();
    await expect(page.getByText("Подробный feedback", { exact: true })).toHaveCount(0);
  });

  test("E: unknown IDs render safe not-found states without wrong-data fallback", async ({ page }) => {
    await page.goto("/trainer/clients/unknown-athlete");
    await expect(page.getByRole("heading", { name: "Спортсмен не найден" })).toBeVisible();
    await expect(page.getByText("Артём Смирнов", { exact: true })).toHaveCount(0);
    await page.goto("/trainer/review/unknown-session");
    await expect(page.getByRole("heading", { name: "Тренировка не найдена" })).toBeVisible();
    await expect(page.getByText("Мария Волкова", { exact: true })).toHaveCount(0);
    await page.goto("/trainer/builder?templateId=unknown-template&from=templates");
    await expect(page.getByRole("heading", { name: "Шаблон не найден" })).toBeVisible();
    await expect(page.getByText("Силовая база", { exact: true })).toHaveCount(0);
  });

  test("F: mobile 390x844 core transitions do not overflow or hide primary CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trainer/dashboard");
    await expectNoHorizontalOverflow(page);
    await expectMobileHeaderPinned(page);
    await selectQueueAthlete(page, "Артём Смирнов");
    await page.getByRole("link", { name: /Полный разбор/ }).click();
    await page.getByRole("link", { name: "К профилю" }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Разобрать тренировку" }).click();
    await page.getByRole("link", { name: /Открыть подробный разбор/ }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Назначить следующую" }).click();
    await page.getByRole("option", { name: /День тяги/ }).click();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Открыть шаблон" }).click();
    await page.getByRole("button", { name: "Отказаться" }).click();
    await expect(page).toHaveURL(/\/trainer\/builder\?/);
    await expectNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Назначить", exact: true }).click();
    await page.getByRole("button", { name: "Сегодня" }).click();
    await page.getByRole("button", { name: "Назначить тренировку" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole("link", { name: "На главную" }).click();
    await expect(page).toHaveURL(/\/trainer\/dashboard/);
    await expectNoHorizontalOverflow(page);
  });

  test("mobile Builder opens a template at the beginning of its workspace", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trainer/builder");
    const openTemplate = page.getByRole("button", { name: "Открыть", exact: true }).first();
    await openTemplate.waitFor();
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "auto" }));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await openTemplate.click();

    await expect(page.getByRole("button", { name: /Создать новую версию|Сохранить черновик/ }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
  });
});

async function selectQueueAthlete(page: Page, name: string) {
  const athlete = page.getByRole("list", { name: "Очередь внимания" }).getByRole("button", { name: new RegExp(name) });
  await athlete.focus();
  await athlete.click();
  await expect(
    page.getByRole("region", { name: "Следующее решение" }).getByRole("heading", { name, exact: true })
  ).toBeVisible();
}

function trackRemoteWrites(page: Page) {
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && !request.url().startsWith("http://127.0.0.1:3100/_next/")) {
      writes.push(`${request.method()} ${request.url()}`);
    }
  });
  return writes;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectMobileHeaderPinned(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: Math.min(600, document.documentElement.scrollHeight - innerHeight), behavior: "auto" }));
  await expect.poll(async () => Math.round((await page.getByRole("banner").boundingBox())?.y ?? -999)).toBe(0);
}
