"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";

const CLIENT_PREVIEW_VALUE = "trainer";

export function isSafeTrainerReturnPath(value: string | null): value is string {
  if (!value || !value.startsWith("/trainer/")) return false;
  if (value.startsWith("//") || value.includes("\\")) return false;

  try {
    const url = new URL(value, "https://demo.local");
    return url.origin === "https://demo.local" && url.pathname.startsWith("/trainer/");
  } catch {
    return false;
  }
}

export function createTrainerClientPreviewHref({
  athleteId,
  returnTo,
  research,
  fixture,
}: {
  athleteId: string;
  returnTo: string;
  research?: string | null;
  fixture?: string | null;
}) {
  const params = new URLSearchParams({
    actor: athleteId,
    preview: CLIENT_PREVIEW_VALUE,
    returnTo: isSafeTrainerReturnPath(returnTo) ? returnTo : "/trainer/dashboard",
  });

  if (research === "1" && fixture) {
    params.set("research", "1");
    params.set("fixture", fixture);
  }

  return `/client/me?${params.toString()}`;
}

export function useClientRuntimeNavigation(actorId: string) {
  const searchParams = useSearchParams();
  const previewRequested = searchParams.get("preview") === CLIENT_PREVIEW_VALUE;
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = isSafeTrainerReturnPath(requestedReturnTo)
    ? requestedReturnTo
    : "/trainer/dashboard";
  const isTrainerPreview = previewRequested;
  const research = searchParams.get("research") === "1" ? "1" : null;
  const fixture = research ? searchParams.get("fixture") : null;

  const contextEntries = useMemo(() => {
    const entries: Array<[string, string]> = [["actor", actorId]];
    if (isTrainerPreview) {
      entries.push(["preview", CLIENT_PREVIEW_VALUE], ["returnTo", returnTo]);
    }
    if (research && fixture) {
      entries.push(["research", research], ["fixture", fixture]);
    }
    return entries;
  }, [actorId, fixture, isTrainerPreview, research, returnTo]);

  const href = useCallback((target: string) => {
    const url = new URL(target, "https://demo.local");
    if (!url.pathname.startsWith("/client/")) return target;
    for (const [key, value] of contextEntries) url.searchParams.set(key, value);
    return `${url.pathname}${url.search}${url.hash}`;
  }, [contextEntries]);

  return { href, isTrainerPreview, returnTo };
}
