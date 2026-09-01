import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import type { ReviewReadModel } from "../../lib/server/reviews/review-types";
import {
  longExerciseTitle,
  longReviewTitle,
  longSetComment,
  provisionLongReviewFixture,
  secondLongExerciseTitle,
} from "./fixtures/long-review-fixture";

test.describe("R2B.2 long canonical Workout Review", () => {
  test("keeps long canonical evidence, legacy identity and feedback usable on desktop and mobile", async ({ browser }) => {
    const contexts: BrowserContext[] = [];
    const trainerContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3101",
      viewport: { width: 1440, height: 1024 },
    });
    const athleteContext = await browser.newContext({ baseURL: "http://127.0.0.1:3101" });
    contexts.push(trainerContext, athleteContext);
    const trainer = await trainerContext.newPage();
    const athlete = await athleteContext.newPage();
    const runtimeErrors = observeRuntimeErrors(trainer);

    try {
      const fixture = await test.step("provision canonical PostgreSQL long-review fixtures", async () => (
        provisionLongReviewFixture(trainer, athlete)
      ));

      await test.step("fixture contains canonical volume, exceptions, comments and resolved timeline", async () => {
        const open = await readReview(trainer, fixture.open.sessionId);
        const resolved = await readReview(trainer, fixture.resolved.sessionId);
        const allSets = open.exercises.flatMap((exercise) => exercise.sets);
        const comments = allSets.flatMap((set) => set.sourceComments);
        const exceptions = open.exercises.flatMap((exercise) => exercise.deviations);
        const legacyActual = allSets.find((set) => (
          set.identity.sourceAssignmentSetId === null
          && set.identity.setLogId !== null
          && set.actual.status !== "missing"
        ));

        expect(open.exercises).toHaveLength(12);
        expect(allSets.filter((set) => set.identity.sourceAssignmentSetId !== null)).toHaveLength(fixture.prescribedSetCount);
        expect(exceptions.length).toBeGreaterThanOrEqual(6);
        expect(exceptions.length).toBeLessThanOrEqual(12);
        expect(allSets.some((set) => set.actual.status === "skipped")).toBe(true);
        expect(allSets.some((set) => set.actual.status === "incomplete")).toBe(true);
        expect(allSets.some((set) => set.actual.status === "missing")).toBe(true);
        expect(comments).toHaveLength(3);
        expect(comments.some((comment) => comment.text === longSetComment)).toBe(true);
        expect(longSetComment.length).toBeGreaterThanOrEqual(800);
        expect(legacyActual).toBeDefined();
        expect(open.attention.status).toBe("open");
        expect(open.sessionContext.discomfort.status).toBe("unsupported");
        expect(open.sessionContext.overallComment.status).toBe("unsupported");
        expect(open.sessionContext.subjectiveMetrics.status).toBe("unsupported");
        expect(resolved.attention.status).toBe("resolved");
        expect(resolved.existingFeedback).toHaveLength(3);
      });

      await test.step("mobile 390x844 keeps one column, exact jumps and long copy usable", async () => {
        await trainer.setViewportSize({ width: 390, height: 844 });
        await trainer.goto(`/trainer/review/${fixture.open.sessionId}`);
        await expect(trainer.getByRole("heading", { level: 1, name: longReviewTitle })).toBeVisible();
        await expectNoHorizontalOverflow(trainer);

        const evidence = trainer.locator("[data-review-evidence-column]");
        const action = trainer.locator("[data-review-action-column]");
        const [evidenceBox, actionBox] = await Promise.all([evidence.boundingBox(), action.boundingBox()]);
        expect(evidenceBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        expect(actionBox!.y).toBeGreaterThan(evidenceBox!.y + evidenceBox!.height - 1);

        const longTitleDisclosure = trainer.getByRole("button").filter({ hasText: longExerciseTitle }).first();
        const secondLongTitleDisclosure = trainer.getByRole("button").filter({ hasText: secondLongExerciseTitle }).first();
        await expect(longTitleDisclosure).toBeVisible();
        await expect(secondLongTitleDisclosure).toBeVisible();
        await expectElementInsideViewportWidth(longTitleDisclosure, 390);
        await expectElementInsideViewportWidth(secondLongTitleDisclosure, 390);

        const longCommentException = trainer.getByRole("listitem").filter({ hasText: longSetComment.slice(0, 80) }).first();
        await longCommentException.getByRole("button", { name: /К результату/ }).click();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe(fixture.open.longCommentAnchorId);
        const longCommentTarget = trainer.locator(`#${fixture.open.longCommentAnchorId}`);
        await expect.poll(() => longCommentTarget.evaluate((node) => node.getBoundingClientRect().top)).toBeLessThan(844);
        const targetViewportBox = await longCommentTarget.evaluate((node) => {
          const box = node.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom };
        });
        expect(targetViewportBox.top).toBeGreaterThanOrEqual(0);
        expect(targetViewportBox.bottom).toBeGreaterThan(0);

        const planned = longCommentTarget.getByText("По плану", { exact: true }).locator("..");
        const actual = longCommentTarget.getByText("Выполнено", { exact: true }).locator("..");
        const [plannedBox, actualBox] = await Promise.all([planned.boundingBox(), actual.boundingBox()]);
        expect(plannedBox).not.toBeNull();
        expect(actualBox).not.toBeNull();
        expect(actualBox!.y).toBeGreaterThan(plannedBox!.y + plannedBox!.height - 1);

        const sourceComment = longCommentTarget.locator("[data-review-source-comment]");
        const longCopy = sourceComment.locator("p").filter({ hasText: longSetComment.slice(0, 80) });
        const expand = sourceComment.getByRole("button", { name: "Показать полностью" });
        await expect(expand).toHaveAttribute("aria-expanded", "false");
        expect(await longCopy.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("pre-wrap");
        expect(await longCopy.textContent()).toBe(longSetComment);
        await expand.click();
        const collapse = sourceComment.getByRole("button", { name: "Свернуть" });
        await expect(collapse).toHaveAttribute("aria-expanded", "true");
        await expect(collapse).toBeFocused();
        await expectNoHorizontalOverflow(trainer);

        const feedback = trainer.getByRole("region", { name: "Обратная связь" });
        const textarea = feedback.getByLabel("Сообщение спортсмену");
        const submit = feedback.getByRole("button", { name: "Отправить ответ", exact: true });
        await textarea.scrollIntoViewIfNeeded();
        await expect(textarea).toBeVisible();
        await expect(submit).toBeVisible();
        const tapHeights = await feedback.locator("button").evaluateAll((buttons) => (
          buttons.map((button) => Math.round(button.getBoundingClientRect().height))
        ));
        expect(Math.min(...tapHeights)).toBeGreaterThanOrEqual(44);
        await trainer.screenshot({ path: "test-results/canonical/r2b2-long-review-mobile.png", fullPage: true });
      });

      await test.step("desktop 1440x1024 preserves hierarchy, sticky boundary and source identity", async () => {
        await trainer.setViewportSize({ width: 1440, height: 1024 });
        await trainer.goto(`/trainer/review/${fixture.open.sessionId}`);
        await expect(trainer.getByRole("heading", { level: 1, name: longReviewTitle })).toBeVisible();
        await expectNoHorizontalOverflow(trainer);

        const firstViewport = [
          trainer.getByRole("region", { name: "Контекст разбора" }),
          trainer.getByRole("heading", { name: "Доступность данных" }),
          trainer.getByRole("heading", { name: "Итог выполнения" }),
          trainer.getByRole("heading", { name: "Сначала исключения" }),
          trainer.getByRole("region", { name: "Обратная связь" }),
        ];
        for (const element of firstViewport) {
          const box = await element.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.y).toBeLessThan(1024);
        }
        await expect(trainer.getByText("Подходов по плану").locator("..")).toContainText(String(fixture.prescribedSetCount));

        const evidence = trainer.locator("[data-review-evidence-column]");
        const action = trainer.locator("[data-review-action-column]");
        const [evidenceBox, actionBox] = await Promise.all([evidence.boundingBox(), action.boundingBox()]);
        expect(evidenceBox).not.toBeNull();
        expect(actionBox).not.toBeNull();
        expect(evidenceBox!.width).toBeGreaterThan(700);
        expect(actionBox!.width).toBeGreaterThanOrEqual(360);
        expect(evidenceBox!.x + evidenceBox!.width).toBeLessThanOrEqual(actionBox!.x);
        expect(await action.evaluate((node) => getComputedStyle(node).position)).toBe("sticky");

        const normalExercise = trainer.getByRole("button").filter({ hasText: "Контрольное упражнение 5" }).first();
        const exceptionExercise = trainer.getByRole("button").filter({ hasText: longExerciseTitle }).first();
        await expect(normalExercise).toHaveAttribute("aria-expanded", "false");
        await expect(exceptionExercise).toHaveAttribute("aria-expanded", "true");

        const skipLink = trainer.locator('a[href="#review-exceptions"]');
        await skipLink.focus();
        await trainer.keyboard.press("Enter");
        await expect(trainer).toHaveURL(/#review-exceptions$/);
        const exceptionHeadingBox = await trainer.getByRole("heading", { name: "Сначала исключения" }).boundingBox();
        expect(exceptionHeadingBox).not.toBeNull();
        expect(exceptionHeadingBox!.y).toBeGreaterThanOrEqual(0);
        expect(exceptionHeadingBox!.y).toBeLessThan(1024);

        const legacyException = trainer.getByRole("listitem").filter({ hasText: "Источник подхода недоступен" }).first();
        await legacyException.getByRole("button", { name: /К результату/ }).click();
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe(fixture.open.legacyAnchorId);
        expect(await trainer.evaluate(() => document.activeElement?.id)).not.toBe(fixture.open.legacyNeighborAnchorId);
        const legacyTarget = trainer.locator(`#${fixture.open.legacyAnchorId}`);
        await expect(legacyTarget).toContainText("Источник назначенного подхода не подтверждён");
        if (fixture.open.legacyPlannedWeight !== null) {
          await expect(legacyTarget).toContainText(`${fixture.open.legacyPlannedWeight} кг`);
        }
        if (fixture.open.legacyNeighborPlannedWeight !== null
          && fixture.open.legacyNeighborPlannedWeight !== fixture.open.legacyPlannedWeight) {
          await expect(legacyTarget).not.toContainText(`${fixture.open.legacyNeighborPlannedWeight} кг`);
        }

        await trainer.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const sessionContext = trainer.getByRole("heading", { name: "Контекст сессии" }).locator("..");
        const [sessionContextBox, stickyBox] = await Promise.all([sessionContext.boundingBox(), action.boundingBox()]);
        expect(sessionContextBox).not.toBeNull();
        expect(stickyBox).not.toBeNull();
        expect(sessionContextBox!.x + sessionContextBox!.width).toBeLessThanOrEqual(stickyBox!.x);

        const feedback = trainer.getByRole("region", { name: "Обратная связь" });
        await feedback.getByLabel("Сообщение спортсмену").fill("Длинный canonical Review проверен. Факты сохранены.");
        await feedback.getByRole("button", { name: "Отправить ответ", exact: true }).click();
        const receipt = feedback.getByRole("status");
        await expect(receipt.getByText("Обратная связь сохранена", { exact: true })).toBeVisible();
        await expect(feedback.getByLabel("Сообщение спортсмену")).toHaveCount(0);
        await expect.poll(() => trainer.evaluate(() => document.activeElement?.id)).toBe("review-completion-receipt-heading");
        await trainer.screenshot({ path: "test-results/canonical/r2b2-long-review-desktop.png", fullPage: true });
      });

      await test.step("resolved long review renders immutable timeline without another command layer", async () => {
        await trainer.goto(`/trainer/review/${fixture.resolved.sessionId}`);
        const timeline = trainer.getByRole("heading", { name: "Сохранённая переписка" }).locator("..");
        await expect(timeline.locator("article")).toHaveCount(3);
        await expect(trainer.getByRole("button", { name: "Добавить уточнение" })).toBeVisible();
        await expect(trainer.getByLabel("Сообщение спортсмену")).toHaveCount(0);
        await expectNoHorizontalOverflow(trainer);
      });

      expect(runtimeErrors).toEqual([]);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
    }
  });
});

async function readReview(page: Page, sessionId: string) {
  const response = await page.request.get(`/api/trainer/reviews/${sessionId}`);
  expect(response.status()).toBe(200);
  const body = await response.json() as { review: ReviewReadModel };
  return body.review;
}

function observeRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console:${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`page:${error.message}`));
  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1:3101") && response.status() >= 500) {
      errors.push(`http:${response.status()}:${new URL(response.url()).pathname}`);
    }
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

async function expectElementInsideViewportWidth(locator: ReturnType<Page["locator"]>, viewportWidth: number) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
}
