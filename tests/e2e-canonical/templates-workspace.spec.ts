import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { expect, test, type Page } from "@playwright/test";

const execFile = promisify(execFileCallback);
const baseURL = "http://127.0.0.1:3101";
const trainerEmail = `templates.workspace.e2e.${Date.now()}@example.test`;

test("canonical Templates Workspace supports lifecycle, commands and responsive return context", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  const runtimeErrors: string[] = [];
  const workspaceRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("request", (request) => {
    if (request.method() === "GET" && request.url().includes("/api/trainer/workout-builder/workspace?")) {
      workspaceRequests.push(request.url());
    }
  });

  try {
    await activateTrainer(page);
    const templates = [];
    for (let index = 0; index < 28; index += 1) {
      templates.push(await createDraft(page, index));
    }
    const publishedOnly = await publish(page, templates[0]);
    const publishedWithDraft = await publish(page, templates[1]);
    const editableUpdate = await createRevision(page, publishedWithDraft);
    await archive(page, templates[2]);
    await page.goto(`/trainer/builder/${publishedWithDraft.id}`);
    await page.getByLabel("Название", { exact: true }).fill("Workspace Draft Update 01");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();

    const publishedOnlyEditor = await page.request.get(
      `/api/trainer/workout-builder/templates/${publishedOnly.id}/editor?view=published`,
    );
    expect(publishedOnlyEditor.status()).toBe(200);
    expect(publishedOnlyEditor.headers()["cache-control"]).toBe("no-store");
    expect((await publishedOnlyEditor.json() as { editor: { mode: string; identity: { selectedRevisionId: string } } }).editor)
      .toMatchObject({ mode: "published", identity: { selectedRevisionId: publishedOnly.revisionId } });

    const updateDefaultEditor = await page.request.get(
      `/api/trainer/workout-builder/templates/${publishedWithDraft.id}/editor`,
    );
    expect(updateDefaultEditor.status()).toBe(200);
    expect((await updateDefaultEditor.json() as { editor: { mode: string; identity: { selectedRevisionId: string }; content: { title: string } } }).editor)
      .toMatchObject({ mode: "editable", identity: { selectedRevisionId: editableUpdate.revisionId }, content: { title: "Workspace Draft Update 01" } });

    const updatePublishedEditor = await page.request.get(
      `/api/trainer/workout-builder/templates/${publishedWithDraft.id}/editor?view=published`,
    );
    expect(updatePublishedEditor.status()).toBe(200);
    expect((await updatePublishedEditor.json() as {
      editor: { mode: string; identity: { selectedRevisionId: string }; lifecycle: { editableRevisionSummary: unknown }; content: { title: string } };
    }).editor).toMatchObject({
      mode: "published",
      identity: { selectedRevisionId: publishedWithDraft.revisionId },
      lifecycle: { editableRevisionSummary: { revisionId: editableUpdate.revisionId } },
      content: { title: "Workspace Update 01" },
    });

    const archivedEditor = await page.request.get(
      `/api/trainer/workout-builder/templates/${templates[2].id}/editor?view=archived`,
    );
    expect(archivedEditor.status()).toBe(200);
    expect((await archivedEditor.json() as { editor: { mode: string } }).editor.mode).toBe("archived");
    expect((await page.request.get(
      `/api/trainer/workout-builder/templates/${publishedOnly.id}/editor?view=editable`,
    )).status()).toBe(409);
    expect((await page.request.get(
      `/api/trainer/workout-builder/templates/${publishedOnly.id}/editor?view=history`,
    )).status()).toBe(400);

    const guest = await browser.newContext({ baseURL });
    try {
      expect((await guest.request.get(
        `/api/trainer/workout-builder/templates/${publishedOnly.id}/editor`,
      )).status()).toBe(401);
    } finally {
      await guest.close();
    }

    await page.goto("/trainer/dashboard");
    await page.getByRole("link", { name: "Шаблоны", exact: true }).click();
    await expect(page).toHaveURL(/\/trainer\/templates$/);
    await expect(page.getByRole("heading", { name: "Шаблоны", exact: true })).toBeVisible();
    await expect(page.getByText("Найдено 27", { exact: true })).toBeVisible();
    const collection = page.getByRole("list", { name: "Шаблоны тренировок" });
    await expect(collection.getByRole("listitem")).toHaveCount(25);
    await expect(collection.getByText("Ещё не опубликован", { exact: true }).first()).toBeVisible();
    await expect(collection.getByText("Доступна для назначения", { exact: true }).first()).toBeVisible();
    await expect(collection.getByText("Есть черновик версии 2", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Назначить тренировку" })).toHaveCount(0);
    expect(workspaceRequests).toHaveLength(1);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/canonical/templates-workspace-desktop.png", fullPage: true });

    await page.getByRole("button", { name: "Показать ещё" }).press("Enter");
    await expect(collection.getByRole("listitem")).toHaveCount(27);
    await expect(page.getByText("Все шаблоны показаны", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/page=2/);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? "")).toMatch(/^template-row-action-/);
    expect(workspaceRequests).toHaveLength(2);
    await expect(page.getByText(/Добавлено шаблонов: 2\. Всего показано: 27\./)).toHaveCount(1);
    await page.waitForTimeout(250);
    expect(workspaceRequests).toHaveLength(2);

    const requestsBeforeColdReload = workspaceRequests.length;
    await page.reload();
    await expect(collection.getByRole("listitem")).toHaveCount(27);
    await expect.poll(() => workspaceRequests.length).toBe(requestsBeforeColdReload + 2);
    expect(new URL(page.url()).searchParams.get("page")).toBe("2");

    const search = page.getByLabel("Поиск шаблонов");
    await search.fill("Workspace Published 00");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=Workspace\+Published\+00/);
    expect(new URL(page.url()).searchParams.get("page")).toBeNull();
    await expect(page.getByText("Найдено 1", { exact: true })).toBeVisible();
    await expect(collection.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(page.getByText("Найдено 27", { exact: true })).toBeVisible();

    await page.getByLabel("Категория").selectOption("мобильность");
    await expect(page).toHaveURL(/category=/);
    await expect(page.getByText("Найдено 14", { exact: true })).toBeVisible();
    await page.getByLabel("Категория").selectOption("");
    await expect(page.getByText("Найдено 27", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Готовые · 1/ }).click();
    await expect(page).toHaveURL(/status=published/);
    const publishedRow = collection.getByRole("listitem").filter({ hasText: "Workspace Published 00" });
    await expect(publishedRow).toBeVisible();
    const overflow = publishedRow.getByRole("button", { name: /Действия с шаблоном/ });
    await overflow.press("Enter");
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")).toBe("Создать новую версию");
    await page.keyboard.press("Tab");
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "")).toBe("Дублировать");
    await page.keyboard.press("Escape");
    await expect(overflow).toBeFocused();
    await overflow.press("Space");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    const duplicateDialog = page.getByRole("dialog", { name: "Дублировать шаблон?" });
    await duplicateDialog.getByRole("button", { name: "Отмена" }).click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")).toContain("Действия с шаблоном");
    await overflow.press("Enter");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await duplicateDialog.getByLabel("Название копии").fill("Копия для возврата");
    const duplicatePayloads: Array<Record<string, unknown>> = [];
    await page.route("**/api/trainer/workout-builder/templates/duplicate", async (route) => {
      duplicatePayloads.push(route.request().postDataJSON() as Record<string, unknown>);
      if (duplicatePayloads.length === 1) {
        const successfulResponse = await route.fetch();
        expect(successfulResponse.status()).toBe(201);
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
        return;
      }
      await route.continue();
    });
    await duplicateDialog.getByRole("button", { name: "Дублировать и открыть" }).click();
    const duplicateError = duplicateDialog.getByRole("alert");
    await expect(duplicateError).toContainText("Название сохранено");
    await expect(duplicateDialog.getByLabel("Название копии")).toHaveValue("Копия для возврата");
    await expect(duplicateError).toBeFocused();
    await duplicateDialog.getByRole("button", { name: "Повторить дублирование" }).click();
    await expect(page).toHaveURL(/\/trainer\/builder\/[0-9a-f-]{36}/);
    expect(duplicatePayloads).toHaveLength(2);
    expect(duplicatePayloads[1]).toEqual(duplicatePayloads[0]);
    await page.unroute("**/api/trainer/workout-builder/templates/duplicate");
    await expect(page.getByLabel("Название")).toHaveValue("Копия для возврата");
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page).toHaveURL(/\/trainer\/templates\?status=published/);
    await expect(page.getByText("Найдено 1", { exact: true })).toBeVisible();

    await page.goto("/trainer/templates?status=updates&q=Workspace+Draft+Update+01");
    const updateRow = collection.getByRole("listitem").filter({ hasText: "Workspace Draft Update 01" });
    await updateRow.getByRole("link", { name: /Продолжить редактирование/ }).click();
    await expect(page).toHaveURL(new RegExp(`/trainer/builder/${publishedWithDraft.id}\\?returnTo=`));
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Workspace Draft Update 01");
    await page.getByRole("button", { name: "Назад" }).click();
    await expect(page).toHaveURL(/\/trainer\/templates\?status=updates.*anchor=/);
    const returnedUpdateRow = page.getByRole("list", { name: "Шаблоны тренировок" }).getByRole("listitem").filter({ hasText: "Workspace Draft Update 01" });
    await returnedUpdateRow.getByRole("button", { name: /Действия с шаблоном/ }).click();
    await page.getByRole("link", { name: "Посмотреть опубликованную версию", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/trainer/builder/${publishedWithDraft.id}\\?view=published&returnTo=`));
    await expect(page.getByRole("heading", { name: "Workspace Update 01", exact: true }).last()).toBeVisible();
    await expect(page.getByLabel("Название", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Продолжить черновик" })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/view=published/);
    await expect(page.getByRole("heading", { name: "Workspace Update 01", exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "Продолжить черновик" }).click();
    await expect(page).toHaveURL(new RegExp(`/trainer/builder/${publishedWithDraft.id}\\?returnTo=`));
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Workspace Draft Update 01");
    const exactDraftAfterReturn = await page.request.get(`/api/trainer/workout-builder/templates/${publishedWithDraft.id}/editor?view=editable`);
    expect((await exactDraftAfterReturn.json() as { editor: { identity: { selectedRevisionId: string } } }).editor.identity.selectedRevisionId).toBe(editableUpdate.revisionId);
    await page.getByRole("button", { name: "Назад" }).click();
    await page.goto("/trainer/templates?status=published");

    const returnedRow = collection.getByRole("listitem").filter({ hasText: "Workspace Published 00" });
    await returnedRow.getByRole("button", { name: /Действия с шаблоном/ }).click();
    await page.getByRole("button", { name: "Архивировать", exact: true }).click();
    const archiveDialog = page.getByRole("dialog", { name: /Архивировать «Workspace Published 00»/ });
    await expect(archiveDialog).toContainText("Существующие назначения не изменятся");
    const archivePayloads: Array<Record<string, unknown>> = [];
    await page.route(`**/api/trainer/workout-builder/templates/${publishedOnly.id}/archive`, async (route) => {
      archivePayloads.push(route.request().postDataJSON() as Record<string, unknown>);
      if (archivePayloads.length === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
        return;
      }
      await route.continue();
    });
    await archiveDialog.getByRole("button", { name: "Архивировать", exact: true }).click();
    const archiveError = archiveDialog.getByRole("alert");
    await expect(archiveError).toContainText("Не удалось архивировать шаблон");
    await expect(archiveError).toBeFocused();
    await expect(page.locator(`#template-row-${publishedOnly.id}`)).toBeVisible();
    await archiveDialog.getByRole("button", { name: "Повторить архивацию" }).click();
    expect(archivePayloads).toHaveLength(2);
    expect(archivePayloads[1]).toEqual(archivePayloads[0]);
    await page.unroute(`**/api/trainer/workout-builder/templates/${publishedOnly.id}/archive`);
    await expect(page.getByRole("status").getByText("Шаблон перемещён в архив.", { exact: true })).toBeVisible();
    await expect(page.getByText("Найдено 0", { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /Фильтры/ }).click();
    const filterSheet = page.getByRole("dialog", { name: "Фильтры шаблонов" });
    await filterSheet.getByLabel("Архив", { exact: true }).check();
    await filterSheet.getByRole("button", { name: "Показать результаты" }).click();
    await expect(page).toHaveURL(/status=archive/);
    await expect(collection.getByText("В архиве", { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: "test-results/canonical/templates-workspace-mobile.png", fullPage: true });

    await page.setViewportSize({ width: 720, height: 512 });
    await expectNoHorizontalOverflow(page);
    expect(runtimeErrors.filter((message) => !message.includes("status of 503"))).toEqual([]);

    expect(publishedOnly.id).toMatch(/^[0-9a-f-]{36}$/);
  } finally {
    await context.close();
  }
});

async function activateTrainer(page: Page) {
  await page.goto("/login");
  await signInWithDevelopmentOtp(page, trainerEmail);
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Как вас зовут").fill("Тренер Templates E2E");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Имя сохранено.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Запросить доступ" }).click();
  await runOperator(["activate-trainer", "--email", trainerEmail]);
  await page.getByRole("button", { name: "Проверить доступ" }).click();
  await expect(page.getByRole("link", { name: "Открыть кабинет" })).toBeVisible();
}

