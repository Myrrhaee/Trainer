"use client";

import Link from "next/link";
import { Dumbbell } from "lucide-react";

const NAVIGATION_KEY_PREFIX = "quick-assign-profile-trigger:";

export function QuickAssignProfileTrigger({ href, athleteUserId, label }: { href: string; athleteUserId: string; label: string }) {
  return (
    <Link
      href={href}
      onClick={() => window.sessionStorage.setItem(`${NAVIGATION_KEY_PREFIX}${athleteUserId}`, "1")}
    >
      <Dumbbell className="size-4" />{label}
    </Link>
  );
}

export function consumeQuickAssignProfileTrigger(athleteUserId: string) {
  const key = `${NAVIGATION_KEY_PREFIX}${athleteUserId}`;
  const openedFromTrigger = window.sessionStorage.getItem(key) === "1";
  window.sessionStorage.removeItem(key);
  return openedFromTrigger;
}
