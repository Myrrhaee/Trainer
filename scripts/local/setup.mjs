import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`local_setup_step_failed:${path.basename(command)}`);
  }
}

run("docker", [
  "compose",
  "--env-file",
  ".env.development.local",
  "-f",
  "compose.local.yml",
  "up",
  "-d",
  "--wait",
]);
run(process.execPath, ["scripts/db/bootstrap.mjs"]);
run(process.execPath, ["scripts/db/migrate.mjs"]);

process.stdout.write("Local PostgreSQL: READY on 127.0.0.1:55432\n");
