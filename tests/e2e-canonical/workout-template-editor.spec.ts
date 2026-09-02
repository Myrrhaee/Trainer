import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

const execFile = promisify(execFileCallback);
const baseURL = "http://127.0.0.1:3101";
const trainerEmail = `template.editor.e2e.${Date.now()}@example.test`;

test("canonical Editor creates no row before Save and publishes an exact Library-backed Draft", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await activateTrainer(page);
    const before = await workspaceCount(page);
    await page.goto("/trainer/builder/new?returnTo=%2Ftrainer%2Ftemplates");
    await expect(page.getByRole("heading", { level: 1, name: "Новый шаблон" })).toHaveCount(1);
    await expect(page.getByText("Не сохранено · Без изменений", { exact: true })).toBeVisible();
    expect(await workspaceCount(page)).toBe(before);

    await page.getByRole("button", { name: "Добавить упражнение" }).first().click();
    const sheet = page.getByRole("dialog", { name: "Библиотека упражнений" });
    await expect(sheet).toBeVisible();
    const firstExercise = sheet.getByRole("list", { name: "Упражнения" }).getByRole("button").first();
    await firstExercise.click();
    await page.getByRole("button", { name: "Добавить упражнение" }).click();
    await expect(sheet).toBeHidden();

    await page.getByLabel("Название").fill("R2D.7 Канонический шаблон");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page).toHaveURL(/\/trainer\/builder\/[0-9a-f-]{36}/);
    expect(await workspaceCount(page)).toBe((before ?? 0) + 1);
    await page.reload();
    await expect(page.getByLabel("Название")).toHaveValue("R2D.7 Канонический шаблон");

    await page.locator("#template-composition button[aria-expanded]").first().click();
    await page.getByLabel("Подходы").fill("3");
    await page.getByLabel("Повторения", { exact: true }).fill("8");
    await page.getByLabel("Отдых, сек").fill("90");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByRole("heading", { name: "Шаблон опубликован" })).toBeVisible();
    await expect(page.getByText("доступен для назначения", { exact: false })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("legacy Builder URLs normalize without rendering or mutating the old Builder", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  try {
    await activateTrainer(page, `template.editor.compat.${Date.now()}@example.test`);
    const before = await workspaceCount(page);

    await page.goto("/trainer/builder");
    await expect(page).toHaveURL("/trainer/templates");
    expect(await workspaceCount(page)).toBe(before);

    const returnTo = "/trainer/templates?status=drafts&q=compat&page=2";
    await page.goto(`/trainer/builder?create=1&returnTo=${encodeURIComponent(returnTo)}`);
    await expect(page).toHaveURL(`/trainer/builder/new?returnTo=${encodeURIComponent(returnTo)}`);
    expect(await workspaceCount(page)).toBe(before);

    const draft = await createDraftFixture(page, "Compatibility exact source");
    await page.goto(`/trainer/builder?templateId=${draft.id}&returnTo=${encodeURIComponent("/trainer/templates?status=drafts")}`);
    await expect(page).toHaveURL(new RegExp(`/trainer/builder/${draft.id}\\?returnTo=`));
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Compatibility exact source");

    await publishRevision(page, draft.id, draft.revisionId, draft.editToken);
    await page.goto(`/trainer/builder?templateId=${draft.id}&view=published`);
    await expect(page).toHaveURL(`/trainer/builder/${draft.id}?view=published`);
    await expect(page.getByText("Опубликованная версия", { exact: true }).first()).toBeVisible();

    for (const unsafe of [
      "/trainer/builder?templateId=missing-template",
      `/trainer/builder?clientId=${crypto.randomUUID()}`,
      `/trainer/builder?programId=${crypto.randomUUID()}&dayId=${crypto.randomUUID()}`,
      "/trainer/builder?create=1&returnTo=https%3A%2F%2Fforeign.example%2Ftrainer%2Ftemplates",
    ]) {
      await page.goto(unsafe);
      await expect(page).toHaveURL("/trainer/templates");
    }
    expect(await workspaceCount(page)).toBe((before ?? 0) + 1);
  } finally {
    await context.close();
  }
});

