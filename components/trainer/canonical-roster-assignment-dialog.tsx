"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, Dumbbell, Loader2, Plus, Trash2 } from "lucide-react";

import type { CanonicalRosterAthlete } from "@/components/trainer/canonical-trainer-roster-model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WorkoutTemplate } from "@/lib/server/workouts/workout-types";

type ExerciseDraft = { id: string; title: string; sets: string; repetitions: string; targetWeightKg: string };

function blankExercise(index: number): ExerciseDraft {
  return { id: `exercise-${Date.now()}-${index}`, title: "", sets: "3", repetitions: "10", targetWeightKg: "" };
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function CanonicalRosterAssignmentDialog({ athlete, templates, open, onOpenChange, onAssigned }: {
  athlete: CanonicalRosterAthlete;
  templates: WorkoutTemplate[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (message: string) => void;
}) {
  const [mode, setMode] = useState<"saved" | "new">(templates.length > 0 ? "saved" : "new");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [trainerNote, setTrainerNote] = useState("");
  const [scheduledFor, setScheduledFor] = useState(today());
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateExercise(id: string, field: keyof Omit<ExerciseDraft, "id">, value: string) {
    setExercises((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function createTemplate() {
    const response = await fetch("/api/trainer/workout-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: "",
        generalInstruction: instruction,
        estimatedDurationMin: null,
        exercises: exercises.map((exercise) => ({
          title: exercise.title,
          sets: Number(exercise.sets),
          repetitions: Number(exercise.repetitions),
          targetWeightKg: exercise.targetWeightKg ? Number(exercise.targetWeightKg) : null,
          restSeconds: 90,
          trainerNote: "",
        })),
      }),
    });
    if (!response.ok) throw new Error("template_failed");
    return (await response.json() as { template: WorkoutTemplate }).template;
  }

  async function assign() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const template = mode === "new" ? await createTemplate() : templates.find((item) => item.id === selectedTemplateId);
      if (!template) throw new Error("template_missing");
      const response = await fetch("/api/workout-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athleteUserId: athlete.athleteUserId, templateId: template.id, scheduledFor, trainerNote }),
      });
      if (!response.ok) throw new Error("assignment_failed");
      onAssigned(`Назначено: ${template.title} · ${athlete.displayName}`);
      onOpenChange(false);
    } catch {
      setError("Не удалось назначить тренировку. Проверьте данные и повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-32px)] !w-[calc(100vw-32px)] max-w-3xl overflow-y-auto rounded-lg border-zinc-800 bg-zinc-950 p-0">
        <DialogHeader className="border-b border-zinc-800 px-5 py-5 sm:px-6">
          <DialogTitle className="text-xl">Назначить тренировку</DialogTitle>
          <DialogDescription className="text-zinc-400">{athlete.displayName} · выберите готовый шаблон или соберите простую тренировку.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="inline-flex rounded-lg border border-zinc-800 bg-black p-1" aria-label="Источник тренировки">
            <button type="button" onClick={() => setMode("saved")} disabled={!templates.length} className={`h-9 rounded-md px-3 text-sm disabled:opacity-35 ${mode === "saved" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>Сохранённый шаблон</button>
            <button type="button" onClick={() => setMode("new")} className={`h-9 rounded-md px-3 text-sm ${mode === "new" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-200"}`}>Новая тренировка</button>
          </div>

          {mode === "saved" ? (
            <div className="space-y-2">
              <Label htmlFor="roster-saved-template">Шаблон</Label>
              <select id="roster-saved-template" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="h-11 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm outline-none focus:ring-2 focus:ring-lime-300/50">
                {templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.exercises.length} упр.</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="roster-workout-title">Название тренировки</Label><Input id="roster-workout-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Полное тело A" className="border-zinc-800 bg-black" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="roster-workout-instruction">Общая инструкция</Label><Textarea id="roster-workout-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Темп, запас повторов, ограничения" className="min-h-20 border-zinc-800 bg-black" /></div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3"><Label>Упражнения</Label><Button type="button" variant="outline" size="sm" onClick={() => setExercises((current) => [...current, blankExercise(current.length)])} className="border-zinc-800 bg-transparent"><Plus className="size-4" />Добавить</Button></div>
                {exercises.map((exercise, index) => (
                  <div key={exercise.id} className="grid gap-3 border-b border-zinc-800 pb-4 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_7rem_2.5rem]">
                    <Input aria-label={`Упражнение ${index + 1}`} value={exercise.title} onChange={(event) => updateExercise(exercise.id, "title", event.target.value)} placeholder={`Упражнение ${index + 1}`} className="border-zinc-800 bg-black" />
                    <Input aria-label="Подходы" type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateExercise(exercise.id, "sets", event.target.value)} className="border-zinc-800 bg-black" />
                    <Input aria-label="Повторения" type="number" min="1" max="500" value={exercise.repetitions} onChange={(event) => updateExercise(exercise.id, "repetitions", event.target.value)} className="border-zinc-800 bg-black" />
                    <Input aria-label="Вес в килограммах" type="number" min="0" step="0.5" value={exercise.targetWeightKg} onChange={(event) => updateExercise(exercise.id, "targetWeightKg", event.target.value)} placeholder="кг" className="border-zinc-800 bg-black" />
                    <Button type="button" size="icon" variant="ghost" disabled={exercises.length === 1} onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))} aria-label="Удалить упражнение" title="Удалить упражнение" className="text-zinc-500 hover:text-red-300"><Trash2 className="size-4" /></Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <div className="space-y-2"><Label htmlFor="roster-scheduled-for">Дата</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" /><Input id="roster-scheduled-for" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="border-zinc-800 bg-black pl-9" /></div></div>
            <div className="space-y-2"><Label htmlFor="roster-trainer-note">Комментарий спортсмену</Label><Input id="roster-trainer-note" value={trainerNote} onChange={(event) => setTrainerNote(event.target.value)} placeholder="Необязательно" className="border-zinc-800 bg-black" /></div>
          </div>
          {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
        </div>

        <DialogFooter className="flex-col-reverse border-t border-zinc-800 px-5 py-4 sm:flex-row sm:px-6">
          <Button asChild variant="ghost" className="min-h-11 rounded-full text-zinc-400"><Link href={`/trainer/builder?athleteId=${athlete.athleteUserId}&from=quick-assign&returnTo=/trainer/clients`}>Открыть полный конструктор</Link></Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 rounded-full border-zinc-700">Отмена</Button>
          <Button type="button" onClick={() => void assign()} disabled={saving || (mode === "saved" ? !selectedTemplateId : !title.trim())} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}{mode === "new" ? "Сохранить и назначить" : "Назначить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
