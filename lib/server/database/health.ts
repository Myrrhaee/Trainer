import "server-only";

import { getDatabasePool } from "@/lib/server/database/pool";
import type { DeploymentStage } from "@/lib/server/runtime/deployment-config";
import {
  expectedSchemaMigration,
  expectedSchemaMigrations,
} from "@/lib/server/runtime/schema-version";

export type DatabaseReadinessReport = {
  ready: boolean;
  issues: string[];
};

type RuntimePrincipalState = {
  role_ok: boolean;
  principal_restricted: boolean;
};

export type SchemaReadinessState = "current" | "outdated" | "ahead_or_unknown" | "inconsistent";

export function classifySchemaReadiness(input: {
  appliedMigrations: string[];
}): SchemaReadinessState {
  const applied = input.appliedMigrations;
  const expected = [...expectedSchemaMigrations];
  if (applied.length === expected.length && applied.every((name, index) => name === expected[index])) {
    return "current";
  }
  const expectedSet: ReadonlySet<string> = new Set(expected);
  if (applied.some((name) => !expectedSet.has(name))) return "ahead_or_unknown";
  if (applied.includes(expectedSchemaMigration)) return "inconsistent";
  return "outdated";
}

async function runtimePrincipalState(
  purpose: "app" | "auth" | "health",
  expectedRole: string,
) {
  const result = await getDatabasePool(purpose).query<RuntimePrincipalState>(
    `SELECT
       current_user = $1 OR pg_has_role(current_user, $1, 'member') AS role_ok,
       NOT (
         login.rolsuper OR login.rolbypassrls OR login.rolcreatedb
         OR login.rolcreaterole OR login.rolreplication
         OR pg_has_role(current_user, 'ai_strength_migrator', 'member')
         OR pg_has_role(current_user, 'ai_strength_operator', 'member')
       ) AS principal_restricted
     FROM pg_roles login
     WHERE login.rolname = current_user`,
    [expectedRole],
  );
  return result.rows[0] ?? { role_ok: false, principal_restricted: false };
}

export async function databaseReadiness(stage: DeploymentStage): Promise<DatabaseReadinessReport> {
  const issues: string[] = [];
  try {
    await getDatabasePool("health").query("SELECT 1");
  } catch {
    return { ready: false, issues: ["database_health_unavailable"] };
  }

  if (stage === "local" || stage === "test") return { ready: true, issues };

  const roleChecks = await Promise.allSettled([
    runtimePrincipalState("app", "ai_strength_app"),
    runtimePrincipalState("auth", "ai_strength_authenticator"),
    runtimePrincipalState("health", "ai_strength_health"),
  ]);
  const roleCodes = ["database_app_role_invalid", "database_auth_role_invalid", "database_health_role_invalid"];
  const principalCodes = [
    "database_app_principal_privileged",
    "database_auth_principal_privileged",
    "database_health_principal_privileged",
  ];
  roleChecks.forEach((result, index) => {
    if (result.status === "rejected" || result.value.role_ok !== true) issues.push(roleCodes[index]);
    if (result.status === "rejected" || result.value.principal_restricted !== true) {
      issues.push(principalCodes[index]);
    }
  });

  try {
    const migration = await getDatabasePool("health").query<{
      applied_migrations: string[] | null;
    }>(
      `SELECT array_agg(name ORDER BY name) AS applied_migrations
       FROM public.app_schema_migrations`,
    );
    const row = migration.rows[0];
    const state = classifySchemaReadiness({
      appliedMigrations: row?.applied_migrations ?? [],
    });
    if (state === "outdated") issues.push("database_schema_outdated");
    if (state === "ahead_or_unknown") issues.push("database_schema_ahead_or_unknown");
    if (state === "inconsistent") issues.push("database_schema_inconsistent");
  } catch {
    issues.push("database_schema_unverifiable");
  }

  return { ready: issues.length === 0, issues };
}
