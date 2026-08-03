"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, Copy, Dumbbell, Link2, Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TrainerAthlete, WorkoutTemplate } from "@/lib/server/workouts/workout-types";

type ExerciseDraft = {
  id: string;
  title: string;
  sets: string;
  repetitions: string;
  targetWeightKg: string;
};

function blankExercise(index: number): ExerciseDraft {
  return {
    id: `exercise-${Date.now()}-${index}`,
    title: "",
    sets: "3",
    repetitions: "10",
    targetWeightKg: "",
  };
}

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function CanonicalTrainerRoster() {
  const [athletes, setAthletes] = useState<TrainerAthlete[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [mode, setMode] = useState<"new" | "saved">("new");
  const [title, setTitle] = useState("");
  const [instruction, setInstruction] = useState("");
  const [trainerNote, setTrainerNote] = useState("");
  const [scheduledFor, setScheduledFor] = useState(today());
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise(0)]);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState("");
  const [lastAssignment, setLastAssignment] = useState<string | null>(null);

  const selectedAthlete = useMemo(
    () => athletes.find((athlete) => athlete.athleteUserId === selectedAthleteId) ?? null,
    [athletes, selectedAthleteId],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [athletesResponse, templatesResponse] = await Promise.all([
          fetch("/api/trainer/athletes", { cache: "no-store" }),
          fetch("/api/trainer/workout-templates", { cache: "no-store" }),
        ]);
        if (!athletesResponse.ok || !templatesResponse.ok) throw new Error("load_failed");
        const athletesBody = await athletesResponse.json() as { athletes: TrainerAthlete[] };
        const templatesBody = await templatesResponse.json() as { templates: WorkoutTemplate[] };
        if (cancelled) return;
        setAthletes(athletesBody.athletes);
        setTemplates(templatesBody.templates);
        setSelectedAthleteId((current) => current || athletesBody.athletes[0]?.athleteUserId || "");
        setSelectedTemplateId((current) => current || templatesBody.templates[0]?.id || "");
      } catch {
        if (!cancelled) toast.error("Не удалось загрузить рабочие данные");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  function updateExercise(id: string, field: keyof Omit<ExerciseDraft, "id">, value: string) {
    setExercises((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  async function createTemplate() {
    const payload = {
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
    };
    const response = await fetch("/api/trainer/workout-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("template_failed");
    const body = await response.json() as { template: WorkoutTemplate };
    setTemplates((current) => [body.template, ...current]);
    setSelectedTemplateId(body.template.id);
    return body.template;
  }

  async function saveOnly() {
    if (saving) return;
    setSaving(true);
    try {
      const template = await createTemplate();
      setMode("saved");
      toast.success(`Шаблон «${template.title}» сохранён`);
    } catch {
      toast.error("Проверьте название и параметры упражнений");
    } finally {
      setSaving(false);
    }
  }

  async function assign() {
    if (saving || !selectedAthlete) return;
    setSaving(true);
    try {
      const template = mode === "new"
        ? await createTemplate()
        : templates.find((item) => item.id === selectedTemplateId);
      if (!template) throw new Error("template_missing");
      const response = await fetch("/api/workout-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteUserId: selectedAthlete.athleteUserId,
          templateId: template.id,
          scheduledFor,
          trainerNote,
        }),
      });
      if (!response.ok) throw new Error("assignment_failed");
      setMode("saved");
      setLastAssignment(`${template.title} · ${selectedAthlete.displayName}`);
      toast.success("Тренировка назначена");
    } catch {
      toast.error("Не удалось назначить тренировку");
    } finally {
      setSaving(false);
    }
  }

  async function createInvitation() {
    if (inviting) return;
    setInviting(true);
    try {
      const response = await fetch("/api/access/invitations", { method: "POST" });
      if (!response.ok) throw new Error("invite_failed");
      const body = await response.json() as { invitationUrl: string };
      setInviteUrl(body.invitationUrl);
      await navigator.clipboard.writeText(body.invitationUrl);
      toast.success("Ссылка приглашения скопирована");
    } catch {
      toast.error("Не удалось создать приглашение");
    } finally {
      setInviting(false);
    }
  }

  return (
    <TrainerShell
      title="Спортсмены"
      description="Активные связи и назначение тренировок"
      headerAction={(
        <Button type="button" onClick={() => void createInvitation()} disabled={inviting} className="bg-lime-300 text-black hover:bg-lime-200">
          {inviting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
          Пригласить
        </Button>
      )}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {inviteUrl ? (
          <div className="flex items-center justify-between gap-3 border-b border-lime-300/20 bg-lime-300/[0.06] px-4 py-3 text-sm text-lime-100">
            <span className="min-w-0 truncate">Ссылка готова: {inviteUrl}</span>
            <Button type="button" size="icon" variant="ghost" title="Скопировать ссылку" aria-label="Скопировать ссылку" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>
              <Copy className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(34rem,1.4fr)]">
          <section className="min-w-0 border-t border-zinc-800 pt-5" aria-labelledby="athletes-heading">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-zinc-500">Команда</p>
                <h2 id="athletes-heading" className="mt-1 text-lg font-semibold tracking-normal">Активные спортсмены</h2>
              </div>
              <span className="text-sm text-zinc-500">{athletes.length}</span>
            </div>

            {loading ? (
              <div className="flex min-h-48 items-center justify-center text-zinc-500"><Loader2 className="size-5 animate-spin" /></div>
            ) : athletes.length === 0 ? (
              <div className="py-14 text-center">
                <Users className="mx-auto size-8 text-zinc-700" />
                <h3 className="mt-4 font-medium">Пока нет спортсменов</h3>
                <p className="mt-2 text-sm text-zinc-500">Создайте ссылку и отправьте её первому участнику.</p>
              </div>
            ) : (
              <div className="mt-4 divide-y divide-zinc-800 border-y border-zinc-800">
                {athletes.map((athlete) => {
                  const active = athlete.athleteUserId === selectedAthleteId;
                  return (
                    <button
                      key={athlete.athleteUserId}
                      type="button"
                      onClick={() => setSelectedAthleteId(athlete.athleteUserId)}
                      className={`flex min-h-20 w-full items-center gap-3 px-3 py-3 text-left transition ${active ? "bg-lime-300/[0.08]" : "hover:bg-zinc-900/70"}`}
                    >
                      <Avatar className="size-11"><AvatarFallback className="bg-zinc-800 text-zinc-100">{athlete.initials}</AvatarFallback></Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{athlete.displayName}</span>
                        <span className="mt-1 block text-xs text-zinc-500">Активная связь</span>
                      </span>
                      {active ? <CheckCircle2 className="size-4 text-lime-300" /> : null}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="min-w-0 border-t border-zinc-800 pt-5" aria-labelledby="assignment-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-zinc-500">Быстрое назначение</p>
                <h2 id="assignment-heading" className="mt-1 text-lg font-semibold tracking-normal">
                  {selectedAthlete ? selectedAthlete.displayName : "Выберите спортсмена"}
                </h2>
              </div>
              <div className="inline-flex rounded-md border border-zinc-800 bg-zinc-950 p-1">
                <button type="button" onClick={() => setMode("new")} className={`h-9 px-3 text-sm ${mode === "new" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}>Новый шаблон</button>
                <button type="button" onClick={() => setMode("saved")} disabled={!templates.length} className={`h-9 px-3 text-sm disabled:opacity-40 ${mode === "saved" ? "bg-zinc-800 text-white" : "text-zinc-500"}`}>Сохранённые</button>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {mode === "new" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="workout-title">Название тренировки</Label>
                      <Input id="workout-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Например, Полное тело A" className="border-zinc-800 bg-zinc-950" />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="workout-instruction">Общая инструкция</Label>
                      <Textarea id="workout-instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Темп, запас повторов, ограничения" className="min-h-20 border-zinc-800 bg-zinc-950" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Упражнения</Label>
                      <Button type="button" variant="outline" size="sm" onClick={() => setExercises((current) => [...current, blankExercise(current.length)])} className="border-zinc-800 bg-transparent">
                        <Plus className="mr-2 size-4" />Добавить
                      </Button>
                    </div>
                    {exercises.map((exercise, index) => (
                      <div key={exercise.id} className="grid gap-3 border-b border-zinc-800 pb-4 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_7rem_2.5rem]">
                        <Input aria-label={`Упражнение ${index + 1}`} value={exercise.title} onChange={(event) => updateExercise(exercise.id, "title", event.target.value)} placeholder={`Упражнение ${index + 1}`} className="border-zinc-800 bg-zinc-950" />
                        <Input aria-label="Подходы" type="number" min="1" max="20" value={exercise.sets} onChange={(event) => updateExercise(exercise.id, "sets", event.target.value)} className="border-zinc-800 bg-zinc-950" />
                        <Input aria-label="Повторения" type="number" min="1" max="500" value={exercise.repetitions} onChange={(event) => updateExercise(exercise.id, "repetitions", event.target.value)} className="border-zinc-800 bg-zinc-950" />
                        <Input aria-label="Вес в килограммах" type="number" min="0" step="0.5" value={exercise.targetWeightKg} onChange={(event) => updateExercise(exercise.id, "targetWeightKg", event.target.value)} placeholder="кг" className="border-zinc-800 bg-zinc-950" />
                        <Button type="button" size="icon" variant="ghost" disabled={exercises.length === 1} onClick={() => setExercises((current) => current.filter((item) => item.id !== exercise.id))} aria-label="Удалить упражнение" title="Удалить упражнение" className="text-zinc-500 hover:text-red-300">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="saved-template">Шаблон</Label>
                  <select id="saved-template" value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="h-11 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:ring-2 focus:ring-lime-300/50">
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.exercises.length} упр.</option>)}
                  </select>
                </div>
              )}

              <div className="grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="scheduled-for">Дата</Label>
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" />
                    <Input id="scheduled-for" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="border-zinc-800 bg-zinc-950 pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trainer-note">Комментарий спортсмену</Label>
                  <Input id="trainer-note" value={trainerNote} onChange={(event) => setTrainerNote(event.target.value)} placeholder="Необязательно" className="border-zinc-800 bg-zinc-950" />
                </div>
              </div>

              {lastAssignment ? (
                <p className="flex items-center gap-2 text-sm text-lime-200"><CheckCircle2 className="size-4" />Назначено: {lastAssignment}</p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-800 pt-5">
                {selectedAthlete ? (
                  <Button asChild type="button" variant="outline" className="border-zinc-700 bg-transparent">
                    <Link href={`/trainer/builder?athleteId=${selectedAthlete.athleteUserId}&from=quick-assign&returnTo=/trainer/clients`}>
                      Открыть конструктор
                    </Link>
                  </Button>
                ) : null}
                {mode === "new" ? <Button type="button" variant="outline" onClick={() => void saveOnly()} disabled={saving} className="border-zinc-700 bg-transparent">Сохранить шаблон</Button> : null}
                <Button type="button" onClick={() => void assign()} disabled={saving || !selectedAthlete || (mode === "saved" && !selectedTemplateId)} className="bg-lime-300 text-black hover:bg-lime-200">
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Dumbbell className="mr-2 size-4" />}
                  {mode === "new" ? "Сохранить и назначить" : "Назначить"}
                </Button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </TrainerShell>
  );
}
