import "server-only";

import { databaseReadiness } from "@/lib/server/database/health";
import { validateDeploymentConfig } from "@/lib/server/runtime/deployment-config";

export type DeploymentReadinessReport = {
  ready: boolean;
  issues: string[];
};

export async function deploymentReadiness(): Promise<DeploymentReadinessReport> {
  const config = validateDeploymentConfig(process.env, "runtime");
  if (!config.ready) {
    return { ready: false, issues: config.issues.map((item) => item.code) };
  }

  const database = await databaseReadiness(config.stage);
  return { ready: database.ready, issues: database.issues };
}
