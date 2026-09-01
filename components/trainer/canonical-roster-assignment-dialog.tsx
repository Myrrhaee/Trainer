"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CalendarDays, Dumbbell, Loader2 } from "lucide-react";

import type { CanonicalRosterAthlete } from "@/components/trainer/canonical-trainer-roster-model";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorkoutTemplate } from "@/lib/server/workouts/workout-types";
import { createTrainerWorkflowContext, encodeTrainerWorkflowContext, trainerWorkflowHref } from "@/lib/trainer-workflow-transition";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [trainerNote, setTrainerNote] = useState("");
  const [scheduledFor, setScheduledFor] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const assignmentIdRef = useRef<string | null>(null);
  const effectiveTemplateId = templates.some((template) => template.id === selectedTemplateId)
    ? selectedTemplateId
    : (templates[0]?.id ?? "");
  const context = createTrainerWorkflowContext({
    origin: "clients",
    athleteUserId: athlete.athleteUserId,
    returnTo: "/trainer/clients",
    returnAnchor: "next-assignment",
  });

  async function assign() {
    const template = templates.find((item) => item.id === effectiveTemplateId);
    if (!template || saving) return;
    const assignmentId = assignmentIdRef.current ?? crypto.randomUUID();
    assignmentIdRef.current = assignmentId;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/workout-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          athleteUserId: athlete.athleteUserId,
          templateId: template.id,
          scheduledFor,
          trainerNote,
          transitionContext: encodeTrainerWorkflowContext(context),
        }),
      });
      if (!response.ok) throw new Error("assignment_failed");
      assignmentIdRef.current = null;
      onAssigned(`Назначено: ${template.title} · ${athlete.displayName}`);
      onOpenChange(false);
    } catch {
      setError("Не удалось назначить тренировку. Проверьте связь со спортсменом и шаблон.");
    } finally {
      setSaving(false);
    }
  }

  const builderHref = trainerWorkflowHref(`/trainer/builder?athleteId=${athlete.athleteUserId}`, context);

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100vh-32px)] !w-[calc(100vw-32px)] max-w-xl overflow-y-auto rounded-lg border-zinc-800 bg-zinc-950 p-0">
        <DialogHeader className="border-b border-zinc-800 px-5 py-5 sm:px-6">
          <DialogTitle className="text-xl">Назначить тренировку</DialogTitle>
          <DialogDescription className="text-zinc-400">{athlete.displayName} · выберите сохранённый опубликованный шаблон.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {templates.length ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="roster-saved-template">Сохранённый шаблон</Label>
                <select id="roster-saved-template" value={effectiveTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="h-11 w-full rounded-md border border-zinc-800 bg-black px-3 text-sm outline-none focus:ring-2 focus:ring-lime-300/50">
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.title} · {template.exercises.length} упр.</option>)}
                </select>
              </div>
              <div className="grid gap-4 border-t border-zinc-800 pt-5 sm:grid-cols-[12rem_minmax(0,1fr)]">
                <div className="space-y-2"><Label htmlFor="roster-scheduled-for">Дата</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" /><Input id="roster-scheduled-for" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="border-zinc-800 bg-black pl-9" /></div></div>
                <div className="space-y-2"><Label htmlFor="roster-trainer-note">Комментарий спортсмену</Label><Input id="roster-trainer-note" value={trainerNote} onChange={(event) => setTrainerNote(event.target.value)} placeholder="Необязательно" className="border-zinc-800 bg-black" /></div>
              </div>
            </>
          ) : (
            <div className="border-l-2 border-zinc-700 pl-4">
              <p className="text-sm font-medium text-zinc-200">Нет сохранённых шаблонов</p>
              <p className="mt-1 text-sm text-zinc-500">Сначала создайте и опубликуйте тренировку в Builder.</p>
            </div>
          )}
          {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
        </div>

        <DialogFooter className="flex-col-reverse border-t border-zinc-800 px-5 py-4 sm:flex-row sm:px-6">
          <Button asChild variant="ghost" className="min-h-11 rounded-full text-zinc-400"><Link href={builderHref}>{templates.length ? "Открыть Builder" : "Создать шаблон"}</Link></Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 rounded-full border-zinc-700">Отмена</Button>
          {templates.length ? (
            <Button type="button" onClick={() => void assign()} disabled={saving || !effectiveTemplateId} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}Назначить
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