async function signInWithDevelopmentOtp(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Получить код" }).click();
  const localCode = page.locator("p.font-mono");
  await expect(localCode).toBeVisible();
  const code = (await localCode.textContent())?.trim() ?? "";
  await page.getByLabel("Код из письма").fill(code);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("link", { name: "Продолжить" }).click();
}

async function createDraft(page: Page, index: number) {
  const templateId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const title = index === 0 ? "Workspace Published 00" : index === 1 ? "Workspace Update 01" : `Workspace Draft ${String(index).padStart(2, "0")}`;
  const category = index % 2 === 0 ? "Сила" : "Мобильность";
  const response = await page.request.post("/api/trainer/workout-builder/templates", {
    headers: { Origin: baseURL },
    data: {
      commandId: crypto.randomUUID(),
      templateId,
      revisionId,
      expectedEditToken: null,
      content: {
        id: templateId,
        revisionId,
        title,
        revision: 1,
        description: `Поисковое описание ${index}`,
        category,
        estimatedDurationMin: "35",
        generalInstruction: "Спокойный рабочий темп.",
        items: [{
          id: `workspace-row-${index}`,
          kind: "exercise",
          exercise: {
            instanceId: `workspace-exercise-${index}`,
            exerciseId: `workspace-exercise-${index}`,
            title: "Техническое упражнение",
            category,
            prescription: { type: "repetitions", sets: "3", repetitionMode: "fixed", repetitionsMin: "8", repetitionsMax: "8", durationSec: "", targetWeightKg: "", restSec: "90" },
            perSetMode: false,
            setOverrides: [],
            trainerNote: "",
          },
        }],
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json() as { template: { id: string; revisionId: string; editToken: string; templateToken: string } }).template;
}

async function publish(page: Page, template: { id: string; revisionId: string; editToken: string }) {
  const response = await page.request.post(`/api/trainer/workout-builder/templates/${template.id}/publish`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), revisionId: template.revisionId, expectedEditToken: template.editToken },
  });
  expect(response.status()).toBe(200);
  return (await response.json() as { template: { id: string; revisionId: string; templateToken: string } }).template;
}

async function createRevision(page: Page, template: { id: string; templateToken: string }) {
  const response = await page.request.post(`/api/trainer/workout-builder/templates/${template.id}/revisions`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), expectedTemplateToken: template.templateToken },
  });
  expect(response.status()).toBe(201);
  return (await response.json() as {
    template: { id: string; revisionId: string; editToken: string; templateToken: string };
  }).template;
}

async function archive(page: Page, template: { id: string; templateToken: string }) {
  const response = await page.request.post(`/api/trainer/workout-builder/templates/${template.id}/archive`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), expectedTemplateToken: template.templateToken },
  });
  expect(response.status()).toBe(200);
}

async function runOperator(args: string[]) {
  const currentOptions = process.env.NODE_OPTIONS?.trim();
  await execFile(process.execPath, ["--import", "tsx", "scripts/ops/local-pilot.ts", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_OPTIONS: [currentOptions, "--conditions=react-server"].filter(Boolean).join(" ") },
    maxBuffer: 1024 * 1024,
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}
