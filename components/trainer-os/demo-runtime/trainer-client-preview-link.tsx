"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { createTrainerClientPreviewHref } from "@/components/client/runtime/client-runtime-navigation";

type TrainerClientPreviewLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  athleteId: string;
};

export function TrainerClientPreviewLink({ athleteId, ...props }: TrainerClientPreviewLinkProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnParams = new URLSearchParams();

  for (const key of ["from", "entry", "attentionItem", "queue", "research", "fixture"] as const) {
    const value = searchParams.get(key);
    if (value) returnParams.set(key, value);
  }

  const returnTo = `${pathname}${returnParams.size ? `?${returnParams.toString()}` : ""}`;
  const href = createTrainerClientPreviewHref({
    athleteId,
    returnTo,
    research: searchParams.get("research"),
    fixture: searchParams.get("fixture"),
  });

  return <Link {...props} href={href} />;
}
