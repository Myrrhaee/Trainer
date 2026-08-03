import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Dumbbell, UserRound } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Button } from "@/components/ui/button";
import type { TrainerReviewQueueItem } from "@/lib/server/reviews/review-types";
import type { TrainerAthlete } from "@/lib/server/workouts/workout-types";

function acceptedLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

export function CanonicalAthleteProfile({
  athlete,
  review,
}: {
  athlete: TrainerAthlete;
  review: TrainerReviewQueueItem | null;
}) {
  return (
    <TrainerShell
      eyebrow="Профиль спортсмена"
      title={athlete.displayName}
      description="Личный контекст спортсмена и доступные тренеру рабочие действия."
    >
      <div className="mx-auto w-full max-w-6xl">
        <Button asChild variant="ghost" className="mb-4 rounded-lg px-0 text-zinc-500 hover:bg-transparent hover:text-zinc-200">
          <Link href="/trainer/clients"><ArrowLeft className="size-4" />К спортсменам</Link>
        </Button>

        <section className="grid gap-7 border-y border-zinc-800 py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center" aria-labelledby="athlete-profile-name">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xl font-semibold text-zinc-100">
              {athlete.initials}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-medium uppercase text-lime-300">
                <CheckCircle2 className="size-4" />Активный спортсмен
              </p>
              <h2 id="athlete-profile-name" className="mt-2 truncate text-3xl font-semibold tracking-normal text-zinc-50">
                {athlete.displayName}
              </h2>
              <p className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <CalendarDays className="size-4" />В команде с {acceptedLabel(athlete.acceptedAt)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {review ? (
              <Button asChild className="min-h-11 rounded-lg bg-lime-300 text-black hover:bg-lime-200">
                <Link href={`/trainer/review/${review.sessionId}?from=profile&attentionItem=${review.id}`}>
                  <ClipboardList className="size-4" />Разобрать тренировку
                </Link>
              </Button>
            ) : null}
            <Button asChild variant={review ? "outline" : "default"} className={review ? "min-h-11 rounded-lg border-zinc-700 bg-zinc-950" : "min-h-11 rounded-lg bg-lime-300 text-black hover:bg-lime-200"}>
              <Link href={`/trainer/builder?athleteId=${athlete.athleteUserId}&from=quick-assign`}>
                <Dumbbell className="size-4" />Назначить тренировку
              </Link>
            </Button>
          </div>
        </section>

        <div className="grid gap-8 py-8 lg:grid-cols-2">
          <section aria-labelledby="athlete-work-context">
            <p className="text-xs font-medium uppercase text-zinc-500">Рабочий контекст</p>
            <h2 id="athlete-work-context" className="mt-2 text-xl font-semibold tracking-normal">Текущий статус</h2>
            {review ? (
              <div className="mt-5 border-l-2 border-amber-300/60 pl-4">
                <p className="text-sm font-medium text-amber-100">Тренировка ждёт разбора</p>
                <p className="mt-2 text-lg font-semibold">{review.sessionTitle}</p>
                <p className="mt-1 text-sm text-zinc-500">Выполнено {review.completedSets} из {review.totalSets} подходов.</p>
                <Link href={`/trainer/review/${review.sessionId}`} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-lime-200 hover:text-lime-100">
                  Открыть факты тренировки <ArrowRight className="size-4" />
                </Link>
              </div>
            ) : (
              <div className="mt-5 flex gap-3 border-l-2 border-lime-300/50 pl-4">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-lime-300" />
                <div>
                  <p className="font-medium">Нет тренировок, ожидающих ответа</p>
                  <p className="mt-1 text-sm text-zinc-500">Следующее действие можно начать с назначения тренировки.</p>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="athlete-profile-data">
            <p className="text-xs font-medium uppercase text-zinc-500">Профиль</p>
            <h2 id="athlete-profile-data" className="mt-2 text-xl font-semibold tracking-normal">Данные спортсмена</h2>
            <div className="mt-5 flex gap-3 border-l-2 border-zinc-700 pl-4">
              <UserRound className="mt-0.5 size-5 shrink-0 text-zinc-500" />
              <div>
                <p className="font-medium">Личная анкета пока не заполнена</p>
                <p className="mt-1 max-w-md text-sm leading-relaxed text-zinc-500">
                  Когда спортсмен добавит цели и замеры, они появятся в этом разделе.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </TrainerShell>
  );
}
