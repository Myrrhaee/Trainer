const configuredOrigin = process.env.EXTERNAL_BASE_URL?.trim();

function fail(code) {
  process.stdout.write(`FAIL ${code}\n`);
  process.exitCode = 1;
}

function pass(code) {
  process.stdout.write(`PASS ${code}\n`);
}

function externalOrigin() {
  if (!configuredOrigin) throw new Error("external_origin_required");
  const origin = new URL(configuredOrigin);
  if (origin.origin !== configuredOrigin || origin.protocol !== "https:") {
    throw new Error("external_origin_must_be_https_origin");
  }
  if (["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(origin.hostname.toLowerCase())) {
    throw new Error("external_origin_must_not_be_local");
  }
  return origin;
}

async function request(origin, path, init = {}) {
  return fetch(new URL(path, origin), {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

async function checkReadiness(origin) {
  const response = await request(origin, "/api/health/ready");
  const body = await response.json().catch(() => null);
  if (response.status !== 200 || body?.status !== "ready") {
    fail("readiness_unavailable");
    return;
  }
  pass("readiness_ready");
}

async function checkLogin(origin) {
  const response = await request(origin, "/login", { redirect: "manual" });
  if (response.status !== 200) {
    fail("login_unavailable");
    return;
  }
  pass("login_available");
}

async function checkProtectedRedirect(origin, path, code) {
  const response = await request(origin, path, { redirect: "manual" });
  const location = response.headers.get("location");
  const target = location ? new URL(location, origin) : null;
  if (
    ![302, 303, 307, 308].includes(response.status)
    || target?.origin !== origin.origin
    || target?.pathname !== "/login"
    || target.searchParams.get("next") !== path
  ) {
    fail(code);
    return;
  }
  pass(code);
}

async function main() {
  let origin;
  try {
    origin = externalOrigin();
  } catch (error) {
    fail(error instanceof Error ? error.message : "external_origin_invalid");
    return;
  }

  process.stdout.write(`External smoke: ${origin.origin}\n`);
  try {
    await checkReadiness(origin);
    await checkLogin(origin);
    await checkProtectedRedirect(origin, "/trainer/dashboard", "trainer_guest_redirect");
    await checkProtectedRedirect(origin, "/client/me", "athlete_guest_redirect");
  } catch {
    fail("external_transport_failed");
  }
}

await main();
