"use client";

import { useEffect } from "react";

export function AthleteProfileScrollReset({ preservePosition = false }: { preservePosition?: boolean }) {
  useEffect(() => {
    if (!preservePosition) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [preservePosition]);

  return null;
}
