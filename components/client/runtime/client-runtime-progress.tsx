"use client";

import { Dumbbell, LineChart, Sparkles, TrendingUp } from "lucide-react";

import { getClientActor, getClientProgressView } from "@/components/trainer-os/demo-runtime/client-selectors";
import { useProductDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";

import { ClientRuntimeShell } from "./client-runtime-shell";

export function ClientRuntimeProgress({ actorId }: { actorId: string }) {
  const runtime = useProductDemoRuntime();
  const actor = getClientActor(runtime.state, actorId);
  const progress = getClientProgressView(runtime.state, actorId);
  if (!actor || !progress) return <SafeState />;

  return (
    <ClientRuntimeShell actorId={actorId} actorName={actor.displayName} title="Прогресс" description="Только показатели, рассчитанные из сохранённых WorkoutSession и SetLog.">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric icon={Dumbbell} label="Завершено" value={String(progress.completedWorkoutCount)} />
        <Metric icon={Sparkles} label="Регулярность" value={`${progress.consistency}%`} />
        <Metric icon={TrendingUp} label="Лучший сет" value={progress.bestSet ? `${progress.bestSet.weightKg ?? "—"} кг × ${progress.bestSet.repetitions}` : "Нет данных"} />
      </div>

      <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-5" aria-labelledby="strength-progress">
        <h2 id="strength-progress" className="text-xl font-semibold text-zinc-50">Силовая динамика</h2>
        {progress.strengthTrend.length > 1 ? (
          <div className="mt-6 flex h-48 items-end gap-2" role="img" aria-label="График фактических результатов подходов">
            {progress.strengthTrend.map((point, index) => {
              const max = Math.max(...progress.strengthTrend.map((item) => item.value), 1);
              return <div key={`${point.label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-sm bg-lime-300/70" style={{ height: `${Math.max(8, Math.round((point.value / max) * 150))}px` }} /><span className="text-[10px] text-zinc-600">{point.label}</span></div>;
            })}
          </div>
        ) : (
          <Empty title="Недостаточно фактических подходов" detail="График появится после нескольких сохранённых результатов." />
        )}
      </section>

      <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/80 p-5" aria-labelledby="bodyweight-progress">
        <h2 id="bodyweight-progress" className="text-xl font-semibold text-zinc-50">Динамика веса</h2>
        {progress.bodyweightTrend.length ? <p className="mt-4 text-sm text-zinc-300">Есть measurement facts.</p> : <Empty title="Замеров пока нет" detail="Фиктивная линия веса не отображается." />}
      </section>
    </ClientRuntimeShell>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Dumbbell; label: string; value: string }) { return <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4"><Icon className="h-5 w-5 text-lime-200" /><p className="mt-4 text-xs uppercase text-zinc-500">{label}</p><p className="mt-2 text-xl font-semibold text-zinc-100">{value}</p></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="mt-5 rounded-lg border border-dashed border-zinc-800 p-6 text-center"><LineChart className="mx-auto h-6 w-6 text-zinc-600" /><p className="mt-3 font-medium text-zinc-200">{title}</p><p className="mt-1 text-sm text-zinc-500">{detail}</p></div>; }
function SafeState() { return <main className="flex min-h-dvh items-center justify-center bg-black text-zinc-100"><h1 className="text-2xl font-semibold">Клиент не найден</h1></main>; }
