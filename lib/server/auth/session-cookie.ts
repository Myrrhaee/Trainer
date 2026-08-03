import "server-only";

import { cookies } from "next/headers";

const productionCookieName = "__Host-asc_session";
const developmentCookieName = "asc_session";

export function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? productionCookieName : developmentCookieName;
}

export async function readSessionCookie() {
  return (await cookies()).get(sessionCookieName())?.value ?? null;
}

export async function writeSessionCookie(token: string, expires: Date) {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
    priority: "high",
  });
}

export async function clearSessionCookie() {
  (await cookies()).set(sessionCookieName(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}
