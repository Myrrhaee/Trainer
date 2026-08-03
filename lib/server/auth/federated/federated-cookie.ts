import "server-only";

import { cookies } from "next/headers";

import { federatedAuthConfig } from "@/lib/server/auth/federated/federated-config";
import { decryptFlowCookie, encryptFlowCookie } from "@/lib/server/auth/federated/federated-crypto";

const COOKIE_NAME = process.env.NODE_ENV === "production"
  ? "__Host-ai_strength_federated"
  : "ai_strength_federated";

export async function writeFederatedFlowCookie(value: {
  flowId: string;
  nonce: string;
  pkceVerifier: string;
  returnPath?: string;
}, expiresAt: Date) {
  const store = await cookies();
  store.set(COOKIE_NAME, encryptFlowCookie(federatedAuthConfig().secret, value), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function readFederatedFlowCookie() {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? decryptFlowCookie(federatedAuthConfig().secret, value) : null;
}

export async function clearFederatedFlowCookie() {
  (await cookies()).delete(COOKIE_NAME);
}
