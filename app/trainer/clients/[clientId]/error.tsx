"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";

export default function AthleteProfileError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <TrainerShell eyebrow="Команда" title="Профиль спортсмена" description="Не удалось загрузить личный контекст">
      <main className="grid min-h-[70vh] place-items-center bg-black px-4 text-center text-zinc-100">
        <div>
          <AlertTriangle className="mx-auto size-9 text-amber-200" />
          <h2 className="mt-4 text-xl font-semibold">Профиль временно недоступен</h2>
          <p className="mt-2 text-sm text-zinc-500">Другие разделы кабинета продолжают работать.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={reset} className="rounded-lg bg-lime-300 text-black hover:bg-lime-200"><RefreshCw className="size-4" />Повторить</Button>
            <Button asChild variant="outline" className="rounded-lg border-zinc-800"><Link href="/trainer/clients"><ArrowLeft className="size-4" />К спортсменам</Link></Button>
          </div>
        </div>
      </main>
    </TrainerShell>
  );
}
