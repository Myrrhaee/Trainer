import "server-only";

import { getDatabasePool } from "@/lib/server/database/pool";
import type { DeploymentStage } from "@/lib/server/runtime/deployment-config";
import { expectedSchemaMigration } from "@/lib/server/runtime/schema-version";

export type DatabaseReadinessReport = {
  ready: boolean;
  issues: string[];
};

async function roleIsActive(purpose: "app" | "auth" | "health", expectedRole: string) {
  const result = await getDatabasePool(purpose).query<{ role_ok: boolean }>(
    "SELECT current_user = $1 OR pg_has_role(current_user, $1, 'member') AS role_ok",
    [expectedRole],
  );
  return result.rows[0]?.role_ok === true;
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
    roleIsActive("app", "ai_strength_app"),
    roleIsActive("auth", "ai_strength_authenticator"),
    roleIsActive("health", "ai_strength_health"),
  ]);
  const roleCodes = ["database_app_role_invalid", "database_auth_role_invalid", "database_health_role_invalid"];
  roleChecks.forEach((result, index) => {
    if (result.status === "rejected" || result.value !== true) issues.push(roleCodes[index]);
  });

  try {
    const migration = await getDatabasePool("health").query(
      "SELECT 1 FROM public.app_schema_migrations WHERE name = $1",
      [expectedSchemaMigration],
    );
    if (migration.rowCount !== 1) issues.push("database_schema_outdated");
  } catch {
    issues.push("database_schema_unverifiable");
  }

  return { ready: issues.length === 0, issues };
}
