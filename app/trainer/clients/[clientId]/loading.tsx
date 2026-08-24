import { TrainerShell } from "@/components/trainer/trainer-shell";

export default function AthleteProfileLoading() {
  return (
    <TrainerShell eyebrow="Команда" title="Профиль спортсмена" description="Загрузка личного контекста">
      <main className="min-h-screen bg-black px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[1180px] animate-pulse">
          <div className="flex items-center gap-5 border-y border-zinc-800 py-5">
            <div className="size-16 rounded-full bg-zinc-900" />
            <div className="flex-1"><div className="h-7 w-56 rounded bg-zinc-900" /><div className="mt-3 h-4 w-72 max-w-full rounded bg-zinc-900/70" /></div>
            <div className="hidden h-11 w-44 rounded-lg bg-zinc-900 sm:block" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-b border-zinc-800 pb-3"><div className="h-8 rounded bg-zinc-900/70" /><div className="h-8 rounded bg-zinc-900/70" /><div className="h-8 rounded bg-zinc-900/70" /></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]"><div className="h-72 rounded-lg border border-zinc-800 bg-zinc-950" /><div className="h-72 rounded-lg border border-zinc-800 bg-zinc-950" /></div>
        </div>
      </main>
    </TrainerShell>
  );
}
