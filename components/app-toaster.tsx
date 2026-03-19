"use client";

import { Toaster } from "sonner";

/**
 * Глобальные уведомления Sonner в тёмной палитре Zinc.
 */
export function AppToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-center"
      offset="1rem"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "border border-zinc-800 !bg-zinc-950/95 !text-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.55)] backdrop-blur-md",
          title: "!text-zinc-50",
          description: "!text-zinc-400",
          actionButton:
            "!bg-zinc-100 !text-zinc-950 hover:!bg-white",
          cancelButton: "!bg-zinc-800 !text-zinc-200 hover:!bg-zinc-700",
          closeButton:
            "!border-zinc-700 !bg-zinc-900 !text-zinc-400 hover:!bg-zinc-800 hover:!text-zinc-100",
          success:
            "!border !border-emerald-900/55 !bg-emerald-950/95 !text-emerald-50 [&_[data-icon]]:!text-emerald-400",
          error:
            "!border !border-rose-900/60 !bg-rose-950/95 !text-rose-50 [&_[data-icon]]:!text-rose-400",
        },
      }}
    />
  );
}
