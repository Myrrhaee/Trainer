import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from "node:crypto";

function base64Url(value: Buffer) {
  return value.toString("base64url");
}

export function createFederatedFlowId() {
  return randomUUID();
}

export function createFederatedState() {
  return base64Url(randomBytes(32));
}

export function createFederatedNonce() {
  return base64Url(randomBytes(32));
}

export function createPkceVerifier() {
  return base64Url(randomBytes(48));
}

export function createPkceChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier, "utf8").digest());
}

export function hashFederatedValue(secret: Buffer, scope: string, value: string) {
  return createHmac("sha256", secret).update(`${scope}\0${value}`, "utf8").digest();
}

export function encryptFlowCookie(
  secret: Buffer,
  value: { flowId: string; nonce: string; pkceVerifier: string; returnPath?: string },
) {
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify({ version: 1, ...value }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(base64Url).join(".");
}

export function decryptFlowCookie(secret: Buffer, value: string) {
  try {
    const [ivValue, tagValue, ciphertextValue, extra] = value.split(".");
    if (!ivValue || !tagValue || !ciphertextValue || extra) return null;
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
    if (
      parsed.version !== 1
      || typeof parsed.flowId !== "string"
      || typeof parsed.nonce !== "string"
      || typeof parsed.pkceVerifier !== "string"
      || (parsed.returnPath !== undefined && typeof parsed.returnPath !== "string")
    ) return null;
    return {
      flowId: parsed.flowId,
      nonce: parsed.nonce,
      pkceVerifier: parsed.pkceVerifier,
      returnPath: parsed.returnPath,
    };
  } catch {
    return null;
  }
}
