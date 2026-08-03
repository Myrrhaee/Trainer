export function safeReturnPath(value: unknown, fallback = "/auth/continue") {
  if (
    typeof value !== "string"
    || !value.startsWith("/")
    || value.startsWith("//")
    || value.includes("\\")
    || value.length > 2_048
  ) {
    return fallback;
  }
  return value;
}