test("Editor command state reconciles uncertain outcomes, protects stale tabs, and remains usable under stress", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  const problems: string[] = [];
  collectBrowserProblems(page, problems);
  try {
    const email = `template.editor.quality.${Date.now()}@example.test`;
    await activateTrainer(page, email);

    const slowSaveDraft = await createDraftFixture(page, "Slow save source");
    await page.goto(`/trainer/builder/${slowSaveDraft.id}`);
    const title = page.getByLabel("Название");
    await title.fill("Frozen slow save");
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.workoutTemplateEditorGuard))).toBe(true);
    await page.evaluate(() => window.history.back());
    await expect(page.getByRole("dialog", { name: "Есть несохранённые изменения" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти без сохранения" })).toBeVisible();
    await page.getByRole("button", { name: "Остаться" }).click();
    const slowSave = delayedMutation(page, "**/api/trainer/workout-builder/templates");
    const saveClick = page.getByRole("button", { name: "Сохранить черновик" }).click();
    await slowSave.intercepted;
    await expect(title).toBeDisabled();
    await title.evaluate((node) => {
      (node as HTMLInputElement).value = "This in-flight edit must not win";
      node.dispatchEvent(new Event("input", { bubbles: true }));
    });
    slowSave.release();
    await saveClick;
    await expect(title).toHaveValue("Frozen slow save");
    await expect(page.getByText(/Сохранено$/, { exact: false })).toBeVisible();
    await page.unroute("**/api/trainer/workout-builder/templates");

    await title.fill("Unknown save persisted once");
    let unknownSavePosts = 0;
    await page.route("**/api/trainer/workout-builder/templates", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      unknownSavePosts += 1;
      await route.fetch();
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
    });
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByRole("button", { name: "Проверить сохранение" })).toBeVisible();
    await expect(title).toBeDisabled();
    await page.getByRole("button", { name: "Проверить сохранение" }).click();
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue("Unknown save persisted once");
    expect(unknownSavePosts).toBe(1);
    await page.unroute("**/api/trainer/workout-builder/templates");

    await title.fill("Unknown save replayed safely");
    const replayedSaveCommandIds: string[] = [];
    await page.route("**/api/trainer/workout-builder/templates", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      replayedSaveCommandIds.push((route.request().postDataJSON() as { commandId: string }).commandId);
      if (replayedSaveCommandIds.length === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await page.getByRole("button", { name: "Проверить сохранение" }).click();
    await expect(page.getByRole("button", { name: "Проверить сохранение" })).toHaveCount(0);
    await expect(title).toBeEnabled();
    await expect(title).toHaveValue("Unknown save replayed safely");
    expect(replayedSaveCommandIds).toHaveLength(2);
    expect(new Set(replayedSaveCommandIds).size).toBe(1);
    await page.unroute("**/api/trainer/workout-builder/templates");
    await title.fill("Temporary recovery text");
    await title.fill("Unknown save replayed safely");
    await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).every((key) => !key.startsWith("ai-strength:template-editor-recovery:")))).toBe(true);
    await page.reload();
    await expect(page.getByText("Найдены несохранённые изменения в этой вкладке")).toHaveCount(0);

    const slowPublish = delayedMutation(page, `**/api/trainer/workout-builder/templates/${slowSaveDraft.id}/publish`);
    const publishClick = page.getByRole("button", { name: "Опубликовать" }).click();
    await slowPublish.intercepted;
    await page.evaluate(() => window.history.back());
    await expect(page.getByRole("dialog", { name: "Операция ещё не завершена" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Выйти без сохранения" })).toHaveCount(0);
    slowPublish.release();
    await publishClick;
    await expect(page.getByRole("heading", { name: "Шаблон опубликован" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.includes("Шаблон опубликован"))).toBe(true);
    await page.unroute(`**/api/trainer/workout-builder/templates/${slowSaveDraft.id}/publish`);

    const unknownPublishDraft = await createDraftFixture(page, "Unknown publish source");
    await page.goto(`/trainer/builder/${unknownPublishDraft.id}`);
    const unknownPublishCommandIds: string[] = [];
    await page.route(`**/api/trainer/workout-builder/templates/${unknownPublishDraft.id}/publish`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      unknownPublishCommandIds.push((route.request().postDataJSON() as { commandId: string }).commandId);
      if (unknownPublishCommandIds.length === 1) {
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await expect(page.getByRole("button", { name: "Проверить публикацию" })).toBeVisible();
    await page.getByRole("button", { name: "Проверить публикацию" }).click();
    await expect(page.getByRole("heading", { name: "Шаблон опубликован" })).toBeVisible();
    expect(unknownPublishCommandIds).toHaveLength(2);
    expect(new Set(unknownPublishCommandIds).size).toBe(1);
    expect(await publicationSideEffects(unknownPublishDraft.id, unknownPublishCommandIds[0]!)).toEqual({ audits: 1, receipts: 1 });
    await page.unroute(`**/api/trainer/workout-builder/templates/${unknownPublishDraft.id}/publish`);
    await page.getByRole("button", { name: "Посмотреть опубликованную версию" }).click();
    const revisionCommandIds: string[] = [];
    await page.route(`**/api/trainer/workout-builder/templates/${unknownPublishDraft.id}/revisions`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      revisionCommandIds.push((route.request().postDataJSON() as { commandId: string }).commandId);
      if (revisionCommandIds.length === 1) {
        await route.fetch();
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Создать новую версию" }).click();
    await expect(page.getByRole("button", { name: "Проверить создание версии" })).toBeVisible();
    await page.getByRole("button", { name: "Проверить создание версии" }).click();
    await expect(page.getByRole("button", { name: "Проверить создание версии" })).toHaveCount(0);
    await expect(page.getByLabel("Название", { exact: true })).toBeEnabled();
    expect(revisionCommandIds).toHaveLength(2);
    expect(new Set(revisionCommandIds).size).toBe(1);
    await page.unroute(`**/api/trainer/workout-builder/templates/${unknownPublishDraft.id}/revisions`);

    const staleDraft = await createDraftFixture(page, "Two tab source");
    const staleUrl = `/trainer/builder/${staleDraft.id}`;
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    collectBrowserProblems(pageA, problems);
    collectBrowserProblems(pageB, problems);
    await Promise.all([pageA.goto(staleUrl), pageB.goto(staleUrl)]);
    await pageA.getByLabel("Название").fill("Server tab wins");
    await pageA.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(pageA.getByLabel("Название")).toHaveValue("Server tab wins");
    await pageB.getByLabel("Название").fill("Local stale copy retained");
    await pageB.getByRole("button", { name: "Сохранить черновик" }).click();
    const conflictHeading = pageB.getByRole("heading", { name: "Есть более новая серверная версия" });
    await expect(conflictHeading).toBeVisible();
    await expect.poll(() => pageB.evaluate(() => document.activeElement?.textContent)).toContain("Есть более новая серверная версия");
    await expect(pageB.getByRole("button", { name: "Сохранить черновик" })).toHaveCount(0);
    await expect(pageB.getByLabel("Название")).toHaveValue("Local stale copy retained");

    let copyPosts = 0;
    await pageB.route("**/api/trainer/workout-builder/templates", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      copyPosts += 1;
      await route.fetch();
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
    });
    await pageB.getByRole("button", { name: "Сохранить как новый шаблон" }).click();
    await expect(pageB.getByRole("button", { name: "Проверить сохранение" })).toBeVisible();
    await pageB.getByRole("button", { name: "Проверить сохранение" }).click();
    await expect(pageB).not.toHaveURL(staleUrl);
    await expect(pageB.getByLabel("Название")).toHaveValue("Local stale copy retained");
    expect(copyPosts).toBe(1);
    await pageB.unroute("**/api/trainer/workout-builder/templates");
    await Promise.all([pageA.close(), pageB.close()]);

    const stressDraft = await createDraftFixture(page, "Stress 36 exercises", 36);
    await page.goto(`/trainer/builder/${stressDraft.id}`);
    const rows = page.locator("#template-composition li[id^='exercise-']");
    await expect(rows).toHaveCount(36);
    await expect(rows.locator("button[aria-expanded='true']")).toHaveCount(0);
    const started = Date.now();
    await rows.first().locator("button[aria-expanded]").click();
    expect(Date.now() - started).toBeLessThan(3_000);
    await expect(page.getByText("Источник не связан", { exact: false }).first()).toBeVisible();
    const issueLink = page.getByRole("button", { name: "Проверьте настройки упражнения" }).first();
    await expect(issueLink).toBeVisible();
    await issueLink.click();
    await expect.poll(() => page.evaluate(() => document.activeElement?.id.startsWith("exercise-field:") ?? false)).toBe(true);
    const perSetRow = rows.nth(3);
    await perSetRow.locator("button[aria-expanded]").click();
    await perSetRow.getByLabel("Настраивать каждый подход отдельно").click();
    const conversion = page.getByRole("dialog", { name: "Изменить формат настроек?" });
    await expect(conversion.getByLabel("Целевой вес, кг")).toHaveValue("24");
    await conversion.getByLabel("Целевой вес, кг").fill("77.5");
    await conversion.getByRole("button", { name: "Применить итоговые значения" }).click();
    await expect(perSetRow.getByLabel("Настраивать каждый подход отдельно")).not.toBeChecked();
    await expect(page.getByRole("button", { name: "Вернуть" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByLabel("Название", { exact: true }).fill("Stress saved without frozen UI");
    await expect(page.getByRole("button", { name: "Сохранить черновик" })).toBeVisible();
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Stress saved without frozen UI");

    await page.setViewportSize({ width: 720, height: 512 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    const note = page.getByLabel("Заметка тренера").first();
    await note.focus();
    await note.fill("Длинная заметка для проверки экранной клавиатуры и устойчивого положения активного поля.");
    await page.setViewportSize({ width: 390, height: 500 });
    await note.scrollIntoViewIfNeeded();
    const noteBox = await note.boundingBox();
    expect(noteBox).not.toBeNull();
    expect((noteBox?.x ?? -1) + (noteBox?.width ?? 0)).toBeLessThanOrEqual(391);
    await expectNoHorizontalOverflow(page);
    expect(problems.filter((problem) => !/Failed to load resource:.*(?:503|409)/.test(problem))).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Editor preserves recovery decisions, exact issue focus, grouped order, and safe Save and Exit targets", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  try {
    await activateTrainer(page, `template.editor.correctness.${Date.now()}@example.test`);

    const recoveryDraft = await createDraftFixture(page, "Recovery baseline");
    await page.goto(`/trainer/builder/${recoveryDraft.id}`);
    const title = page.getByLabel("Название", { exact: true });
    await title.fill("Recovery local payload");
    const recoveryKey = await waitForRecoveryKey(page);
    await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key);
      if (!raw) throw new Error("missing_recovery");
      const value = JSON.parse(raw) as { savedAt: number };
      value.savedAt = 1;
      sessionStorage.setItem(key, JSON.stringify(value));
    }, recoveryKey);
    await reloadAcceptingDialog(page);
    await expect(page.getByText("Найдены несохранённые изменения в этой вкладке")).toBeVisible();
    expect(await page.evaluate((key) => sessionStorage.getItem(key) !== null, recoveryKey)).toBe(true);
    await page.getByRole("button", { name: "Восстановить изменения" }).click();
    await expect(title).toHaveValue("Recovery local payload");
    await expect(page.getByText("Есть несохранённые изменения", { exact: false })).toBeVisible();
    await title.fill("Recovery baseline");
    await expect.poll(() => page.evaluate((key) => sessionStorage.getItem(key), recoveryKey)).toBeNull();

    await title.fill("Discard this recovery");
    await waitForRecoveryKey(page);
    await reloadAcceptingDialog(page);
    await page.getByRole("button", { name: "Открыть сохранённую версию" }).click();
    expect(await page.evaluate((key) => sessionStorage.getItem(key), recoveryKey)).toBeNull();
    await expect(title).toHaveValue("Recovery baseline");

    await title.fill("Stale recovery must stay local only");
    await waitForRecoveryKey(page);
    const newerServerPage = await context.newPage();
    await newerServerPage.goto(`/trainer/builder/${recoveryDraft.id}`);
    await newerServerPage.getByLabel("Название", { exact: true }).fill("Newer server baseline");
    await newerServerPage.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(newerServerPage.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    await newerServerPage.close();
    await reloadAcceptingDialog(page);
    await expect(page.getByText("Найдены несохранённые изменения в этой вкладке")).toHaveCount(0);
    await expect(title).toHaveValue("Newer server baseline");

    const issueDraft = await createDraftFixture(page, "Exact issue source", 2);
    await page.goto(`/trainer/builder/${issueDraft.id}`);
    const issueRows = page.locator("#template-composition li[id^='exercise-']");
    await issueRows.nth(1).locator("button[aria-expanded]").click();
    await issueRows.nth(1).getByLabel("Настраивать каждый подход отдельно").click();
    await issueRows.nth(1).getByLabel("Отдых подхода 2").fill("");
    await issueRows.nth(1).locator("button[aria-expanded]").click();
    const exactIssue = page.locator('button[data-issue-path$=".restSec"]').filter({ hasText: "Проверьте" }).last();
    const issuePath = await exactIssue.getAttribute("data-issue-path");
    const setKey = issuePath?.split(".sets.")[1]?.split(".")[0];
    expect(setKey).toBeTruthy();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await exactIssue.click();
    await expect(issueRows.nth(1).locator("button[aria-expanded]")).toHaveAttribute("aria-expanded", "true");
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe(`exercise-set-field:fixture-instance-2:${setKey}:restSec`);
    const focusedBox = await page.locator(`#${cssEscape(`exercise-set-field:fixture-instance-2:${setKey}:restSec`)}`).boundingBox();
    expect(focusedBox?.y ?? 0).toBeGreaterThan(100);

    const orderDraft = await createDraftFixture(page, "Superset order source", 4);
    await page.goto(`/trainer/builder/${orderDraft.id}`);
    const orderRows = page.locator("#template-composition li[id^='exercise-']");
    await orderRows.nth(2).getByRole("button", { name: "Переместить участника выше" }).click();
    await expect(orderRows.nth(1)).toContainText("Упражнение 3");
    await orderRows.nth(1).getByRole("button", { name: "Переместить суперсет ниже" }).click();
    await expect(orderRows.nth(1)).toContainText("Упражнение 4");
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    await page.reload();
    await expect(orderRows.nth(0)).toContainText("Упражнение 1");
    await expect(orderRows.nth(1)).toContainText("Упражнение 4");
    await expect(orderRows.nth(2)).toContainText("Упражнение 3");
    await expect(orderRows.nth(3)).toContainText("Упражнение 2");
    const exactOrder = await readEditorModel(page, orderDraft.id, "editable");
    expect(exactOrder.content.exercises.map((exercise) => exercise.instanceKey)).toEqual(["fixture-instance-1", "fixture-instance-4", "fixture-instance-3", "fixture-instance-2"]);
    expect(exactOrder.content.exercises.filter((exercise) => exercise.superset).map((exercise) => exercise.superset?.supersetPosition)).toEqual([1, 2]);

    await assertSaveExit(page, "Главна", "/trainer/dashboard");
    await assertSaveExit(page, "Клиенты", "/trainer/clients");

    const workspaceDraft = await createDraftFixture(page, "Workspace return source");
    const workspaceReturn = "/trainer/templates?status=drafts&q=return&category=strength&page=2";
    await page.goto(`/trainer/builder/${workspaceDraft.id}?returnTo=${encodeURIComponent(workspaceReturn)}`);
    await page.getByLabel("Название", { exact: true }).fill("Workspace anchored return");
    await page.getByRole("button", { name: "Назад" }).click();
    await page.getByRole("button", { name: "Сохранить и выйти" }).click();
    await expect(page).toHaveURL(new RegExp(`/trainer/templates\\?.*anchor=${workspaceDraft.id}`));

    const backDraft = await createDraftFixture(page, "Browser Back source");
    await page.goto("/trainer/clients");
    await page.goto(`/trainer/builder/${backDraft.id}?returnTo=${encodeURIComponent("/trainer/clients")}`);
    await page.getByLabel("Название", { exact: true }).fill("Browser Back preserved return");
    await expect.poll(() => page.evaluate(() => Boolean(history.state?.workoutTemplateEditorGuard))).toBe(true);
    await page.evaluate(() => window.history.back());
    await page.getByRole("dialog", { name: "Есть несохранённые изменения" }).getByRole("button", { name: "Сохранить и выйти" }).click();
    await expect(page).toHaveURL("/trainer/clients");

    const failedExitDraft = await createDraftFixture(page, "Failed exit source");
    await page.goto(`/trainer/builder/${failedExitDraft.id}`);
    await page.getByLabel("Название", { exact: true }).fill("Failed exit remains open");
    const failedExitCommandIds: string[] = [];
    await page.route("**/api/trainer/workout-builder/templates", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      failedExitCommandIds.push((route.request().postDataJSON() as { commandId: string }).commandId);
      if (failedExitCommandIds.length === 1) {
        await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "known_failure" }) });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("link", { name: "Главна" }).click();
    const leaveDialog = page.getByRole("dialog", { name: "Есть несохранённые изменения" });
    await leaveDialog.getByRole("button", { name: "Сохранить и выйти" }).click();
    await expect(leaveDialog).toBeVisible();
    await expect(page.getByText("Не удалось сохранить", { exact: true }).first()).toBeVisible();
    await leaveDialog.getByRole("button", { name: "Остаться" }).click();
    await page.getByRole("button", { name: "Сохранить черновик" }).click();
    await expect(page).toHaveURL(`/trainer/builder/${failedExitDraft.id}`);
    await expect(page.getByRole("button", { name: "Опубликовать" })).toBeVisible();
    expect(failedExitCommandIds).toHaveLength(2);
    expect(new Set(failedExitCommandIds).size).toBe(1);
    await page.unroute("**/api/trainer/workout-builder/templates");
  } finally {
    await context.close();
  }
});

test("Published plus Draft unknown Publish reconciles persistence, replay, and concurrent conflicts", async ({ browser }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1024 } });
  const page = await context.newPage();
  try {
    await activateTrainer(page, `template.editor.publish.${Date.now()}@example.test`);

    const persisted = await createPublishedWithDraftFixture(page, "Published persisted");
    await page.goto(`/trainer/builder/${persisted.templateId}`);
    let persistedPosts = 0;
    await page.route(`**/api/trainer/workout-builder/templates/${persisted.templateId}/publish`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      persistedPosts += 1;
      await route.fetch();
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
    });
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await page.getByRole("button", { name: "Проверить публикацию" }).click();
    await expect(page.getByRole("heading", { name: "Шаблон опубликован" })).toHaveCount(1);
    expect(persistedPosts).toBe(1);
    await page.unroute(`**/api/trainer/workout-builder/templates/${persisted.templateId}/publish`);

    const replayed = await createPublishedWithDraftFixture(page, "Published replayed");
    await page.goto(`/trainer/builder/${replayed.templateId}`);
    const replayCommandIds: string[] = [];
    await page.route(`**/api/trainer/workout-builder/templates/${replayed.templateId}/publish`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      replayCommandIds.push((route.request().postDataJSON() as { commandId: string }).commandId);
      if (replayCommandIds.length === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await page.getByRole("button", { name: "Проверить публикацию" }).click();
    await expect(page.getByRole("heading", { name: "Шаблон опубликован" })).toBeVisible();
    expect(replayCommandIds).toHaveLength(2);
    expect(new Set(replayCommandIds).size).toBe(1);
    await page.unroute(`**/api/trainer/workout-builder/templates/${replayed.templateId}/publish`);

    const stale = await createPublishedWithDraftFixture(page, "Published stale");
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await Promise.all([pageA.goto(`/trainer/builder/${stale.templateId}`), pageB.goto(`/trainer/builder/${stale.templateId}`)]);
    await pageB.route(`**/api/trainer/workout-builder/templates/${stale.templateId}/publish`, async (route) => {
      if (route.request().method() === "POST") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      else await route.continue();
    });
    await pageB.getByRole("button", { name: "Опубликовать" }).click();
    await pageA.getByLabel("Название", { exact: true }).fill("Other tab changed v2");
    await pageA.getByRole("button", { name: "Сохранить черновик" }).click();
    await pageB.getByRole("button", { name: "Проверить публикацию" }).click();
    await expect(pageB.getByRole("heading", { name: "Есть более новая серверная версия" })).toBeVisible();
    await Promise.all([pageA.close(), pageB.close()]);

    const concurrent = await createPublishedWithDraftFixture(page, "Concurrent publication");
    await page.goto(`/trainer/builder/${concurrent.templateId}`);
    await page.route(`**/api/trainer/workout-builder/templates/${concurrent.templateId}/publish`, async (route) => {
      if (route.request().method() === "POST") await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "temporarily_unavailable" }) });
      else await route.continue();
    });
    await page.getByRole("button", { name: "Опубликовать" }).click();
    await publishRevision(page, concurrent.templateId, concurrent.draftRevisionId, concurrent.editToken);
    const publishedV2 = await readEditorModel(page, concurrent.templateId, "published");
    const createV3 = await page.request.post(`/api/trainer/workout-builder/templates/${concurrent.templateId}/revisions`, {
      headers: { Origin: baseURL },
      data: { commandId: crypto.randomUUID(), expectedTemplateToken: publishedV2.concurrency.lifecycleToken },
    });
    expect(createV3.status()).toBe(201);
    const editableV3 = await readEditorModel(page, concurrent.templateId, "editable");
    await publishRevision(page, concurrent.templateId, editableV3.identity!.selectedRevisionId, editableV3.concurrency.editToken!);
    await page.getByRole("button", { name: "Проверить публикацию" }).click();
    await expect(page.getByRole("heading", { name: "Есть более новая серверная версия" })).toBeVisible();
    await page.unroute(`**/api/trainer/workout-builder/templates/${concurrent.templateId}/publish`);
  } finally {
    await context.close();
  }
});

