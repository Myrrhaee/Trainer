"use client";

import { useEffect } from "react";

export function AthleteProfileScrollReset() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, []);

  return null;
}
