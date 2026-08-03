import "server-only";

import { normalizeEmail } from "@/lib/server/auth/email/email-normalization";

export function safeProviderSubject(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && normalized.length <= 255 ? normalized : null;
}

export function safeDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, 120) : null;
}

export function verifiedProviderEmail(value: unknown, verified: boolean) {
  if (!verified) return { original: null, normalized: null };
  const email = normalizeEmail(value);
  return email ?? { original: null, normalized: null };
}

export function safeMetadataValue(value: unknown, maxLength = 80) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}
