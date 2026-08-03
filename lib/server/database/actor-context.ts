import "server-only";

import type { Pool } from "pg";

import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";

export interface Actor {
  userId: string;
}

export async function setTransactionActor(
  client: { query(text: string, values?: readonly unknown[]): Promise<unknown> },
  actor: Actor,
) {
  await client.query(
    "SELECT set_config('app.actor_user_id', $1, true)",
    [actor.userId],
  );
}

export async function withActorTransaction<T>(
  actor: Actor,
  operation: Parameters<typeof withDatabaseTransaction<T>>[1],
  pool: Pool = getDatabasePool("app"),
) {
  return withDatabaseTransaction(pool, async (client) => {
    await setTransactionActor(client, actor);
    return operation(client);
  });
}
