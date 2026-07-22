"use client";

import { Activity, CheckCircle2 } from "lucide-react";

import { getClientActivityView, getClientActor } from "@/components/trainer-os/demo-runtime/client-selectors";
import { useProductDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";

import { ClientRuntimeShell } from "./client-runtime-shell";

export function ClientRuntimeActivity({ actorId }: { actorId: string }) {
  const runtime = useProductDemoRuntime();
  const actor = getClientActor(runtime.state, actorId);
  const items = getClientActivityView(runtime.state, actorId);
  if (!actor || !items) return <main className="flex min-h-dvh items-center justify-center bg-black text-zinc-100"><h1 className="text-2xl font-semibold">Клиент не найден</h1></main>;

  return (
    <ClientRuntimeShell actorId={actorId} actorName={actor.displayName} title="Активность" description="Понятные события клиентского пути, а не технический audit log.">
      {items.length ? (
        <ol className="space-y-3" aria-label="События тренировочного пути">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-lime-200" aria-hidden="true" />
              <div className="min-w-0"><p className="font-medium text-zinc-100">{item.label}</p><p className="mt-1 truncate text-sm text-zinc-500">{item.detail}</p><p className="mt-2 text-xs text-zinc-600">{item.dateLabel}</p></div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center"><Activity className="mx-auto h-7 w-7 text-zinc-600" /><h2 className="mt-4 text-xl font-semibold text-zinc-100">Событий пока нет</h2><p className="mt-2 text-sm text-zinc-500">Назначение, старт, завершение и отзыв появятся здесь по мере прохождения flow.</p></div>
      )}
    </ClientRuntimeShell>
  );
}
