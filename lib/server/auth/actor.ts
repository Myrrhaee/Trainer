import "server-only";

import { readSessionCookie } from "@/lib/server/auth/session-cookie";
import { SessionService } from "@/lib/server/auth/session-service";

export async function resolveRequestActor(service = new SessionService()) {
  return service.authenticate(await readSessionCookie());
}
