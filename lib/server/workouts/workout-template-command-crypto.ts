import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const globalWithDevelopmentSecret = globalThis as typeof globalThis & {
  __aiStrengthWorkoutTemplateTokenSecret?: Buffer;
};

type EditTokenPayload = {
  v: 1;
  kind: "edit";
  actor: string;
  template: string;
  revision: string;
  version: number;
};

type TemplateTokenPayload = {
  v: 1;
  kind: "template";
  actor: string;
  template: string;
  version: number;
};

function secret() {
  const configured = process.env.WORKOUT_TEMPLATE_TOKEN_SECRET || process.env.AUTH_FLOW_SECRET;
  if (configured) {
    if (Buffer.byteLength(configured, "utf8") < 32) {
      throw new Error("WORKOUT_TEMPLATE_TOKEN_SECRET must contain at least 32 bytes");
    }
    return Buffer.from(configured, "utf8");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("WORKOUT_TEMPLATE_TOKEN_SECRET or AUTH_FLOW_SECRET is required in production");
  }
  globalWithDevelopmentSecret.__aiStrengthWorkoutTemplateTokenSecret ??= randomBytes(32);
  return globalWithDevelopmentSecret.__aiStrengthWorkoutTemplateTokenSecret;
}

function encode(payload: EditTokenPayload | TemplateTokenPayload) {
  const value = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret()).update(value).digest("base64url");
  return `wt1.${value}.${signature}`;
}

function decode(value: string): EditTokenPayload | TemplateTokenPayload | null {
  const parts = value.split(".");
  if (parts.length !== 3 || parts[0] !== "wt1") return null;
  const expected = createHmac("sha256", secret()).update(parts[1]).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(parts[2], "base64url");
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    if (payload.v !== 1 || (payload.kind !== "edit" && payload.kind !== "template")) return null;
    return payload as EditTokenPayload | TemplateTokenPayload;
  } catch {
    return null;
  }
}

export function issueWorkoutTemplateEditToken(input: {
  actorUserId: string;
  templateId: string;
  revisionId: string;
  version: number;
}) {
  return encode({
    v: 1,
    kind: "edit",
    actor: input.actorUserId,
    template: input.templateId,
    revision: input.revisionId,
    version: input.version,
  });
}

export function verifyWorkoutTemplateEditToken(value: string, expected: {
  actorUserId: string;
  templateId: string;
  revisionId: string;
  version: number;
}) {
  const payload = decode(value);
  return payload?.kind === "edit"
    && payload.actor === expected.actorUserId
    && payload.template === expected.templateId
    && payload.revision === expected.revisionId
    && payload.version === expected.version;
}

export function issueWorkoutTemplateLifecycleToken(input: {
  actorUserId: string;
  templateId: string;
  version: number;
}) {
  return encode({
    v: 1,
    kind: "template",
    actor: input.actorUserId,
    template: input.templateId,
    version: input.version,
  });
}

export function verifyWorkoutTemplateLifecycleToken(value: string, expected: {
  actorUserId: string;
  templateId: string;
  version: number;
}) {
  const payload = decode(value);
  return payload?.kind === "template"
    && payload.actor === expected.actorUserId
    && payload.template === expected.templateId
    && payload.version === expected.version;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["returnTo", "transitionContext", "handoffToken"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function workoutTemplateRequestFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
