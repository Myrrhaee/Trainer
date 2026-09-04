import { randomUUID } from "node:crypto";
import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { Pool } from "pg";
import type { WorkoutSession } from "../../lib/server/workout-sessions/workout-session-types";
const baseURL = "http://127.0.0.1:3101";
const headers = { Origin: baseURL };
async function body<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function authenticate(page: Page, email: string) {
  const c = await body<{ challengeId: string; developmentCode: string }>(
    await page.request.post("/api/auth/email/request", {
      headers,
      data: { email, intent: "login" },
    }),
  );
  await body(
    await page.request.post("/api/auth/email/verify", {
      headers,
      data: { email, challengeId: c.challengeId, code: c.developmentCode },
    }),
  );
  return (
    await body<{ userId: string }>(
      await page.request.get("/api/access/context"),
    )
  ).userId;
}

test("R3E canonical append/replay, exact feedback identity, partial errors and mobile", async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const tc = await browser.newContext({ baseURL });
  const ac = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const trainer = await tc.newPage();
  const athlete = await ac.newPage();
  const admin = new Pool({
    connectionString: process.env.DATABASE_MIGRATION_URL,
  });
  const errors: string[] = [];
  athlete.on("pageerror", (error) => errors.push(error.message));
  athlete.on("console", (message) => {
    if (/hydration|DialogDescription/i.test(message.text()))
      errors.push(message.text());
  });
  const requests: string[] = [];
  athlete.on("request", (request) => {
    if (request.url().includes("/api/client/")) requests.push(request.url());
  });
  try {
    const trainerId = await authenticate(trainer, "r3e.trainer@example.test");
    const athleteId = await authenticate(athlete, "r3e.athlete@example.test");
    await admin.query(
      "INSERT INTO app.trainer_profiles(user_id,status,activated_at) VALUES ($1,'active',clock_timestamp())",
      [trainerId],
    );
    await admin.query(
      "INSERT INTO app.athlete_profiles(user_id,status) VALUES ($1,'active')",
      [athleteId],
    );
    const relationId = (
      await admin.query<{ id: string }>(
        "INSERT INTO app.trainer_athlete_relations(trainer_user_id,athlete_user_id,status,is_primary) VALUES ($1,$2,'active',true) RETURNING id",
        [trainerId, athleteId],
      )
    ).rows[0].id;
    await athlete.goto("/client/workouts");
    await expect(
      athlete.getByText("Завершённых тренировок пока нет.", { exact: true }),
    ).toBeVisible();
    expect(
      requests.filter(
        (url) =>
          new URL(url).pathname === "/api/client/workouts" &&
          !new URL(url).searchParams.has("mode"),
      ),
    ).toHaveLength(1);
    expect(
      requests.filter(
        (url) => new URL(url).searchParams.get("mode") === "history",
      ),
    ).toHaveLength(1);
    expect(
      (await trainer.request.get("/api/client/workouts?mode=history")).status(),
    ).toBe(401);
    expect(
      (await trainer.request.get("/api/client/feedback?mode=latest")).status(),
    ).toBe(401);
    const templateId = randomUUID(),
      revisionId = randomUUID();
    const saved = await body<{ template: { editToken: string } }>(
      await trainer.request.post("/api/trainer/workout-builder/templates", {
        headers,
        data: {
          commandId: randomUUID(),
          templateId,
          revisionId,
          expectedEditToken: null,
          content: {
            id: templateId,
            revisionId,
            title: "R3E каноническая тренировка",
            description: "",
            category: "Сила",
            estimatedDurationMin: "20",
            generalInstruction: "Сохранённая инструкция",
            items: [
              {
                id: "item",
                kind: "exercise",
                exercise: {
                  instanceId: "instance",
                  exerciseId: "history-squat",
                  title: "Приседание",
                  category: "Сила",
                  equipment: "Штанга",
                  prescription: {
                    type: "repetitions",
                    sets: "2",
                    repetitionMode: "fixed",
                    repetitionsMin: "6",
                    repetitionsMax: "6",
                    durationSec: "",
                    targetWeightKg: "50",
                    restSec: "90",
                  },
                  perSetMode: false,
                  setOverrides: [],
                  trainerNote: "Контроль движения",
                },
              },
            ],
          },
        },
      }),
    );
    await body(
      await trainer.request.post(
        `/api/trainer/workout-builder/templates/${templateId}/publish`,
        {
          headers,
          data: {
            commandId: randomUUID(),
            revisionId,
            expectedEditToken: saved.template.editToken,
          },
        },
      ),
    );
    const sessions: WorkoutSession[] = [];
    for (let i = 0; i < 35; i++) {
      const read = await body<{
        quickAssign: { athlete: { assignmentStateToken: string } };
      }>(
        await trainer.request.get(
          `/api/trainer/athletes/${athleteId}/quick-assign`,
        ),
      );
      const a = await body<{ assignment: { id: string } }>(
        await trainer.request.post("/api/workout-assignments", {
          headers,
          data: {
            assignmentId: randomUUID(),
            athleteUserId: athleteId,
            templateId,
            templateRevisionId: revisionId,
            scheduledFor: "2026-09-04",
            trainerNote: "",
            assignmentStateToken: read.quickAssign.athlete.assignmentStateToken,
            allowAdditionalAssignment: false,
            transitionContext: JSON.stringify({
              version: 1,
              origin: "direct",
              athleteUserId: athleteId,
              tab: "training",
            }),
          },
        }),
      );
      const started = await body<{ session: WorkoutSession }>(
        await athlete.request.post("/api/workout-sessions", {
          headers,
          data: {
            assignmentId: a.assignment.id,
            clientTimezone: "Europe/Moscow",
            idempotencyKey: randomUUID(),
          },
        }),
      );
      sessions.push(started.session);
      if (i < 34)
        await body(
          await athlete.request.post(
            `/api/workout-sessions/${started.session.id}/complete`,
            {
              headers,
              data: {
                expectedVersion: 1,
                idempotencyKey: randomUUID(),
                zeroResultConfirmed: true,
                zeroResultReason: "Сохранённая причина",
                overallComment: "Мой исходный комментарий",
                discomfortReported: i === 33,
                discomfortComment:
                  i === 33 ? "Исходный дискомфорт без интерпретации" : null,
              },
            },
          ),
        );
    }
    await athlete.goto("/client/workouts");
    const history = athlete.getByRole("region", { name: "История тренировок" });
    const rows = history.getByRole("listitem");
    await expect(rows).toHaveCount(10);
    await expect(
      athlete.getByRole("heading", { name: "Текущие и ближайшие" }),
    ).toBeVisible();
    let fail = true;
    await athlete.route("**/api/client/workouts?**", async (route) => {
      if (new URL(route.request().url()).searchParams.has("after") && fail) {
        fail = false;
        await route.fulfill({ status: 503, json: { error: "injected" } });
      } else await route.continue();
    });
    await history.getByRole("button", { name: "Показать ещё" }).click();
    await expect(rows).toHaveCount(10);
    await history.getByRole("button", { name: "Повторить" }).click();
    await expect(rows).toHaveCount(20);
    await athlete.unroute("**/api/client/workouts?**");
    await history.getByRole("button", { name: "Показать ещё" }).click();
    await expect(rows).toHaveCount(30);
    await history.getByRole("button", { name: "Показать ещё" }).click();
    await expect(rows).toHaveCount(34);
    await expect(history.getByText("Все тренировки показаны")).toBeVisible();
    const link = rows.nth(24).getByRole("link");
    const anchor = await link.getAttribute("id");
    await link.click();
    await expect(
      athlete.getByRole("heading", {
        name: "Тренировка завершена",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      athlete.getByText("Тренер ещё не оставил обратную связь.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      athlete.getByText("Комментарий не оставлен.", { exact: true }),
    ).toHaveCount(0);
    await athlete
      .getByRole("link", { name: "К тренировкам", exact: true })
      .first()
      .click();
    await expect(rows).toHaveCount(34);
    await expect(athlete.locator(`#${anchor}`)).toBeFocused();
    const before = requests.filter((url) =>
      url.includes("mode=history"),
    ).length;
    await athlete.reload();
    await expect(rows).toHaveCount(34);
    await expect(athlete.locator(`#${anchor}`)).toBeFocused();
    expect(
      requests.filter((url) => url.includes("mode=history")).length - before,
    ).toBe(4);
    let replayReads = 0;
    await athlete.route("**/api/client/workouts?**", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("mode") === "history" &&
        ++replayReads === 3
      )
        await route.fulfill({ status: 503, json: { error: "injected" } });
      else await route.continue();
    });
    await athlete.reload();
    await expect(rows).toHaveCount(20);
    await expect(history.getByRole("alert")).toBeVisible();
    expect(new URL(athlete.url()).searchParams.get("historyDepth")).toBe("4");
    await history.getByRole("button", { name: "Повторить" }).click();
    await expect(rows).toHaveCount(34);
    await expect(athlete.locator(`#${anchor}`)).toBeFocused();
    expect(replayReads).toBe(5);
    await athlete.unroute("**/api/client/workouts?**");
    await rows.nth(24).getByRole("link").click();
    await expect(
      athlete.getByRole("heading", {
        name: "Тренировка завершена",
        exact: true,
      }),
    ).toBeVisible();
    await athlete.goBack();
    await expect(rows).toHaveCount(34);
    await expect(athlete.locator(`#${anchor}`)).toBeFocused();
    await athlete.goForward();
    await expect(
      athlete.getByRole("heading", {
        name: "Тренировка завершена",
        exact: true,
      }),
    ).toBeVisible();
    await athlete.goBack();
    await expect(rows).toHaveCount(34);
    await athlete.screenshot({
      path: info.outputPath("r3e-history-390x844.png"),
    });
    const sessionId = sessions[33].id;
    const originalBody =
      "Сохранённый ответ тренера\n" +
      "Текст с сохранёнными переносами и фактами. ".repeat(90) +
      "\n" +
      "Длинноеслово".repeat(25);
    const review = await body<{ review: { attention: { id: string } } }>(
      await trainer.request.get(`/api/trainer/reviews/${sessionId}`),
    );
    const answer = await body<{ feedback: { id: string } }>(
      await trainer.request.post(`/api/trainer/reviews/${sessionId}/feedback`, {
        headers,
        data: {
          attentionItemId: review.review.attention.id,
          kind: "detailed",
          body: originalBody,
          idempotencyKey: randomUUID(),
        },
      }),
    );
    const follow = await body<{ feedback: { id: string } }>(
      await trainer.request.post(`/api/trainer/reviews/${sessionId}/feedback`, {
        headers,
        data: {
          attentionItemId: review.review.attention.id,
          kind: "follow_up",
          body: "Сохранённое уточнение",
          followUpOfId: answer.feedback.id,
          idempotencyKey: randomUUID(),
        },
      }),
    );
    await athlete.goto("/client/me");
    await athlete.getByRole("link", { name: "Посмотреть ответ" }).click();
    await expect(
      athlete.locator(`[data-feedback-id="${follow.feedback.id}"]`),
    ).toBeVisible();
    await athlete.getByRole("button", { name: "К исходному ответу" }).click();
    await expect(
      athlete.locator(`[data-feedback-id="${answer.feedback.id}"]`),
    ).toBeVisible();
    await expect(
      athlete.getByText("Исходный дискомфорт без интерпретации", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      athlete.getByText("Мой исходный комментарий", { exact: true }),
    ).toBeVisible();
    await athlete.locator("summary").first().click();
    await expect(
      athlete.getByText(/^План.*6 повт\. · 50 кг/).first(),
    ).toBeVisible();
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 390, height: 500 },
      { width: 720, height: 512 },
      { width: 1440, height: 1024 },
    ]) {
      await athlete.setViewportSize(viewport);
      expect(
        await athlete.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await athlete.screenshot({
        path: info.outputPath(
          `r3e-detail-${viewport.width}x${viewport.height}.png`,
        ),
      });
    }
    await athlete.keyboard.press("Tab");
    expect(
      await athlete.evaluate(() => document.activeElement !== document.body),
    ).toBe(true);
    await admin.query(
      "UPDATE app.trainer_athlete_relations SET status='ended',ended_at=clock_timestamp() WHERE id=$1",
      [relationId],
    );
    await athlete.reload();
    await expect(
      athlete.locator(`[data-feedback-id="${follow.feedback.id}"]`),
    ).toBeVisible();
    await athlete.getByRole("button", { name: "К исходному ответу" }).click();
    await expect(
      athlete.getByText(originalBody, { exact: true }),
    ).toBeVisible();
    await athlete.route("**/api/client/feedback?**", (route) =>
      route.fulfill({ status: 503, json: { error: "injected" } }),
    );
    await athlete.reload();
    await expect(
      athlete.getByText("Не удалось загрузить ответ тренера", { exact: true }),
    ).toBeVisible();
    await expect(
      athlete.getByText("Мой исходный комментарий", { exact: true }),
    ).toBeVisible();
    await athlete.unroute("**/api/client/feedback?**");
    await athlete
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await expect(
      athlete.locator(`[data-feedback-id="${follow.feedback.id}"]`),
    ).toBeVisible();
    const acknowledgementSession = sessions[32].id;
    const acknowledgementReview = await body<{
      review: { attention: { id: string } };
    }>(
      await trainer.request.get(
        `/api/trainer/reviews/${acknowledgementSession}`,
      ),
    );
    const acknowledgement = await body<{ feedback: { id: string } }>(
      await trainer.request.post(
        `/api/trainer/reviews/${acknowledgementSession}/feedback`,
        {
          headers,
          data: {
            attentionItemId: acknowledgementReview.review.attention.id,
            kind: "acknowledgement",
            body: "Принято",
            idempotencyKey: randomUUID(),
          },
        },
      ),
    );
    await athlete.goto(`/client/workouts?session=${acknowledgementSession}`);
    await expect(
      athlete.locator(`[data-feedback-id="${acknowledgement.feedback.id}"]`),
    ).toContainText("Короткий ответ");
    await expect(
      athlete.getByText("Дискомфорт не отмечен.", { exact: true }),
    ).toBeVisible();
    // Read-boundary fixture for pre-R3D context; no schema/constraint changes or writes to persisted facts.
    await athlete.route("**/api/client/workouts?**", async (route) => {
      const response = await route.fetch();
      const payload = await response.json();
      if (payload.completed)
        payload.completed.context = {
          ...payload.completed.context,
          overallComment: null,
          discomfortReported: null,
          discomfortComment: null,
        };
      await route.fulfill({ response, json: payload });
    });
    await athlete.reload();
    await expect(
      athlete.getByText(
        "Данные о дискомфорте для этой тренировки не собирались.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      athlete.getByText("Общий комментарий для этой тренировки не собирался.", {
        exact: true,
      }),
    ).toBeVisible();
    await athlete.unroute("**/api/client/workouts?**");
    await athlete.goto(`/client/workouts?session=${randomUUID()}`);
    await expect(
      athlete.getByRole("heading", { name: "Тренировка недоступна" }),
    ).toBeVisible();
    await athlete.goto(
      "/client/workouts?historyStart=invalid&historyDepth=4#history",
    );
    await expect(rows).toHaveCount(10);
    await expect(
      history.getByText("История обновлена: сохранённая позиция недоступна."),
    ).toBeVisible();
    await expect(
      athlete.getByRole("heading", { name: "Текущие и ближайшие" }),
    ).toBeVisible();
    const missingAnchor = new URL(athlete.url());
    missingAnchor.hash = `workout-${randomUUID()}`;
    await athlete.goto(missingAnchor.href);
    await athlete.reload();
    await expect(rows).toHaveCount(10);
    await expect(athlete.locator("#history")).toBeFocused();
    await expect(
      history.getByText(
        "Выбранная тренировка больше не доступна в этой части истории.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(errors).toEqual([]);
    console.log(
      "R3E browser replay at depth 4: 4 canonical history GETs; generated screenshots",
      info.outputDir,
    );
  } finally {
    await admin.end();
    await tc.close();
    await ac.close();
  }
});