async function waitForRecoveryKey(page: Page) {
  await expect.poll(() => page.evaluate(() => Object.keys(sessionStorage).find((key) => key.startsWith("ai-strength:template-editor-recovery:")) ?? null)).not.toBeNull();
  return await page.evaluate(() => Object.keys(sessionStorage).find((key) => key.startsWith("ai-strength:template-editor-recovery:"))!);
}

async function reloadAcceptingDialog(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
}

async function assertSaveExit(page: Page, navigationLabel: "Главна" | "Клиенты", expectedPath: string) {
  const fixture = await createDraftFixture(page, `Save exit ${navigationLabel}`);
  await page.goto(`/trainer/builder/${fixture.id}`);
  await page.getByLabel("Название", { exact: true }).fill(`Saved to ${navigationLabel}`);
  await page.getByRole("link", { name: navigationLabel }).click();
  await page.getByRole("dialog", { name: "Есть несохранённые изменения" }).getByRole("button", { name: "Сохранить и выйти" }).click();
  await expect(page).toHaveURL(expectedPath);
}

async function createPublishedWithDraftFixture(page: Page, title: string) {
  const draft = await createDraftFixture(page, `${title} v1`);
  const publish = await page.request.post(`/api/trainer/workout-builder/templates/${draft.id}/publish`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), revisionId: draft.revisionId, expectedEditToken: draft.editToken },
  });
  expect(publish.status()).toBe(200);
  const published = await readEditorModel(page, draft.id, "published");
  const revision = await page.request.post(`/api/trainer/workout-builder/templates/${draft.id}/revisions`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), expectedTemplateToken: published.concurrency.lifecycleToken },
  });
  expect(revision.status()).toBe(201);
  const editable = await readEditorModel(page, draft.id, "editable");
  return {
    templateId: draft.id,
    publishedRevisionId: draft.revisionId,
    draftRevisionId: editable.identity!.selectedRevisionId,
    editToken: editable.concurrency.editToken!,
  };
}

