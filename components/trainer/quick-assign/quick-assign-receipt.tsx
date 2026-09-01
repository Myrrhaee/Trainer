"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuickAssignPersistedResponse } from "./quick-assign-client";
import {
  formatQuickAssignCalendarDate,
  quickAssignReceiptNavigation,
  type QuickAssignReceiptAction,
} from "./quick-assign-presentation";

export function QuickAssignCompletionReceipt({ result, athleteDisplayName }: { result: QuickAssignPersistedResponse; athleteDisplayName: string }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { assignment, transition } = result;
  const navigation = quickAssignReceiptNavigation(transition);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section role="status" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-5 py-7 pb-[max(28px,env(safe-area-inset-bottom))] sm:px-8 sm:py-9">
      <div className="w-full max-w-[620px]">
        <CheckCircle2 className="size-9 text-lime-300" aria-hidden="true" />
        <h2 ref={headingRef} id="quick-assign-receipt-heading" tabIndex={-1} className="mt-4 text-2xl font-semibold text-zinc-50 outline-none focus-visible:ring-2 focus-visible:ring-lime-200">Тренировка назначена</h2>

        <div className="mt-6 border-y border-zinc-800 py-5">
          <p className="text-sm font-medium text-zinc-300">{athleteDisplayName}</p>
          <p className="mt-1 break-words text-xl font-semibold text-zinc-50">{assignment.titleSnapshot}</p>
          <p className="mt-2 text-sm text-zinc-400">Версия {assignment.sourceRevisionNumber} · {formatQuickAssignCalendarDate(assignment.scheduledFor)}</p>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-zinc-300">Назначение сохранено в плане спортсмена.</p>
        <p
          className="mt-2 text-xs text-zinc-500"
          aria-label={`Полный номер назначения ${assignment.id}`}
          title={assignment.id}
        >
          Номер назначения {shortReference(assignment.id)}
        </p>

        {transition.refreshWarning ? (
          <div className="mt-5 border-l-2 border-amber-300/70 px-4 py-1 text-sm text-amber-100">Тренировка сохранена, но рабочую очередь не удалось обновить.</div>
        ) : null}

        {navigation.allCalmCopy ? <p className="mt-6 text-sm text-zinc-400">{navigation.allCalmCopy}</p> : null}
        <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {navigation.actions.map((action) => <ReceiptAction key={`${action.label}:${action.href}`} action={action} />)}
        </div>
      </div>
    </section>
  );
}

function ReceiptAction({ action }: { action: QuickAssignReceiptAction }) {
  return (
    <Button
      asChild
      variant={action.emphasis === "primary" ? "default" : action.emphasis === "secondary" ? "outline" : "ghost"}
      className={cn(
        "min-h-11 rounded-md sm:w-auto",
        action.emphasis === "primary" && "bg-lime-300 text-black hover:bg-lime-200",
        action.emphasis === "secondary" && "border-zinc-700 text-zinc-200",
        action.emphasis === "tertiary" && "text-zinc-300",
      )}
    >
      <Link href={action.href}>{action.label}</Link>
    </Button>
  );
}

function shortReference(value: string) {
  return `…${value.replaceAll("-", "").slice(-4).toUpperCase()}`;
}
