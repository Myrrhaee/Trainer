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
    await expect(page.getByRole("alert")).toContainText("Demo-сохранение не удалось");
    await page.getByRole("button", { name: "Повторить отправку" }).click();
    await expect(page.getByText("Задача закрыта", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Назначить следующую" }).click();
    await expect(page.getByRole("dialog")).toContainText("Артём Смирнов");
    await page.getByRole("option", { name: /День тяги/ }).click();
    await page.getByRole("button", { name: "Назначить тренировку" }).click();
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
    await page.getByRole("tab", { name: "Базовая библиотека" }).click();
    await page.getByRole("button", { name: "Добавить в шаблон" }).first().click();
    await page.getByRole("button", { name: "Сохранить и назначить" }).click();

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
    await page.getByRole("button", { name: "Открыть тренировку" }).click();
    await expect(page.getByText("Силовая база", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/искусственн/i)).toHaveCount(0);
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
    await expect(page.getByRole("heading", { name: "Тренировка не найден" })).toBeVisible();
    await expect(page.getByText("Мария Волкова", { exact: true })).toHaveCount(0);
    await page.goto("/trainer/builder?templateId=unknown-template&from=templates");
    await expect(page.getByRole("heading", { name: "Шаблон не найден" })).toBeVisible();
    await expect(page.getByText("Силовая база", { exact: true })).toHaveCount(0);
  });

  test("F: mobile 390x844 core transitions do not overflow or hide primary CTA", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trainer/dashboard");
    await expectNoHorizontalOverflow(page);
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
});

async function selectQueueAthlete(page: Page, name: string) {
  await page.getByRole("list", { name: "Очередь внимания" }).getByRole("button", { name: new RegExp(name) }).click();
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