async function publishRevision(page: Page, templateId: string, revisionId: string, editToken: string) {
  const response = await page.request.post(`/api/trainer/workout-builder/templates/${templateId}/publish`, {
    headers: { Origin: baseURL },
    data: { commandId: crypto.randomUUID(), revisionId, expectedEditToken: editToken },
  });
  expect(response.status()).toBe(200);
}

async function publicationSideEffects(templateId: string, commandId: string) {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) throw new Error("database_migration_url_required");
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const [audits, receipts] = await Promise.all([
      pool.query<{ count: string }>(`SELECT count(*)::text AS count
        FROM app.audit_events
        WHERE event_type = 'workout.template.published'
          AND metadata->>'template_id' = $1`, [templateId]),
      pool.query<{ count: string }>(`SELECT count(*)::text AS count
        FROM app.workout_template_command_receipts
        WHERE command_id = $1`, [commandId]),
    ]);
    return {
      audits: Number(audits.rows[0]?.count ?? 0),
      receipts: Number(receipts.rows[0]?.count ?? 0),
    };
  } finally {
    await pool.end();
  }
}

async function readEditorModel(page: Page, templateId: string, view: "editable" | "published") {
  const response = await page.request.get(`/api/trainer/workout-builder/templates/${templateId}/editor?view=${view}`);
  expect(response.status()).toBe(200);
  return (await response.json() as {
    editor: {
      identity: { selectedRevisionId: string } | null;
      concurrency: { editToken: string | null; lifecycleToken: string | null };
      content: { exercises: Array<{ instanceKey: string; superset: { supersetPosition: number } | null }> };
    };
  }).editor;
}

