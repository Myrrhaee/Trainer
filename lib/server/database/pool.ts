import "server-only";

import { Pool } from "pg";

import {
  databaseConnectionString,
  databasePoolConfig,
  type DatabasePurpose,
} from "@/lib/server/database/config";

type DatabasePools = Partial<Record<DatabasePurpose, Pool>>;

const globalWithDatabasePools = globalThis as typeof globalThis & {
  __aiStrengthDatabasePools?: DatabasePools;
};

function poolRegistry() {
  globalWithDatabasePools.__aiStrengthDatabasePools ??= {};
  return globalWithDatabasePools.__aiStrengthDatabasePools;
}

export function getDatabasePool(purpose: DatabasePurpose = "app") {
  const registry = poolRegistry();
  const existing = registry[purpose];
  if (existing) return existing;

  const pool = new Pool({
    connectionString: databaseConnectionString(purpose),
    application_name: `ai-strength-${purpose}`,
    ...databasePoolConfig(),
  });

  pool.on("error", (error) => {
    console.error("[database] idle pooled connection failed", {
      purpose,
      code: "code" in error ? error.code : undefined,
    });
  });

  registry[purpose] = pool;
  return pool;
}

export async function closeDatabasePools() {
  const registry = poolRegistry();
  const pools = Object.values(registry);
  await Promise.all(pools.map((pool) => pool.end()));
  globalWithDatabasePools.__aiStrengthDatabasePools = {};
}
