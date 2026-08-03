import {
  validateDeploymentConfig,
  type DeploymentValidationContext,
} from "../../lib/server/runtime/deployment-config";

function validationContext(): DeploymentValidationContext {
  const argument = process.argv.find((item) => item.startsWith("--context="));
  const context = argument?.slice("--context=".length) || "runtime";
  if (context !== "runtime" && context !== "preflight") {
    throw new Error("context must be runtime or preflight");
  }
  return context;
}

function main() {
  const context = validationContext();
  const report = validateDeploymentConfig(process.env, context);
  process.stdout.write(
    `Deployment config: ${report.ready ? "PASS" : "FAIL"} (${report.stage}, ${context})\n`,
  );
  for (const item of report.issues) {
    process.stdout.write(`FAIL ${item.area}.${item.code}\n`);
  }
  if (!report.ready) process.exitCode = 1;
}

try {
  main();
} catch {
  process.stdout.write("Deployment config: FAIL\nFAIL environment.invalid_validation_context\n");
  process.exitCode = 1;
}