function cssEscape(value: string) {
  return value.replaceAll(":", "\\:");
}

async function workspaceCount(page: Page) {
  const response = await page.request.get("/api/trainer/workout-builder/workspace?first=1&status=all");
  expect(response.status()).toBe(200);
  return (await response.json() as { templateWorkspace: { resultCount: { value: number | null } } }).templateWorkspace.resultCount.value;
}

async function activateTrainer(page: Page, email = trainerEmail) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Получить код" }).click();
  const code = (await page.locator("p.font-mono").textContent())?.trim() ?? "";
  await page.getByLabel("Код из письма").fill(code);
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("link", { name: "Продолжить" }).click();
  await page.getByLabel("Как вас зовут").fill("Тренер Editor E2E");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByRole("button", { name: "Запросить доступ" }).click();
  await runOperator(["activate-trainer", "--email", email]);
  await page.getByRole("button", { name: "Проверить доступ" }).click();
  await expect(page.getByRole("link", { name: "Открыть кабинет" })).toBeVisible();
}

function collectBrowserProblems(page: Page, problems: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error" || (message.type() === "warning" && /radix/i.test(message.text()))) problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
}

function delayedMutation(page: Page, pattern: string) {
  let release!: () => void;
  let markIntercepted!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const intercepted = new Promise<void>((resolve) => { markIntercepted = resolve; });
  void page.route(pattern, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    markIntercepted();
    await gate;
    await route.continue();
  });
  return { intercepted, release };
}

