import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

import { ClosedAlphaOperator } from "../../lib/server/ops/closed-alpha";
import { resolveDeploymentStage, validateDeploymentConfig } from "../../lib/server/runtime/deployment-config";

type CohortFile = {
  trainerEmail?: unknown;
  athleteEmails?: unknown;
};

type Cohort = {
  trainerEmail: unknown;
  athleteEmails: unknown[];
};

const publicErrors = new Set([
  "alpha_cohort_file_required",
  "alpha_cohort_file_permissions_too_open",
  "alpha_cohort_file_invalid",
  "alpha_operator_database_required",
  "alpha_operator_ref_invalid",
  "alpha_operator_requires_staging_or_test",
  "alpha_participant_emails_must_be_distinct",
  "alpha_release_confirmation_required",
  "deployment_config_invalid",
  "exactly_two_athletes_required",
  "invalid_alpha_email",
  "usage_activate_trainer_or_status",
]);

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function cohortFile(): Promise<Cohort> {
  const filename = option("--cohort-file");
  if (!filename) throw new Error("alpha_cohort_file_required");
  const resolved = path.resolve(filename);
  const metadata = await stat(resolved).catch(() => null);
  if (!metadata?.isFile()) throw new Error("alpha_cohort_file_invalid");
  if (process.platform !== "win32" && (metadata.mode & 0o077) !== 0) {
    throw new Error("alpha_cohort_file_permissions_too_open");
  }
  let parsed: CohortFile;
  try {
    parsed = JSON.parse(await readFile(resolved, "utf8")) as CohortFile;
  } catch {
    throw new Error("alpha_cohort_file_invalid");
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.athleteEmails)) {
    throw new Error("alpha_cohort_file_invalid");
  }
  return {
    trainerEmail: parsed.trainerEmail,
    athleteEmails: parsed.athleteEmails,
  };
}

function operatorRef() {
  const value = process.env.ALPHA_OPERATOR_REF?.trim() ?? "";
  if (
    !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(value)
    || /(replace|change[_-]?me|your[_-])/i.test(value)
  ) {
    throw new Error("alpha_operator_ref_invalid");
  }
  return value;
}

async function main() {
  const stage = resolveDeploymentStage(process.env);
  if (stage !== "staging" && stage !== "test") {
    throw new Error("alpha_operator_requires_staging_or_test");
  }
  if (stage === "staging" && !validateDeploymentConfig(process.env, "preflight").ready) {
    throw new Error("deployment_config_invalid");
  }
  const connectionString = process.env.DATABASE_OPERATOR_URL?.trim();
  if (!connectionString) throw new Error("alpha_operator_database_required");
  const cohort = await cohortFile();
  const pool = new Pool({
    connectionString,
    application_name: "ai-strength-closed-alpha-operator",
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const operator = new ClosedAlphaOperator(pool);
    const command = process.argv[2];
    if (command === "activate-trainer") {
      const release = process.env.APP_RELEASE?.trim() ?? "";
      if (!release || option("--confirm-release") !== release) {
        throw new Error("alpha_release_confirmation_required");
      }
      const state = await operator.activateTrainer({
        trainerEmail: cohort.trainerEmail,
        operatorRef: operatorRef(),
        release,
      });
      const ok = state === "activated" || state === "already_active";
      process.stdout.write(`Closed alpha trainer activation: ${ok ? "PASS" : "BLOCKED"} ${state}\n`);
      if (!ok) process.exitCode = 2;
      return;
    }
    if (command === "status") {
      const report = await operator.status({
        trainerEmail: cohort.trainerEmail,
        athleteEmails: cohort.athleteEmails,
      });
      process.stdout.write(`Closed alpha cohort: ${report.ready ? "READY" : "WAIT"}\n`);
      process.stdout.write(`${report.trainer.registered ? "PASS" : "WAIT"} trainer_registered\n`);
      process.stdout.write(`${report.trainer.identityVerified ? "PASS" : "WAIT"} trainer_identity_verified\n`);
      process.stdout.write(`${report.trainer.active ? "PASS" : "WAIT"} trainer_active\n`);
      report.athletes.forEach((athlete, index) => {
        process.stdout.write(`${athlete.registered ? "PASS" : "WAIT"} athlete_${index + 1}_registered\n`);
        process.stdout.write(`${athlete.identityVerified ? "PASS" : "WAIT"} athlete_${index + 1}_identity_verified\n`);
        process.stdout.write(`${athlete.relationActive ? "PASS" : "WAIT"} athlete_${index + 1}_relation_active\n`);
      });
      report.blockers.forEach((blocker) => process.stdout.write(`BLOCKER ${blocker}\n`));
      if (!report.ready) process.exitCode = 2;
      return;
    }
    throw new Error("usage_activate_trainer_or_status");
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : "";
  const code = publicErrors.has(message) ? message : "closed_alpha_operator_failed";
  process.stdout.write(`Closed alpha operator: FAILED ${code}\n`);
  process.exitCode = 1;
});
