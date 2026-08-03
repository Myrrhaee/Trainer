import "server-only";

import type { Pool } from "pg";

import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { withDatabaseTransaction } from "@/lib/server/database/transaction";

export type UserStatus = "pending" | "active" | "suspended" | "deletion_pending" | "deleted";

export interface UserRecord {
  id: string;
  status: UserStatus;
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: string;
  status: UserStatus;
  display_name: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    status: row.status,
    displayName: row.display_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresUserRepository {
  constructor(
    private readonly authPool: Pool = getDatabasePool("auth"),
    private readonly appPool: Pool = getDatabasePool("app"),
  ) {}

  async create(input: { status?: UserStatus; displayName?: string | null }) {
    return withDatabaseTransaction(this.authPool, async (client) => {
      const result = await client.query<UserRow>(
        `INSERT INTO app.users (status, display_name)
         VALUES ($1, $2)
         RETURNING *`,
        [input.status ?? "pending", input.displayName ?? null],
      );
      const user = mapUser(result.rows[0]);
      await client.query(
        `INSERT INTO app.audit_events (subject_user_id, event_type, metadata)
         VALUES ($1, 'auth.user.created', jsonb_build_object('initial_status', $2::text))`,
        [user.id, user.status],
      );
      return user;
    });
  }

  async findCurrent(actor: Actor) {
    return withActorTransaction(actor, async (client) => {
      const result = await client.query<UserRow>(
        "SELECT * FROM app.users WHERE id = $1",
        [actor.userId],
      );
      return result.rowCount ? mapUser(result.rows[0]) : null;
    }, this.appPool);
  }
}
