export type DeploymentStage = "local" | "test" | "staging" | "production";
export type DeploymentValidationContext = "runtime" | "preflight";
export type EnvironmentMap = Record<string, string | undefined>;

export type DeploymentConfigIssue = {
  area: "environment" | "database" | "auth" | "email" | "notifications" | "runtime";
  code: string;
};

export type DeploymentConfigReport = {
  stage: DeploymentStage;
  ready: boolean;
  issues: DeploymentConfigIssue[];
};

const externalStages = new Set<DeploymentStage>(["staging", "production"]);
const runtimeDatabaseVariables = [
  "DATABASE_AUTH_URL",
  "DATABASE_APP_URL",
  "DATABASE_HEALTH_URL",
  "DATABASE_WORKER_URL",
] as const;
const forbiddenDatabaseUsers = new Set(["postgres", "supabase_admin", "root"]);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function value(env: EnvironmentMap, name: string) {
  return env[name]?.trim() ?? "";
}

function issue(
  issues: DeploymentConfigIssue[],
  area: DeploymentConfigIssue["area"],
  code: string,
) {
  if (!issues.some((item) => item.code === code)) issues.push({ area, code });
}

function looksLikePlaceholder(input: string) {
  return /(replace([_-]?with)?|change[_-]?me|your[_-])/i.test(input);
}

export function resolveDeploymentStage(env: EnvironmentMap): DeploymentStage {
  const explicit = value(env, "APP_ENV");
  if (explicit === "local" || explicit === "test" || explicit === "staging" || explicit === "production") {
    return explicit;
  }
  if (env.NODE_ENV === "test") return "test";
  if (env.NODE_ENV === "production") return "production";
  return "local";
}

function parseDatabaseUrl(
  env: EnvironmentMap,
  name: string,
  issues: DeploymentConfigIssue[],
  external: boolean,
) {
  const raw = value(env, name);
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    issue(issues, "database", `${name.toLowerCase()}_invalid`);
    return null;
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    issue(issues, "database", `${name.toLowerCase()}_invalid_protocol`);
  }
  if (!parsed.username) issue(issues, "database", `${name.toLowerCase()}_missing_identity`);
  if (external) {
    if (loopbackHosts.has(parsed.hostname.toLowerCase())) {
      issue(issues, "database", `${name.toLowerCase()}_local_host`);
    }
    if (forbiddenDatabaseUsers.has(decodeURIComponent(parsed.username).toLowerCase())) {
      issue(issues, "database", `${name.toLowerCase()}_privileged_identity`);
    }
    if (looksLikePlaceholder(decodeURIComponent(parsed.password))) {
      issue(issues, "database", `${name.toLowerCase()}_placeholder_credentials`);
    }
    const sslMode = parsed.searchParams.get("sslmode")?.toLowerCase();
    if (sslMode !== "require" && sslMode !== "verify-ca" && sslMode !== "verify-full") {
      issue(issues, "database", `${name.toLowerCase()}_tls_required`);
    }
  }
  return parsed;
}

function validateOrigin(env: EnvironmentMap, issues: DeploymentConfigIssue[], external: boolean) {
  const raw = value(env, "AUTH_PUBLIC_ORIGIN");
  if (!raw) {
    if (external) issue(issues, "auth", "auth_public_origin_required");
    return;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.origin !== raw || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      issue(issues, "auth", "auth_public_origin_must_be_origin");
    }
    if (external && parsed.protocol !== "https:") issue(issues, "auth", "auth_public_origin_https_required");
    if (external && loopbackHosts.has(parsed.hostname.toLowerCase())) {
      issue(issues, "auth", "auth_public_origin_local_host");
    }
  } catch {
    issue(issues, "auth", "auth_public_origin_invalid");
  }
}

function isEnabled(env: EnvironmentMap, name: string) {
  return value(env, name).toLowerCase() === "true";
}

