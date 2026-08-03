import { Pool } from "pg";

import { LocalPilotOperator } from "../../lib/server/ops/local-pilot";
import { resolveDeploymentStage } from "../../lib/server/runtime/deployment-config";

const origin = process.env.AUTH_PUBLIC_ORIGIN?.trim() || "http://127.0.0.1:3011";
const trainerEmail = "trainer.local@example.test";
const athleteEmails = ["athlete-one.local@example.test", "athlete-two.local@example.test"];

type AuthenticatedAccount = { email: string; cookie: string };

async function request(path: string, input: {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  cookie?: string;
} = {}) {
  const response = await fetch(new URL(path, origin), {
    method: input.method ?? "POST",
    headers: {
      Origin: origin,
      ...(input.body ? { "Content-Type": "application/json" } : {}),
      ...(input.cookie ? { Cookie: input.cookie } : {}),
    },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(`http_${response.status}_${path.replaceAll("/", "_")}`);
  return { response, body };
}

function post(path: string, input: { body?: Record<string, unknown>; cookie?: string } = {}) {
  return request(path, input);
}

function get(path: string, cookie: string) {
  return request(path, { method: "GET", cookie });
}

async function authenticate(email: string): Promise<AuthenticatedAccount> {
  const requested = await post("/api/auth/email/request", {
    body: { email, intent: "login" },
  });
  const challengeId = requested.body.challengeId;
  const developmentCode = requested.body.developmentCode;
  if (typeof challengeId !== "string" || typeof developmentCode !== "string") {
    throw new Error("local_otp_disclosure_unavailable");
  }
  const verified = await post("/api/auth/email/verify", {
    body: { email, challengeId, code: developmentCode },
  });
  const setCookie = verified.response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";", 1)[0];
  if (!cookie.includes("=")) throw new Error("session_cookie_missing");
  return { email, cookie };
}

async function acceptInvitation(trainer: AuthenticatedAccount, athlete: AuthenticatedAccount) {
  const invitation = await post("/api/access/invitations", { cookie: trainer.cookie });
  const webInvitationUrl = invitation.body.webInvitationUrl;
  if (typeof webInvitationUrl !== "string") throw new Error("web_invitation_missing");
  const token = new URL(webInvitationUrl).searchParams.get("invite");
  if (!token) throw new Error("invitation_token_missing");
  await post("/api/access/invitations/accept", {
    cookie: athlete.cookie,
    body: { token },
  });
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

async function verifyWorkoutLoop(trainer: AuthenticatedAccount, athletes: AuthenticatedAccount[]) {
  const roster = await get("/api/trainer/athletes", trainer.cookie);
  const athleteRows = Array.isArray(roster.body.athletes)
    ? roster.body.athletes as Array<Record<string, unknown>>
    : [];
  const athleteUserId = athleteRows[0]?.athleteUserId;
  if (typeof athleteUserId !== "string") throw new Error("pilot_roster_empty");

  const templateResponse = await post("/api/trainer/workout-templates", {
    cookie: trainer.cookie,
    body: {
      title: "Локальная пилотная тренировка",
      description: "Синтетическая проверка canonical API",
      generalInstruction: "Спокойный технический подход",
      estimatedDurationMin: 20,
      exercises: [{
        title: "Приседание с собственным весом",
        sets: 1,
        repetitions: 8,
        targetWeightKg: null,
        restSeconds: 60,
        trainerNote: "",
      }],
    },
  });
  const template = templateResponse.body.template as Record<string, unknown> | undefined;
  if (typeof template?.id !== "string") throw new Error("pilot_template_missing");

  const assignmentResponse = await post("/api/workout-assignments", {
    cookie: trainer.cookie,
    body: {
      athleteUserId,
      templateId: template.id,
      scheduledFor: localDate(),
      trainerNote: "Локальная проверка полного цикла",
    },
  });
  const assignment = assignmentResponse.body.assignment as Record<string, unknown> | undefined;
  if (typeof assignment?.id !== "string") throw new Error("pilot_assignment_missing");

  let assignedAthlete: AuthenticatedAccount | null = null;
  for (const athlete of athletes) {
    const assignments = await get("/api/workout-assignments", athlete.cookie);
    const rows = Array.isArray(assignments.body.assignments)
      ? assignments.body.assignments as Array<Record<string, unknown>>
      : [];
    if (rows.some((row) => row.id === assignment.id)) assignedAthlete = athlete;
  }
  if (!assignedAthlete) throw new Error("pilot_assigned_athlete_missing");

  const startedResponse = await post("/api/workout-sessions", {
    cookie: assignedAthlete.cookie,
    body: {
      assignmentId: assignment.id,
      clientTimezone: "Europe/Moscow",
      idempotencyKey: `pilot-start-${assignment.id}`,
    },
  });
  const started = startedResponse.body.session as Record<string, unknown> | undefined;
  const exercises = Array.isArray(started?.exercises)
    ? started.exercises as Array<Record<string, unknown>>
    : [];
  const sets = Array.isArray(exercises[0]?.sets)
    ? exercises[0].sets as Array<Record<string, unknown>>
    : [];
  if (typeof started?.id !== "string" || typeof sets[0]?.id !== "string") {
    throw new Error("pilot_session_snapshot_missing");
  }

  await post(`/api/workout-sessions/${started.id}/progress`, {
    cookie: assignedAthlete.cookie,
    body: {
      expectedVersion: 1,
      idempotencyKey: `pilot-progress-${started.id}`,
      sets: [{
        setLogId: sets[0].id,
        status: "completed",
        actualRepetitions: 8,
        actualDurationSeconds: null,
        actualWeightKg: null,
        rpe: 6,
        athleteComment: "Синтетическая проверка выполнена",
      }],
    },
  });
  await post(`/api/workout-sessions/${started.id}/complete`, {
    cookie: assignedAthlete.cookie,
    body: {
      expectedVersion: 2,
      idempotencyKey: `pilot-complete-${started.id}`,
      zeroResultConfirmed: false,
      zeroResultReason: "",
    },
  });

  const reviewResponse = await get(`/api/trainer/reviews/${started.id}`, trainer.cookie);
  const review = reviewResponse.body.review as Record<string, unknown> | undefined;
  const attention = review?.attention as Record<string, unknown> | undefined;
  if (typeof attention?.id !== "string") throw new Error("pilot_review_missing");
  const feedbackResponse = await post(`/api/trainer/reviews/${started.id}/feedback`, {
    cookie: trainer.cookie,
    body: {
      attentionItemId: attention.id,
      kind: "detailed",
      body: "Пилотный цикл принят. Техника и темп стабильны.",
      idempotencyKey: `pilot-feedback-${started.id}`,
    },
  });
  const feedback = feedbackResponse.body.feedback as Record<string, unknown> | undefined;
  if (typeof feedback?.id !== "string") throw new Error("pilot_feedback_missing");
  const athleteFeedback = await get(
    `/api/client/feedback?sessionId=${encodeURIComponent(started.id)}`,
    assignedAthlete.cookie,
  );
  const feedbackRows = Array.isArray(athleteFeedback.body.feedback)
    ? athleteFeedback.body.feedback as Array<Record<string, unknown>>
    : [];
  if (!feedbackRows.some((row) => row.id === feedback.id)) {
    throw new Error("pilot_feedback_not_visible_to_athlete");
  }
  process.stdout.write("PASS canonical_workout_review_feedback_loop\n");
}

async function main() {
  if (resolveDeploymentStage(process.env) !== "local") {
    throw new Error("synthetic_pilot_requires_local_environment");
  }
  const connectionString = process.env.DATABASE_MIGRATION_URL?.trim();
  if (!connectionString) throw new Error("database_migration_connection_required");

  process.stdout.write("Pilot provisioning: authenticating three canonical accounts\n");
  const trainer = await authenticate(trainerEmail);
  const athletes = await Promise.all(athleteEmails.map(authenticate));
  await post("/api/access/trainer-request", { cookie: trainer.cookie });

  const pool = new Pool({
    connectionString,
    application_name: "ai-strength-local-pilot-provisioning",
    max: 2,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const operator = new LocalPilotOperator(pool);
    const activation = await operator.activateTrainer(trainerEmail);
    if (!activation.ok) throw new Error(`trainer_activation_${activation.reason}`);

    let report = await operator.status({ trainerEmail, athleteEmails });
    for (let index = 0; index < athletes.length; index += 1) {
      if (!report.athletes[index].activeTrainerRelation) {
        await acceptInvitation(trainer, athletes[index]);
        process.stdout.write(`PASS athlete_${index + 1}_invitation_accepted\n`);
      }
    }
    report = await operator.status({ trainerEmail, athleteEmails });
    if (!report.readyForWorkoutLoop) {
      throw new Error(`pilot_not_ready_${report.blockers.join("+")}`);
    }
    process.stdout.write("Local pilot readiness: READY\n");
    process.stdout.write(`INFO activeAthletes=${report.workflow.activeAthletes}\n`);
    await verifyWorkoutLoop(trainer, athletes);
  } finally {
    await pool.end();
  }
}

const publicErrors = new Set([
  "synthetic_pilot_requires_local_environment",
  "database_migration_connection_required",
  "local_otp_disclosure_unavailable",
  "session_cookie_missing",
  "web_invitation_missing",
  "invitation_token_missing",
]);

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "";
  const code = publicErrors.has(message) || message.startsWith("http_")
    || message.startsWith("trainer_activation_") || message.startsWith("pilot_not_ready_")
    ? message
    : "local_pilot_provisioning_failed";
  process.stdout.write(`Pilot provisioning: FAILED ${code}\n`);
  process.exitCode = 1;
});
