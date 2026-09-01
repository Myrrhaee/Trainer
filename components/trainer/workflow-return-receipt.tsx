"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2 } from "lucide-react";

export type WorkflowReturnReceiptModel = {
  id: string;
  title: string;
  detail: string;
  focusTarget: "latest-feedback-section" | "next-assignment" | "pending-reviews" | "workflow-receipt";
};

export function WorkflowReturnReceipt({ receipt }: { receipt: WorkflowReturnReceiptModel }) {
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = receipt.focusTarget === "workflow-receipt"
        ? receiptRef.current
        : document.getElementById(receipt.focusTarget);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({
        block: "center",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [receipt.focusTarget, receipt.id]);

  return (
    <div
      ref={receiptRef}
      id="workflow-receipt"
      tabIndex={-1}
      role="status"
      aria-live="polite"
      className="flex gap-3 border-l-2 border-lime-300 bg-lime-300/[0.045] px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-lime-200/70"
    >
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-200" />
      <div>
        <p className="text-sm font-medium text-lime-100">{receipt.title}</p>
        <p className="mt-1 text-xs text-zinc-500">{receipt.detail}</p>
      </div>
    </div>
  );
}
