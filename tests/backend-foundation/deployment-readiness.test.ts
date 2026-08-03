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
    DATABASE_OPERATOR_URL: "postgresql://runtime_operator:secret@operator.example.test/db?sslmode=verify-full",
    ALPHA_OPERATOR_REF: "founder-alpha",
    DATABASE_MIGRATION_URL: "postgresql://runtime_migration:secret@migrate.example.test/db?sslmode=verify-full",
    AUTH_OTP_PEPPER: "otp-pepper-with-at-least-thirty-two-bytes",
    AUTH_FLOW_SECRET: "flow-secret-with-at-least-thirty-two-bytes",
    AUTH_PUBLIC_ORIGIN: "https://staging.example.test",
    AUTH_DEV_OTP_DISCLOSURE: "false",
    AUTH_EMAIL_DELIVERY_MODE: "resend",
    RESEND_API_KEY: "re_synthetic_external_test_key",
    AUTH_EMAIL_FROM: "AI Strength Coach <login@example.test>",
    NOTIFICATION_DELIVERY_MODE: "disabled",
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

test("external deployment accepts the complete Resend-backed profile", () => {
  const report = validateDeploymentConfig(stagingEnvironment(), "preflight");
  assert.equal(report.ready, true);
  assert.deepEqual(report.issues, []);
});

test("external deployment requires a configured transactional email adapter", () => {
  const reportCodes = codes(stagingEnvironment({
    AUTH_EMAIL_DELIVERY_MODE: "memory",
    RESEND_API_KEY: "",
    AUTH_EMAIL_FROM: "",
  }));
  assert.ok(reportCodes.includes("memory_email_delivery_forbidden"));
  assert.ok(reportCodes.includes("resend_api_key_required"));
  assert.ok(reportCodes.includes("auth_email_from_required"));
});

test("external deployment rejects tracked example placeholders", () => {
  const reportCodes = codes(stagingEnvironment({
    APP_RELEASE: "replace-with-immutable-commit-hash",
    DATABASE_APP_URL: "postgresql://runtime_app:replace-me@app.example.test/db?sslmode=verify-full",
    AUTH_OTP_PEPPER: "replace-with-random-secret-at-least-32-bytes",
    RESEND_API_KEY: "re_replace_with_provider_secret",
  }));
  assert.ok(reportCodes.includes("app_release_placeholder"));
  assert.ok(reportCodes.includes("database_app_url_placeholder_credentials"));
  assert.ok(reportCodes.includes("auth_otp_pepper_required"));
  assert.ok(reportCodes.includes("resend_api_key_required"));
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
  assert.ok(reportCodes.includes("operator_credentials_exposed_to_runtime"));
  assert.ok(reportCodes.includes("demo_mode_forbidden"));
  assert.ok(reportCodes.includes("legacy_runtime_forbidden"));
  assert.ok(reportCodes.includes("development_otp_disclosure_must_be_disabled"));
});

test("external preflight requires a distinct operator identity", () => {
  const missingCodes = codes(stagingEnvironment({
    DATABASE_OPERATOR_URL: "",
    ALPHA_OPERATOR_REF: "replace-with-operator-reference",
  }));
  assert.ok(missingCodes.includes("database_operator_url_required"));
  assert.ok(missingCodes.includes("alpha_operator_ref_required"));

  const sharedCodes = codes(stagingEnvironment({
    DATABASE_OPERATOR_URL: stagingEnvironment().DATABASE_WORKER_URL,
  }));
  assert.ok(sharedCodes.includes("database_identities_must_be_distinct"));
});

test("external notification delivery is disabled by default and validates live Telegram mode", () => {
  assert.equal(validateDeploymentConfig(stagingEnvironment({
    NOTIFICATION_DELIVERY_MODE: "",
  }), "preflight").ready, true);

  const memoryCodes = codes(stagingEnvironment({ NOTIFICATION_DELIVERY_MODE: "memory" }));
  assert.ok(memoryCodes.includes("memory_notification_delivery_forbidden"));
  assert.equal(memoryCodes.includes("notification_delivery_mode_invalid"), false);

  const telegramCodes = codes(stagingEnvironment({ NOTIFICATION_DELIVERY_MODE: "telegram" }));
  assert.ok(telegramCodes.includes("telegram_bot_token_required"));

  const invalidCodes = codes(stagingEnvironment({ NOTIFICATION_DELIVERY_MODE: "webhook" }));
  assert.ok(invalidCodes.includes("notification_delivery_mode_invalid"));
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
