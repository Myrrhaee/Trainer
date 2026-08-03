import { Pool } from "pg";

import { LocalPilotOperator } from "../../lib/server/ops/local-pilot";
import { resolveDeploymentStage } from "../../lib/server/runtime/deployment-config";

const publicErrorCodes = new Set([
  "database_connection_required",
  "local_pilot_operator_forbidden_outside_local_or_test",
  "exactly_two_athletes_required",
  "invalid_pilot_email",
  "usage_activate_trainer_or_status",
]);

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function repeatedOption(name: string) {
  return process.argv.flatMap((value, index) => value === name ? [process.argv[index + 1]] : [])
    .filter((value): value is string => Boolean(value));
}

function connectionString() {
  const value = process.env.DATABASE_MIGRATION_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("database_connection_required");
  return value;
}

function assertLocalExecution() {
  const stage = resolveDeploymentStage(process.env);
  if (stage !== "local" && stage !== "test") {
    throw new Error("local_pilot_operator_forbidden_outside_local_or_test");
  }
}

function mark(ok: boolean) {
  return ok ? "PASS" : "WAIT";
}

async function main() {
  assertLocalExecution();
  const command = process.argv[2];
  const pool = new Pool({
    connectionString: connectionString(),
    application_name: "ai-strength-local-pilot-operator",
    max: 2,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const operator = new LocalPilotOperator(pool);
    if (command === "activate-trainer") {
      const result = await operator.activateTrainer(option("--email"));
      process.stdout.write(result.ok
        ? `Trainer activation: ${result.state === "activated" ? "ACTIVATED" : "ALREADY_ACTIVE"}\n`
        : `Trainer activation: BLOCKED ${result.reason}\n`);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (command === "status") {
      const athleteEmails = repeatedOption("--athlete-email");
      if (athleteEmails.length !== 2) throw new Error("exactly_two_athletes_required");
      const report = await operator.status({
        trainerEmail: option("--trainer-email"),
        athleteEmails,
      });
      process.stdout.write(`Local pilot readiness: ${report.readyForWorkoutLoop ? "READY" : "WAIT"}\n`);
      process.stdout.write(`${mark(report.trainer.registered)} trainer_registered\n`);
      process.stdout.write(`${mark(report.trainer.identityVerified)} trainer_identity_verified\n`);
      process.stdout.write(`${mark(report.trainer.capabilityStatus === "active")} trainer_active\n`);
      report.athletes.forEach((athlete, index) => {
        process.stdout.write(`${mark(athlete.registered)} athlete_${index + 1}_registered\n`);
        process.stdout.write(`${mark(athlete.identityVerified)} athlete_${index + 1}_identity_verified\n`);
        process.stdout.write(`${mark(athlete.activeTrainerRelation)} athlete_${index + 1}_relation_active\n`);
      });
      for (const [key, value] of Object.entries(report.workflow)) {
        process.stdout.write(`INFO ${key}=${value}\n`);
      }
      report.blockers.forEach((blocker) => process.stdout.write(`BLOCKER ${blocker}\n`));
      if (!report.readyForWorkoutLoop) process.exitCode = 2;
      return;
    }
    throw new Error("usage_activate_trainer_or_status");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "";
  const code = publicErrorCodes.has(message) ? message : "local_pilot_operator_failed";
  process.stdout.write(`Local pilot operator: FAILED ${code}\n`);
  process.exitCode = 1;
});
