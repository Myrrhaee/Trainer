import { closeDatabasePools } from "../../lib/server/database/pool";
import { NotificationWorker } from "../../lib/server/notifications/notification-worker";

async function main() {
  const summary = await new NotificationWorker().drainOnce();
  process.stdout.write(
    `Notification drain: claimed=${summary.claimed} delivered=${summary.delivered} `
    + `retried=${summary.retried} dead_lettered=${summary.deadLettered}\n`,
  );
}

void main()
  .catch(() => {
    process.stdout.write("Notification drain: failed\n");
    process.exitCode = 1;
  })
  .finally(closeDatabasePools);
