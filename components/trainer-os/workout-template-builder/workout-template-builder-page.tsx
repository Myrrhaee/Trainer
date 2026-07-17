"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Dumbbell, Plus } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { QuickAssignDrawer } from "@/components/trainer-os/quick-assign/quick-assign-drawer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDemoLibraryExercises } from "@/lib/demo-data";

import {
  cloneTemplate,
  createBlankTemplate,
  createDraftRevision,
  getDemoBuilderTemplates,
  getTemplateExercises,
  publishTemplate,
  validateTemplate,
  type BuilderEntryContext,
  type TemplatePublishReceipt,
  type WorkoutTemplateDraft,
} from "./builder-model";
import { BuilderEditor } from "./builder-editor";
import { toQuickAssignTemplate } from "./quick-assign-adapter";
import { TemplatesWorkspace, TemplateStatusBadge } from "./templates-workspace";

type BuilderView = "templates" | "editor" | "unknown";

export function WorkoutTemplateBuilderPage({ entry }: { entry: BuilderEntryContext }) {
  const [templates, setTemplates] = useState<WorkoutTemplateDraft[]>(() => entry.emptyWorkspace ? [] : getDemoBuilderTemplates());
  const initialRequestedTemplate = entry.templateId ? templates.find((template) => template.id === entry.templateId) : undefined;
  const [view, setView] = useState<BuilderView>(() => entry.templateId ? (initialRequestedTemplate ? "editor" : "unknown") : entry.source === "quick-assign" ? "editor" : "templates");
  const [draft, setDraft] = useState<WorkoutTemplateDraft | null>(() => {
    if (initialRequestedTemplate) return initialRequestedTemplate;
    if (entry.source === "quick-assign") return { ...createBlankTemplate("quick-assign-new-draft"), category: entry.initialGoal ?? "" };
    return null;
  });
  const [baseline, setBaseline] = useState(() => draft ? JSON.stringify(draft) : "");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(() => draft ? getTemplateExercises(draft)[0]?.instanceId ?? null : null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [publishBlockedOpen, setPublishBlockedOpen] = useState(false);
  const [publishReceipt, setPublishReceipt] = useState<TemplatePublishReceipt | null>(null);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [assignAfterPublish, setAssignAfterPublish] = useState(false);
  const [localReceipt, setLocalReceipt] = useState<string | null>(null);
  const libraryExercises = useMemo(() => getDemoLibraryExercises(), []);
  const dirty = Boolean(draft && JSON.stringify(draft) !== baseline);
  const validation = useMemo(() => draft ? validateTemplate(draft) : { errors: [], warnings: [], canPublish: false }, [draft]);
  const assignableTemplate = useMemo(() => draft ? toQuickAssignTemplate(draft) : undefined, [draft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function upsertTemplate(template: WorkoutTemplateDraft) {
    setTemplates((current) => current.some((item) => item.id === template.id)
      ? current.map((item) => item.id === template.id ? template : item)
      : [template, ...current]);
  }

  function openTemplate(template: WorkoutTemplateDraft) {
    setDraft(template);
    setBaseline(JSON.stringify(template));
    setSelectedExerciseId(getTemplateExercises(template)[0]?.instanceId ?? null);
    setView("editor");
    setLocalReceipt(null);
  }

  function createNew() {
    const next = { ...createBlankTemplate(), category: entry.initialGoal ?? "" };
    setDraft(next);
    setBaseline(JSON.stringify(next));
    setSelectedExerciseId(null);
    setView("editor");
    setLocalReceipt(null);
  }

  function duplicateAndOpen(template: WorkoutTemplateDraft) {
    const copy = cloneTemplate(template);
    upsertTemplate(copy);
    openTemplate(copy);
  }

  function archiveTemplate(template: WorkoutTemplateDraft) {
    const archived = { ...template, status: "archived" as const, updatedLabel: "только что" };
    upsertTemplate(archived);
    if (draft?.id === template.id) {
      setDraft(archived);
      setBaseline(JSON.stringify(archived));
    }
  }

  function requestTemplates() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    setView("templates");
    setDraft(null);
    setSelectedExerciseId(null);
  }

  function leaveWithoutSaving() {
    setUnsavedOpen(false);
    setView("templates");
    setDraft(null);
    setBaseline("");
    setSelectedExerciseId(null);
  }

  function saveDraft() {
    if (!draft) return;
    const saved = { ...draft, title: draft.title.trim() || "Новый шаблон", status: "draft" as const, updatedLabel: "только что" };
    upsertTemplate(saved);
    setDraft(saved);
    setBaseline(JSON.stringify(saved));
    setLocalReceipt(`Черновик «${saved.title}» сохранён в памяти текущего frontend flow.`);
  }

  function saveDraftAndLeave() {
    saveDraft();
    setUnsavedOpen(false);
    setView("templates");
    setDraft(null);
    setSelectedExerciseId(null);
  }

  function handlePublish(andAssign = false) {
    if (!draft) return;
    const result = validateTemplate(draft);
    if (!result.canPublish) {
      setPublishBlockedOpen(true);
      return;
    }
    const published = publishTemplate(draft);
    upsertTemplate(published);
    setDraft(published);
    setBaseline(JSON.stringify(published));
    setPublishReceipt({ templateId: published.id, title: published.title, revision: published.revision, athleteId: entry.athleteId });
    setLocalReceipt(`Published revision ${published.revision} сохранена локально.`);
    if (andAssign && entry.athleteId) setAssignAfterPublish(true);
  }

  function createRevision() {
    if (!draft || draft.status !== "published") return;
    const revision = createDraftRevision(draft);
    upsertTemplate(revision);
    openTemplate(revision);
  }

  function openAssignment(template: WorkoutTemplateDraft) {
    if (!entry.athleteId || template.status !== "published") return;
    setDraft(template);
    setBaseline(JSON.stringify(template));
    setQuickAssignOpen(true);
    setPublishReceipt(null);
    setAssignAfterPublish(false);
  }

  useEffect(() => {
    if (!assignAfterPublish || !draft || draft.status !== "published" || !entry.athleteId) return;
    const timer = window.setTimeout(() => {
      setPublishReceipt(null);
      setQuickAssignOpen(true);
      setAssignAfterPublish(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [assignAfterPublish, draft, entry.athleteId]);

  const title = view === "templates" ? "Шаблоны тренировок" : draft?.title || "WorkoutTemplate Builder";

  return (
    <TrainerShell eyebrow="WorkoutTemplate Builder" title={title} description="Создание переиспользуемой структуры тренировки без Program и Assignment semantics.">
      {view === "templates" ? (
        <TemplatesWorkspace templates={templates} athleteId={entry.athleteId} onCreate={createNew} onOpen={openTemplate} onDuplicate={duplicateAndOpen} onArchive={archiveTemplate} onAssign={openAssignment} />
      ) : view === "unknown" ? (
        <UnknownTemplate templateId={entry.templateId} onTemplates={() => setView("templates")} onCreate={createNew} />
      ) : draft ? (
        <>
          <BuilderEditor draft={draft} libraryExercises={libraryExercises} athleteId={entry.athleteId} dirty={dirty} validation={validation} selectedExerciseId={selectedExerciseId} onDraftChange={setDraft} onSelectedExerciseChange={setSelectedExerciseId} onBack={requestTemplates} onSaveDraft={saveDraft} onPublish={() => handlePublish(false)} onCreateRevision={createRevision} onDuplicateTemplate={() => duplicateAndOpen(draft)} onPreview={() => setPreviewOpen(true)} onAssign={() => openAssignment(draft)} onSaveAndAssign={() => handlePublish(true)} />
          {localReceipt ? <div aria-live="polite" className="fixed bottom-24 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full border border-lime-300/25 bg-zinc-950 px-4 py-2 text-sm text-lime-100 shadow-2xl lg:bottom-6">{localReceipt}</div> : null}
        </>
      ) : null}

      <TemplatePreviewDialog draft={draft} open={previewOpen} onOpenChange={setPreviewOpen} />

      <Dialog open={unsavedOpen} onOpenChange={setUnsavedOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><DialogTitle>Сохранить изменения?</DialogTitle><DialogDescription className="text-zinc-400">Перед возвратом к Templates workspace можно сохранить draft или выйти без сохранения.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:flex-wrap"><Button type="button" variant="outline" onClick={() => setUnsavedOpen(false)} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Продолжить редактирование</Button><Button type="button" variant="destructive" onClick={leaveWithoutSaving} className="min-h-11 rounded-full">Выйти без сохранения</Button><Button type="button" onClick={saveDraftAndLeave} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Сохранить черновик</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishBlockedOpen} onOpenChange={setPublishBlockedOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><DialogTitle>Шаблон пока нельзя опубликовать</DialogTitle><DialogDescription className="text-zinc-400">Draft сохранится с warnings, но публикация требует исправить blocking errors.</DialogDescription></DialogHeader>
          <div role="alert" className="grid gap-2">{validation.errors.map((issue) => <div key={issue.id} className="rounded-lg border border-orange-300/25 bg-orange-300/[0.06] px-3 py-2 text-sm text-orange-100">{issue.message}</div>)}</div>
          <DialogFooter><Button type="button" onClick={() => setPublishBlockedOpen(false)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Вернуться к исправлениям</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(publishReceipt)} onOpenChange={(open) => !open && setPublishReceipt(null)}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><div className="flex size-11 items-center justify-center rounded-full border border-lime-300/25 bg-lime-300/10 text-lime-200"><CheckCircle2 className="size-5" /></div><DialogTitle className="pt-3">Шаблон опубликован</DialogTitle><DialogDescription className="text-zinc-400">«{publishReceipt?.title}» · revision {publishReceipt?.revision}. Published revision теперь открыта только для чтения.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="outline" onClick={() => setPublishReceipt(null)} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Остаться в Builder</Button>{entry.athleteId && draft ? <Button type="button" onClick={() => openAssignment(draft)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Dumbbell className="size-4" />Назначить спортсмену</Button> : null}</DialogFooter>
        </DialogContent>
      </Dialog>

      <QuickAssignDrawer key={`${entry.athleteId ?? "none"}-${assignableTemplate?.id ?? "none"}-${assignableTemplate?.revision ?? 0}`} athleteId={entry.athleteId ?? null} context={{ source: "direct", reason: draft ? `Назначение опубликованного шаблона «${draft.title}» из Builder.` : "Переход из WorkoutTemplate Builder.", returnTo: safeReturnTo(entry.returnTo) ?? "/trainer/builder" }} initialTemplate={assignableTemplate} open={quickAssignOpen} onOpenChange={setQuickAssignOpen} onAssigned={(receipt) => setLocalReceipt(`${receipt.templateTitle} назначена для ${receipt.athleteName}.`)} />
    </TrainerShell>
  );
}

function UnknownTemplate({ templateId, onTemplates, onCreate }: { templateId?: string; onTemplates: () => void; onCreate: () => void }) {
  return <main className="flex min-h-[74vh] items-center justify-center bg-black px-4 py-10 pb-28 text-zinc-100"><section className="w-full max-w-xl text-center"><AlertTriangle className="mx-auto size-8 text-orange-200" /><h1 className="mt-4 text-2xl font-semibold text-zinc-50">Шаблон не найден</h1><p className="mt-2 text-sm leading-relaxed text-zinc-500">ID {templateId ? <span className="font-mono text-zinc-400">{templateId}</span> : "не передан"}. Первый demo-template не был подставлен.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button type="button" onClick={onTemplates} variant="outline" className="min-h-11 rounded-full border-zinc-700 text-zinc-100"><ArrowLeft className="size-4" />К шаблонам</Button><Button type="button" onClick={onCreate} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Plus className="size-4" />Создать новый</Button></div></section></main>;
}

function TemplatePreviewDialog({ draft, open, onOpenChange }: { draft: WorkoutTemplateDraft | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!draft) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-[calc(100vw-24px)] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-2xl"><DialogHeader><div className="flex items-center gap-2"><TemplateStatusBadge status={draft.status} /><span className="text-xs text-zinc-600">Клиентский preview · без выполнения</span></div><DialogTitle className="pt-2 text-2xl">{draft.title || "Без названия"}</DialogTitle><DialogDescription className="text-zinc-400">{draft.description || "Описание не добавлено."}</DialogDescription></DialogHeader>{draft.generalInstruction ? <div className="rounded-lg border border-lime-300/20 bg-lime-300/[0.05] p-3 text-sm text-zinc-300">{draft.generalInstruction}</div> : null}<ol className="grid gap-3">{draft.items.map((item, index) => item.kind === "exercise" ? <PreviewExercise key={item.id} index={`${index + 1}`} exercise={item.exercise} /> : <li key={item.id} className="rounded-lg border border-lime-300/25 bg-lime-300/[0.04] p-3"><p className="text-xs font-medium uppercase text-lime-200/70">Суперсет · {item.label}</p><p className="mt-1 text-sm text-zinc-500">{item.instruction}</p><ol className="mt-3 grid gap-2">{item.exercises.map((exercise, exerciseIndex) => <PreviewExercise key={exercise.instanceId} index={`A${exerciseIndex + 1}`} exercise={exercise} compact />)}</ol></li>)}</ol><DialogFooter><Button type="button" onClick={() => onOpenChange(false)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Закрыть preview</Button></DialogFooter></DialogContent></Dialog>;
}

function PreviewExercise({ index, exercise, compact }: { index: string; exercise: ReturnType<typeof getTemplateExercises>[number]; compact?: boolean }) {
  return <li className="rounded-lg border border-zinc-800 bg-black/20 p-3"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs text-zinc-400">{index}</span><div className="min-w-0"><h3 className="font-medium text-zinc-100">{exercise.title}</h3><p className="mt-1 text-sm text-zinc-500">{exercise.prescription.type === "duration" ? `${exercise.prescription.sets} × ${exercise.prescription.durationSec} сек` : `${exercise.prescription.sets} × ${exercise.prescription.repetitionsMin}${exercise.prescription.repetitionMode === "range" ? `–${exercise.prescription.repetitionsMax}` : ""} повт.`}{exercise.prescription.restSec ? ` · отдых ${exercise.prescription.restSec} сек` : ""}</p>{exercise.perSetMode && !compact ? <p className="mt-1 text-xs text-zinc-600">{exercise.setOverrides.map((set) => `${set.kind === "warmup" ? "Разминка" : "Рабочий"} #${set.order}`).join(" · ")}</p> : null}{exercise.trainerNote ? <p className="mt-2 text-sm text-zinc-300">{exercise.trainerNote}</p> : null}</div></div></li>;
}

function safeReturnTo(value?: string) {
  return value?.startsWith("/trainer/") && !value.startsWith("//") ? value : undefined;
}
