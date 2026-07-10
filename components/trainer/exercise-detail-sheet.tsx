"use client";

import Image from "next/image";
import Link from "next/link";
import { PlayCircle } from "lucide-react";

import { ExerciseCategoryIcon } from "@/components/exercise-category-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { getExerciseVisualCategory } from "@/lib/exercise-categories";
import type { ExerciseLibraryRow } from "@/lib/exercise-library";

export function ExerciseDetailSheet({
  exercise,
  onClose,
}: {
  exercise: ExerciseLibraryRow | null;
  onClose: () => void;
}) {
  const visualCategory = exercise ? getExerciseVisualCategory(exercise) ?? exercise.muscle_group ?? "Все" : "Все";

  return (
    <Sheet open={Boolean(exercise)} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className="w-full overflow-y-auto border-l border-zinc-800 bg-zinc-950/98 p-0 text-zinc-100 sm:max-w-[620px]">
        {exercise ? (
          <div className="min-h-full">
            <div className="relative h-[320px] overflow-hidden border-b border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.07),transparent_38%),linear-gradient(180deg,rgba(20,20,24,0.96),rgba(9,9,11,0.99))]">
              <div className="absolute inset-0 bg-gradient-to-br from-lime-300/10 via-transparent to-cyan-400/10 opacity-60" />
              <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2">
                <Badge className="rounded-full border border-zinc-700 bg-zinc-950/86 text-zinc-300">
                  {exercise.muscle_group ?? "Без категории"}
                </Badge>
                <Badge className="rounded-full border border-zinc-700 bg-zinc-950/86 text-zinc-300">
                  {exercise.equipment ?? "Без оборудования"}
                </Badge>
                {exercise.video_url?.trim() ? (
                  <Badge className="rounded-full border border-lime-300/18 bg-lime-300/12 text-lime-100">
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    Видео
                  </Badge>
                ) : null}
              </div>

              <div className="absolute inset-0 flex items-start justify-center px-6 pb-4 pt-16">
                {exercise.image_url ? (
                  <Image
                    src={exercise.image_url}
                    alt={exercise.title}
                    width={520}
                    height={360}
                    className="h-full w-full object-contain object-top"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <div className="flex h-32 w-32 items-center justify-center rounded-full border border-zinc-800 bg-black/28 text-zinc-200">
                      <ExerciseCategoryIcon category={visualCategory} className="h-20 w-20" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">
                  {exercise.is_system ? "Базовая библиотека" : "Моя библиотека"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{exercise.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  {exercise.description?.trim() ||
                    "Описание пока не заполнено. Добавьте подсказки, чтобы клиенту было проще повторить движение."}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ExerciseDetailMetaItem label="Оборудование" value={exercise.equipment ?? "Не указано"} />
                <ExerciseDetailMetaItem label="Сложность" value={exercise.difficulty ?? "Не указана"} />
              </div>

              {exercise.technique_steps?.length ? (
                <section className="rounded-[1.25rem] border border-zinc-800 bg-black/18 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Техника выполнения</h3>
                  <ol className="mt-3 space-y-2 text-sm leading-relaxed text-zinc-400">
                    {exercise.technique_steps.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-xs text-zinc-300">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}

              {exercise.tips?.length ? (
                <section className="rounded-[1.25rem] border border-lime-300/12 bg-lime-300/6 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Подсказки тренера</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {exercise.tips.map((tip) => (
                      <span
                        key={tip}
                        className="rounded-full border border-zinc-800 bg-zinc-950/72 px-3 py-1.5 text-xs text-zinc-300"
                      >
                        {tip}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}

              {exercise.video_url?.trim() ? (
                <Button asChild className="h-11 rounded-full bg-zinc-100 px-5 text-black hover:bg-white">
                  <Link href={exercise.video_url} target="_blank" rel="noreferrer">
                    <PlayCircle className="mr-2 h-4 w-4" />
                    Открыть видео
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ExerciseDetailMetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-zinc-800 bg-zinc-950/60 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}
