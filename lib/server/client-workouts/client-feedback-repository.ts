import "server-only";
import { Buffer } from "node:buffer";
import type { Pool } from "pg";
import type { Actor } from "@/lib/server/database/actor-context";
import { withActorTransaction } from "@/lib/server/database/actor-context";
import { getDatabasePool } from "@/lib/server/database/pool";
import { ClientHistoryInputError, historyUuid } from "./client-history-cursor";
import type {
  ClientFeedbackItem,
  ClientFeedbackPage,
  ClientRecentFeedback,
} from "./client-completed-types";

const stamp = `to_char(f.sent_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const fields = `f.id,f.source_session_id AS "sessionId",f.kind::text,f.body,${stamp} AS "sentAt",f.follow_up_of_id AS "followUpOfId",coalesce(u.display_name,'Тренер') AS author`;

export class ClientFeedbackRepository {
  constructor(private readonly pool: Pool = getDatabasePool("app")) {}

  latest(actor: Actor): Promise<ClientRecentFeedback | null> {
    return withActorTransaction(
      actor,
      async (client) => {
        const result = await client.query<ClientRecentFeedback>(
          `SELECT f.id,f.source_session_id AS "sessionId",a.title_snapshot AS title,${stamp} AS "sentAt",f.kind::text
        FROM app.trainer_feedback f JOIN app.workout_sessions s ON s.id=f.source_session_id AND s.athlete_user_id=$1 AND s.status IN ('completed','completed_with_omissions')
        JOIN app.workout_assignments a ON a.id=s.assignment_id AND a.athlete_user_id=$1
        WHERE f.athlete_user_id=$1 ORDER BY f.sent_at DESC,f.id DESC LIMIT 1`,
          [actor.userId],
        );
        return result.rows[0] ?? null;
      },
      this.pool,
    );
  }

  thread(
    actor: Actor,
    sessionId: string,
    input: { after?: string; focus?: string; first?: string } = {},
  ): Promise<ClientFeedbackPage | null> {
    if (
      !historyUuid.test(sessionId) ||
      (input.focus !== undefined && !historyUuid.test(input.focus)) ||
      (input.focus !== undefined && input.after !== undefined)
    )
      throw new ClientHistoryInputError("invalid_feedback_query");
    const first = input.first === undefined ? 20 : Number(input.first);
    if (
      input.first !== undefined &&
      (!/^[1-9]\d*$/.test(input.first) || first > 50)
    )
      throw new ClientHistoryInputError("invalid_feedback_query");
    let after: { at: string; id: string } | null = null;
    if (input.after !== undefined) {
      try {
        if (
          input.after.length > 2048 ||
          !input.after ||
          !/^[\w-]+$/.test(input.after)
        )
          throw Error();
        const value = JSON.parse(
          Buffer.from(input.after, "base64url").toString("utf8"),
        );
        if (
          value.v !== 1 ||
          value.domain !== "client-feedback" ||
          value.actor !== actor.userId ||
          value.session !== sessionId ||
          !historyUuid.test(value.id) ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(value.at) ||
          !Number.isFinite(Date.parse(value.at))
        )
          throw Error();
        after = { at: value.at, id: value.id };
      } catch {
        throw new ClientHistoryInputError("invalid_feedback_cursor");
      }
    }
    return withActorTransaction(
      actor,
      async (client) => {
        const result = await client.query<{
          owned: boolean;
          items: ClientFeedbackItem[];
          focus_exists: boolean;
          has_previous: boolean;
        }>(
          `WITH owned AS MATERIALIZED (
        SELECT id FROM app.workout_sessions WHERE id=$1 AND athlete_user_id=$2 AND status IN ('completed','completed_with_omissions')
      ), pivot AS (SELECT f.id,f.sent_at FROM app.trainer_feedback f JOIN owned s ON s.id=f.source_session_id WHERE f.athlete_user_id=$2 AND f.id=$5::uuid), page AS (
        SELECT ${fields} FROM app.trainer_feedback f JOIN owned s ON s.id=f.source_session_id LEFT JOIN app.users u ON u.id=f.trainer_user_id
        WHERE f.athlete_user_id=$2 AND ($3::timestamptz IS NULL OR (f.sent_at,f.id)>($3::timestamptz,$4::uuid))
        AND ($5::uuid IS NULL OR (f.sent_at,f.id)>=(SELECT sent_at,id FROM pivot))
        ORDER BY f.sent_at,f.id LIMIT $6
      ) SELECT EXISTS(SELECT 1 FROM owned) AS owned,coalesce((SELECT jsonb_agg(page ORDER BY "sentAt",id) FROM page),'[]'::jsonb) AS items,
        EXISTS(SELECT 1 FROM pivot) AS focus_exists,
        EXISTS(SELECT 1 FROM app.trainer_feedback f JOIN owned s ON s.id=f.source_session_id WHERE f.athlete_user_id=$2
          AND ($3::timestamptz IS NOT NULL OR ($5::uuid IS NOT NULL AND (f.sent_at,f.id)<(SELECT sent_at,id FROM pivot)))) AS has_previous`,
          [
            sessionId,
            actor.userId,
            after?.at ?? null,
            after?.id ?? null,
            input.focus ?? null,
            first + 1,
          ],
        );
        const row = result.rows[0];
        if (!row.owned) return null;
        const items = row.items.slice(0, first);
        const last = items.at(-1);
        const hasNextPage = row.items.length > first;
        return {
          items,
          hasNextPage,
          hasPrevious: row.has_previous,
          focusUnavailable: input.focus !== undefined && !row.focus_exists,
          endCursor:
            hasNextPage && last
              ? Buffer.from(
                  JSON.stringify({
                    v: 1,
                    domain: "client-feedback",
                    actor: actor.userId,
                    session: sessionId,
                    at: last.sentAt,
                    id: last.id,
                  }),
                ).toString("base64url")
              : null,
        };
      },
      this.pool,
    );
  }
}
