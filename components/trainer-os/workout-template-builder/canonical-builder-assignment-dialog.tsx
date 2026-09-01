"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WorkoutTemplateDraft } from "./builder-model";
import type { TrainerWorkflowTransition } from "@/lib/trainer-workflow-transition";

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function CanonicalBuilderAssignmentDialog({
  athleteId,
  template,
  transitionContext,
  open,
  onOpenChange,
  onAssigned,
}: {
  athleteId: string | null;
  template: WorkoutTemplateDraft | null;
  transitionContext?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (title: string) => void;
}) {
  const router = useRouter();
  const [scheduledFor, setScheduledFor] = useState(today());
  const [trainerNote, setTrainerNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const assignmentIdRef = useRef<string | null>(null);

  async function assign() {
    if (!athleteId || !template || saving) return;
    setSaving(true);
    setError("");
    try {
      const assignmentId = assignmentIdRef.current ?? crypto.randomUUID();
      assignmentIdRef.current = assignmentId;
      const response = await fetch("/api/workout-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, athleteUserId: athleteId, templateId: template.id, scheduledFor, trainerNote, transitionContext }),
      });
      const body = await response.json().catch(() => ({})) as { transition?: TrainerWorkflowTransition; error?: string };
      if (!response.ok || !body.transition) throw new Error(body.error || "assignment_failed");
      assignmentIdRef.current = null;
      onAssigned(template.title);
      onOpenChange(false);
      router.push(body.transition.returnHref);
      router.refresh();
    } catch {
      setError("Не удалось назначить тренировку. Проверьте связь со спортсменом и повторите попытку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Назначить «{template?.title}»</DialogTitle>
          <DialogDescription className="text-zinc-400">Выберите дату и добавьте персональный комментарий спортсмену.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="canonical-builder-date">Дата тренировки</Label>
            <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-3 size-4 text-zinc-500" /><Input id="canonical-builder-date" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} className="border-zinc-800 bg-black pl-10" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="canonical-builder-note">Комментарий тренера</Label>
            <Textarea id="canonical-builder-note" value={trainerNote} onChange={(event) => setTrainerNote(event.target.value)} maxLength={2000} placeholder="Техника, ограничения или приоритет тренировки" className="min-h-24 border-zinc-800 bg-black" />
          </div>
          {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="min-h-11 rounded-full border-zinc-700">Отмена</Button>
          <Button type="button" onClick={() => void assign()} disabled={saving || !athleteId || !template} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}Назначить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
