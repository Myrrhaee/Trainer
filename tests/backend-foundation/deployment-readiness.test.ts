import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveDeploymentStage,
  validateDeploymentConfig,
  type EnvironmentMap,
} from "../../lib/server/runtime/deployment-config";

function stagingEnvironment(overrides: EnvironmentMap = {}): EnvironmentMap {
  return {
    APP_ENV: "staging",
    APP_RELEASE: "synthetic-release",
    DATABASE_APP_URL: "postgresql://runtime_app:secret@app.example.test/db?sslmode=verify-full",
    DATABASE_AUTH_URL: "postgresql://runtime_auth:secret@auth.example.test/db?sslmode=verify-full",
    DATABASE_HEALTH_URL: "postgresql://runtime_health:secret@health.example.test/db?sslmode=verify-full",
    DATABASE_WORKER_URL: "postgresql://runtime_worker:secret@worker.example.test/db?sslmode=verify-full",
    DATABASE_MIGRATION_URL: "postgresql://runtime_migration:secret@migrate.example.test/db?sslmode=verify-full",
    AUTH_OTP_PEPPER: "otp-pepper-with-at-least-thirty-two-bytes",
    AUTH_FLOW_SECRET: "flow-secret-with-at-least-thirty-two-bytes",
    AUTH_PUBLIC_ORIGIN: "https://staging.example.test",
    AUTH_DEV_OTP_DISCLOSURE: "false",
    AUTH_EMAIL_DELIVERY_MODE: "unavailable",
    NEXT_PUBLIC_DEMO_MODE: "false",
    ...overrides,
  };
}

function codes(env: EnvironmentMap, context: "runtime" | "preflight" = "preflight") {
  return validateDeploymentConfig(env, context).issues.map((item) => item.code);
}

test("deployment stage is explicit when supplied and conservative in production", () => {
  assert.equal(resolveDeploymentStage({ APP_ENV: "staging", NODE_ENV: "production" }), "staging");
  assert.equal(resolveDeploymentStage({ NODE_ENV: "production" }), "production");
  assert.equal(resolveDeploymentStage({ NODE_ENV: "test" }), "test");
  assert.equal(resolveDeploymentStage({}), "local");
});

test("external deployment stays blocked until a real email adapter exists", () => {
  const report = validateDeploymentConfig(stagingEnvironment(), "preflight");
  assert.equal(report.ready, false);
  assert.deepEqual(report.issues, [{ area: "email", code: "email_delivery_adapter_unavailable" }]);
});

test("external deployment rejects shared, privileged, local and unencrypted database identities", () => {
  const reportCodes = codes(stagingEnvironment({
    DATABASE_APP_URL: "postgresql://postgres:secret@localhost/db",
    DATABASE_AUTH_URL: "postgresql://postgres:secret@localhost/db",
  }));
  assert.ok(reportCodes.includes("database_app_url_local_host"));
  assert.ok(reportCodes.includes("database_app_url_privileged_identity"));
  assert.ok(reportCodes.includes("database_app_url_tls_required"));
  assert.ok(reportCodes.includes("database_identities_must_be_distinct"));
});

test("runtime rejects migration credentials, demo escape hatches and development OTP disclosure", () => {
  const reportCodes = codes(stagingEnvironment({
    NEXT_PUBLIC_DEMO_MODE: "true",
    ENABLE_LEGACY_SUPABASE_ONBOARDING: "true",
    AUTH_DEV_OTP_DISCLOSURE: "true",
  }), "runtime");
  assert.ok(reportCodes.includes("migration_credentials_exposed_to_runtime"));
  assert.ok(reportCodes.includes("demo_mode_forbidden"));
  assert.ok(reportCodes.includes("legacy_runtime_forbidden"));
  assert.ok(reportCodes.includes("development_otp_disclosure_must_be_disabled"));
});

test("configuration reports contain issue codes but never secret values", () => {
  const secret = "do-not-echo-this-secret-value-123456789";
  const report = validateDeploymentConfig(stagingEnvironment({
    AUTH_OTP_PEPPER: secret,
    AUTH_FLOW_SECRET: secret,
    TELEGRAM_CLIENT_ID: "configured-without-secret",
  }), "preflight");
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false);
  assert.ok(report.issues.some((item) => item.code === "auth_secrets_must_be_distinct"));
  assert.ok(report.issues.some((item) => item.code === "telegram_credentials_incomplete"));
});

test("local and test profiles permit isolated development adapters", () => {
  assert.equal(validateDeploymentConfig({ APP_ENV: "local" }).ready, true);
  assert.equal(validateDeploymentConfig({ APP_ENV: "test", AUTH_EMAIL_DELIVERY_MODE: "memory" }).ready, true);
});