async function createDraftFixture(page: Page, title: string, exerciseCount = 1) {
  const templateId = crypto.randomUUID();
  const revisionId = crypto.randomUUID();
  const exercises = Array.from({ length: exerciseCount }, (_, index) => fixtureExercise(index + 1, exerciseCount > 1));
  const groupedStarts = new Set([2, 6, 10, 16, 22, 28]);
  const items: Array<Record<string, unknown>> = [];
  for (let index = 0; index < exercises.length; index += 1) {
    const number = index + 1;
    if (groupedStarts.has(number) && exercises[index + 1]) {
      items.push({ id: `stress-superset-${number}`, kind: "superset", label: `Суперсет ${number}`, instruction: "Без паузы между упражнениями.", exercises: [exercises[index], exercises[index + 1]] });
      index += 1;
    } else {
      items.push({ id: `fixture-row-${number}`, kind: "exercise", exercise: exercises[index] });
    }
  }
  const response = await page.request.post("/api/trainer/workout-builder/templates", {
    headers: { Origin: baseURL },
    data: {
      commandId: crypto.randomUUID(),
      templateId,
      revisionId,
      expectedEditToken: null,
      content: {
        title,
        revision: 1,
        description: "Deterministic command-state fixture",
        category: "Сила",
        estimatedDurationMin: "60",
        generalInstruction: "Работать подконтрольно и сохранять технику.",
        items,
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json() as { template: { id: string; revisionId: string; editToken: string; templateToken: string } }).template;
}

function fixtureExercise(number: number, stress: boolean) {
  const perSetMode = stress && number % 4 === 0;
  const incomplete = stress && number === 35;
  return {
    instanceId: `fixture-instance-${number}`,
    exerciseId: `fixture-unmapped-${number}`,
    title: stress ? `Упражнение ${number}: длинное название для проверки устойчивой строки редактора` : "Жим лёжа",
    category: "Сила",
    equipment: "Тренажёр",
    prescription: { type: "repetitions", sets: incomplete ? "" : "3", repetitionMode: "fixed", repetitionsMin: incomplete ? "" : "8", repetitionsMax: incomplete ? "" : "8", durationSec: "", targetWeightKg: incomplete ? "" : String(20 + number), restSec: incomplete ? "" : "90" },
    perSetMode,
    setOverrides: perSetMode ? Array.from({ length: 3 }, (_, index) => ({ id: `fixture-set-${number}-${index + 1}`, order: index + 1, kind: index === 0 ? "warmup" : "working", repetitionsMin: "8", repetitionsMax: "8", durationSec: "", targetWeightKg: String(20 + number + index), restSec: "90", usesOverride: true })) : [],
    trainerNote: stress ? `Подробная заметка ${number}. ${"Сохранять контроль движения. ".repeat(6)}` : "",
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

async function runOperator(args: string[]) {
  const currentOptions = process.env.NODE_OPTIONS?.trim();
  await execFile(process.execPath, ["--import", "tsx", "scripts/ops/local-pilot.ts", ...args], {
    cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: [currentOptions, "--conditions=react-server"].filter(Boolean).join(" ") }, maxBuffer: 1024 * 1024,
  });
}