function isEmailSender(input: string) {
  const bracketed = input.match(/<([^<>]+)>$/)?.[1];
  const address = bracketed ?? input;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

export function validateDeploymentConfig(
  env: EnvironmentMap,
  context: DeploymentValidationContext = "runtime",
): DeploymentConfigReport {
  const issues: DeploymentConfigIssue[] = [];
  const stage = resolveDeploymentStage(env);
  const external = externalStages.has(stage);
  const explicitStage = value(env, "APP_ENV");

  if (explicitStage && !["local", "test", "staging", "production"].includes(explicitStage)) {
    issue(issues, "environment", "app_env_invalid");
  }
  if (external && !explicitStage) issue(issues, "environment", "app_env_required");
  const appRelease = value(env, "APP_RELEASE");
  if (external && !appRelease) issue(issues, "environment", "app_release_required");
  if (external && looksLikePlaceholder(appRelease)) {
    issue(issues, "environment", "app_release_placeholder");
  }

  const databaseUrls = new Map<string, URL>();
  for (const name of runtimeDatabaseVariables) {
    if (external && !value(env, name)) issue(issues, "database", `${name.toLowerCase()}_required`);
    const parsed = parseDatabaseUrl(env, name, issues, external);
    if (parsed) databaseUrls.set(name, parsed);
  }

  if (external && value(env, "DATABASE_URL")) issue(issues, "database", "database_fallback_forbidden");
  if (context === "runtime" && external && value(env, "DATABASE_MIGRATION_URL")) {
    issue(issues, "database", "migration_credentials_exposed_to_runtime");
  }
  if (context === "preflight") {
    if (external && !value(env, "DATABASE_MIGRATION_URL")) {
      issue(issues, "database", "database_migration_url_required");
    }
    const parsed = parseDatabaseUrl(env, "DATABASE_MIGRATION_URL", issues, external);
    if (parsed) databaseUrls.set("DATABASE_MIGRATION_URL", parsed);
  }

  if (external) {
    const identities = [...databaseUrls.values()]
      .map((url) => decodeURIComponent(url.username).toLowerCase())
      .filter(Boolean);
    if (new Set(identities).size !== identities.length) {
      issue(issues, "database", "database_identities_must_be_distinct");
    }
  }

  const otpPepper = value(env, "AUTH_OTP_PEPPER");
  const flowSecret = value(env, "AUTH_FLOW_SECRET");
  if (external && (Buffer.byteLength(otpPepper, "utf8") < 32 || looksLikePlaceholder(otpPepper))) {
    issue(issues, "auth", "auth_otp_pepper_required");
  }
  if (external && (Buffer.byteLength(flowSecret, "utf8") < 32 || looksLikePlaceholder(flowSecret))) {
    issue(issues, "auth", "auth_flow_secret_required");
  }
  if (external && otpPepper && flowSecret && otpPepper === flowSecret) {
    issue(issues, "auth", "auth_secrets_must_be_distinct");
  }
  validateOrigin(env, issues, external);

  if (external && value(env, "AUTH_DEV_OTP_DISCLOSURE") !== "false") {
    issue(issues, "auth", "development_otp_disclosure_must_be_disabled");
  }
  if (external) {
    const emailMode = value(env, "AUTH_EMAIL_DELIVERY_MODE");
    if (emailMode === "memory") {
      issue(issues, "email", "memory_email_delivery_forbidden");
    } else if (emailMode !== "resend") {
      issue(issues, "email", "email_delivery_mode_must_be_resend");
    }
    const resendApiKey = value(env, "RESEND_API_KEY");
    if (
      Buffer.byteLength(resendApiKey, "utf8") < 20
      || /\s/.test(resendApiKey)
      || looksLikePlaceholder(resendApiKey)
    ) {
      issue(issues, "email", "resend_api_key_required");
    }
    if (!isEmailSender(value(env, "AUTH_EMAIL_FROM"))) {
      issue(issues, "email", "auth_email_from_required");
    }
  }

  const telegramClientId = value(env, "TELEGRAM_CLIENT_ID");
  const telegramClientSecret = value(env, "TELEGRAM_CLIENT_SECRET");
  if (Boolean(telegramClientId) !== Boolean(telegramClientSecret)) {
    issue(issues, "auth", "telegram_credentials_incomplete");
  }

  if (external && isEnabled(env, "NEXT_PUBLIC_DEMO_MODE")) issue(issues, "runtime", "demo_mode_forbidden");
  const notificationMode = value(env, "NOTIFICATION_DELIVERY_MODE") || "disabled";
  if (external && notificationMode === "memory") {
    issue(issues, "notifications", "memory_notification_delivery_forbidden");
  }
  if (external && !["memory", "disabled", "telegram"].includes(notificationMode)) {
    issue(issues, "notifications", "notification_delivery_mode_invalid");
  }
  if (external && notificationMode === "telegram" && !value(env, "TELEGRAM_BOT_TOKEN")) {
    issue(issues, "notifications", "telegram_bot_token_required");
  }
  for (const name of [
    "ENABLE_LEGACY_SUPABASE_ONBOARDING",
    "NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_ROSTER",
    "NEXT_PUBLIC_ENABLE_LEGACY_SUPABASE_CLIENT_HOME",
  ]) {
    if (external && isEnabled(env, name)) issue(issues, "runtime", "legacy_runtime_forbidden");
  }

  return { stage, ready: issues.length === 0, issues };
}
