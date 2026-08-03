import "server-only";

const MAX_JSON_BYTES = 8 * 1024;

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const suppliedOrigin = new URL(origin).origin;
    const requestUrl = new URL(request.url);
    const acceptedOrigins = new Set([requestUrl.origin]);
    const configuredOrigin = process.env.AUTH_PUBLIC_ORIGIN?.trim();
    if (configuredOrigin) acceptedOrigins.add(new URL(configuredOrigin).origin);

    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host")?.trim();
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol || requestUrl.protocol.replace(":", "");
    if (host && (protocol === "http" || protocol === "https")) {
      acceptedOrigins.add(new URL(`${protocol}://${host}`).origin);
    }

    return acceptedOrigins.has(suppliedOrigin);
  } catch {
    return false;
  }
}

export function requestIpAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export async function readSmallJsonObject(request: Request) {
  return readJsonObject(request, MAX_JSON_BYTES);
}

export async function readJsonObject(request: Request, maxBytes: number) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return null;
  }

  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) return null;
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
