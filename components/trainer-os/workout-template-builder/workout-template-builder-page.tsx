"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Dumbbell, Plus } from "lucide-react";

import { TrainerShell } from "@/components/trainer/trainer-shell";
import { QuickAssignDrawer } from "@/components/trainer-os/quick-assign/quick-assign-drawer";
import { safeTrainerReturnPath } from "@/components/trainer-os/demo-runtime/flow-context";
import { getWorkoutTemplateWorkspace } from "@/components/trainer-os/demo-runtime/selectors";
import { useTrainerDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
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
import { isDemoModeEnabled } from "@/lib/demo-mode";

import {
  cloneTemplate,
  createBlankTemplate,
  createDraftRevision,
  getTemplateExercises,
  publishTemplate,
  validateTemplate,
  type BuilderEntryContext,
  type TemplatePublishReceipt,
  type WorkoutTemplateDraft,
} from "./builder-model";
import { BuilderEditor } from "./builder-editor";
import {
  createQuickAssignBuilderHandoff,
  publishQuickAssignBuilderHandoff,
  quickAssignHrefFromHandoff,
  readQuickAssignBuilderHandoff,
} from "@/components/trainer/quick-assign/quick-assign-handoff";
import { createTrainerWorkflowContext, encodeTrainerWorkflowContext } from "@/lib/trainer-workflow-transition";
import {
  archiveCanonicalBuilderTemplate,
  createCanonicalBuilderRevision,
  loadCanonicalBuilderTemplates,
  publishCanonicalBuilderTemplate,
  saveCanonicalBuilderDraft,
} from "./canonical-builder-client";
import { clearBuilderDraft, readBuilderDraft, writeBuilderDraft } from "./builder-draft-persistence";
import { toQuickAssignTemplate } from "./quick-assign-adapter";
import { TemplatesWorkspace, TemplateStatusBadge } from "./templates-workspace";

type BuilderView = "templates" | "editor" | "unknown";
type BuilderCommandKind = "save" | "publish" | "publish-and-assign" | "revision";
type BuilderCommandState = { status: "idle" | "running" | "failed"; kind?: BuilderCommandKind };
type BuilderFeedback = { tone: "success" | "error"; message: string };

export function WorkoutTemplateBuilderPage({ entry }: { entry: BuilderEntryContext }) {
  const router = useRouter();
  const runtime = useTrainerDemoRuntime();
  const demoMode = isDemoModeEnabled();
  const demoTemplates = useMemo(
    () => entry.emptyWorkspace ? [] : getWorkoutTemplateWorkspace(runtime.state),
    [entry.emptyWorkspace, runtime.state]
  );
  const [canonicalTemplates, setCanonicalTemplates] = useState<WorkoutTemplateDraft[]>([]);
  const [canonicalLoading, setCanonicalLoading] = useState(!demoMode);
  const templates = demoMode ? demoTemplates : canonicalTemplates;
  const initialRequestedTemplate = entry.templateId ? templates.find((template) => template.id === entry.templateId) : undefined;
  const [view, setView] = useState<BuilderView>(() => entry.templateId ? (initialRequestedTemplate ? "editor" : "unknown") : "templates");
  const [draft, setDraft] = useState<WorkoutTemplateDraft | null>(() => {
    if (initialRequestedTemplate) return initialRequestedTemplate;
    return null;
  });
  const [baseline, setBaseline] = useState(() => initialRequestedTemplate ? JSON.stringify(initialRequestedTemplate) : "");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(() => draft ? getTemplateExercises(draft)[0]?.instanceId ?? null : null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [publishBlockedOpen, setPublishBlockedOpen] = useState(false);
  const [publishReceipt, setPublishReceipt] = useState<TemplatePublishReceipt | null>(null);
  const [quickAssignOpen, setQuickAssignOpen] = useState(false);
  const [assignAfterPublish, setAssignAfterPublish] = useState(false);
  const [feedback, setFeedback] = useState<BuilderFeedback | null>(null);
  const [commandState, setCommandState] = useState<BuilderCommandState>({ status: "idle" });
  const [recoveryDraft, setRecoveryDraft] = useState<WorkoutTemplateDraft | null>(null);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [handoffChecked, setHandoffChecked] = useState(false);
  const commandInFlightRef = useRef(false);
  const libraryExercises = useMemo(() => getDemoLibraryExercises(), []);
  const dirty = Boolean(draft && JSON.stringify(draft) !== baseline);
  const validation = useMemo(() => draft ? validateTemplate(draft) : { errors: [], warnings: [], canPublish: false }, [draft]);
  const assignableTemplate = useMemo(() => draft ? toQuickAssignTemplate(draft) : undefined, [draft]);

  function upsertCanonical(template: WorkoutTemplateDraft) {
    setCanonicalTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
  }

  useEffect(() => {
    if (demoMode) return;
    let active = true;
    loadCanonicalBuilderTemplates()
      .then((loaded) => {
        if (!active) return;
        setCanonicalTemplates(loaded);
        if (entry.templateId) {
          const requested = loaded.find((template) => template.id === entry.templateId);
          if (requested) {
            setDraft(requested);
            setBaseline(JSON.stringify(requested));
            setSelectedExerciseId(getTemplateExercises(requested)[0]?.instanceId ?? null);
            setView("editor");
          } else {
            setView("unknown");
          }
        }
      })
      .catch(() => active && setFeedback({ tone: "error", message: "Не удалось загрузить шаблоны." }))
      .finally(() => active && setCanonicalLoading(false));
    return () => { active = false; };
  }, [demoMode, entry.templateId]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  useEffect(() => {
    if (demoMode) runtime.commands.recordPilotEvent({
      name: "builder_opened",
      athleteId: entry.athleteId,
      workoutTemplateId: entry.templateId,
    });
  }, [demoMode, entry.athleteId, entry.templateId, runtime.commands]);

  useEffect(() => {
    if (demoMode || handoffChecked) return;
    if (entry.handoffToken && !readQuickAssignBuilderHandoff(entry.handoffToken, entry.athleteId)) {
      setFeedback({ tone: "error", message: "Контекст назначения устарел. Шаблон можно сохранить, но возврат к назначению недоступен." });
    }
    setHandoffChecked(true);
  }, [demoMode, entry.athleteId, entry.handoffToken, handoffChecked]);

  useEffect(() => {
    if (recoveryChecked) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const recovered = readBuilderDraft(entry.athleteId);
      if (recovered) {
        const canonical = templates.find((template) => template.id === recovered.id);
        if (!canonical || JSON.stringify(recovered) !== JSON.stringify(canonical)) {
          setRecoveryDraft(recovered);
        } else {
          clearBuilderDraft();
        }
      }
      setRecoveryChecked(true);
    });
    return () => { active = false; };
  }, [entry.athleteId, recoveryChecked, templates]);

  useEffect(() => {
    if (!recoveryChecked || recoveryDraft) return;
    if (draft?.status === "draft" && dirty) writeBuilderDraft(draft, entry.athleteId);
    else clearBuilderDraft();
  }, [dirty, draft, entry.athleteId, recoveryChecked, recoveryDraft]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function openTemplate(template: WorkoutTemplateDraft) {
    setDraft(template);
    setBaseline(JSON.stringify(template));
    setSelectedExerciseId(getTemplateExercises(template)[0]?.instanceId ?? null);
    setView("editor");
    setFeedback(null);
  }

  function createNew() {
    const next = { ...createBlankTemplate(), category: entry.initialGoal ?? "" };
    writeBuilderDraft(next, entry.athleteId);
    setDraft(next);
    setBaseline("");
    setSelectedExerciseId(null);
    setView("editor");
    setFeedback(null);
  }

  function updateDraft(next: WorkoutTemplateDraft) {
    if (next.status === "draft") writeBuilderDraft(next, entry.athleteId);
    setDraft(next);
    if (feedback?.tone === "error") setFeedback(null);
  }

  async function duplicateAndOpen(template: WorkoutTemplateDraft) {
    const copy = cloneTemplate(template);
    if (!demoMode) {
      try {
        const confirmed = await saveCanonicalBuilderDraft(copy);
        upsertCanonical(confirmed);
        openTemplate(confirmed);
      } catch {
        setFeedback({ tone: "error", message: "Не удалось создать копию шаблона." });
      }
      return;
    }
    const result = runtime.commands.saveWorkoutTemplateDraft({ actor: runtime.actor, template: copy, athleteId: entry.athleteId });
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.error.message });
      return;
    }
    openTemplate(result.receipt.template);
  }

  async function archiveTemplate(template: WorkoutTemplateDraft) {
    if (!demoMode) {
      try {
        const confirmed = await archiveCanonicalBuilderTemplate(template.id);
        upsertCanonical(confirmed);
        if (draft?.id === template.id) {
          setDraft(confirmed);
          setBaseline(JSON.stringify(confirmed));
        }
      } catch {
        setFeedback({ tone: "error", message: "Не удалось архивировать шаблон." });
      }
      return;
    }
    const archived = { ...template, status: "archived" as const, updatedLabel: "только что" };
    const result = runtime.commands.archiveWorkoutTemplatePrototype({ actor: runtime.actor, template: archived, athleteId: entry.athleteId });
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.error.message });
      return;
    }
    const confirmed = result.receipt.template;
    if (draft?.id === template.id) {
      setDraft(confirmed);
      setBaseline(JSON.stringify(confirmed));
    }
  }

  function requestTemplates() {
    if (commandInFlightRef.current) return;
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    setView("templates");
    setDraft(null);
    setSelectedExerciseId(null);
  }

  function leaveWithoutSaving() {
    clearBuilderDraft();
    setUnsavedOpen(false);
    setView("templates");
    setDraft(null);
    setBaseline("");
    setSelectedExerciseId(null);
  }

  async function saveDraft() {
    if (!draft || commandInFlightRef.current) return false;
    commandInFlightRef.current = true;
    setCommandState({ status: "running", kind: "save" });
    setFeedback(null);
    const saved = { ...draft, title: draft.title.trim(), status: "draft" as const, updatedLabel: "только что" };
    if (!demoMode) {
      try {
        const confirmed = await saveCanonicalBuilderDraft(saved);
        upsertCanonical(confirmed);
        setDraft(confirmed);
        setBaseline(JSON.stringify(confirmed));
        clearBuilderDraft();
        setFeedback({ tone: "success", message: confirmed.title ? `Черновик «${confirmed.title}» сохранён.` : "Черновик без названия сохранён." });
        setCommandState({ status: "idle" });
        commandInFlightRef.current = false;
        return true;
      } catch {
        setFeedback({ tone: "error", message: "Не удалось сохранить черновик." });
        setCommandState({ status: "failed", kind: "save" });
        commandInFlightRef.current = false;
        return false;
      }
    }
    await wait(350);
    const result = runtime.commands.saveWorkoutTemplateDraft({ actor: runtime.actor, template: saved, athleteId: entry.athleteId });
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.error.message });
      setCommandState({ status: "failed", kind: "save" });
      commandInFlightRef.current = false;
      return false;
    }
    const confirmed = result.receipt.template;
    setDraft(confirmed);
    setBaseline(JSON.stringify(confirmed));
    clearBuilderDraft();
    setFeedback({ tone: "success", message: confirmed.title ? `Черновик «${confirmed.title}» сохранён.` : "Черновик без названия сохранён." });
    setCommandState({ status: "idle" });
    commandInFlightRef.current = false;
    return true;
  }

  async function saveDraftAndLeave() {
    if (!await saveDraft()) return;
    setUnsavedOpen(false);
    setView("templates");
    setDraft(null);
    setSelectedExerciseId(null);
  }

  async function handlePublish(andAssign = false) {
    if (!draft || commandInFlightRef.current) return;
    const result = validateTemplate(draft);
    if (!result.canPublish) {
      setPublishBlockedOpen(true);
      return;
    }
    commandInFlightRef.current = true;
    const commandKind = andAssign ? "publish-and-assign" : "publish";
    setCommandState({ status: "running", kind: commandKind });
    setFeedback(null);
    const published = publishTemplate(draft);
    if (!demoMode) {
      try {
        const confirmed = await publishCanonicalBuilderTemplate(published);
        upsertCanonical(confirmed);
        setDraft(confirmed);
        setBaseline(JSON.stringify(confirmed));
        clearBuilderDraft();
        setFeedback({ tone: "success", message: `Версия ${confirmed.revision} шаблона «${confirmed.title}» опубликована.` });
        setCommandState({ status: "idle" });
        commandInFlightRef.current = false;
        if (andAssign && entry.athleteId) returnToQuickAssign(confirmed);
        else setPublishReceipt({ templateId: confirmed.id, title: confirmed.title, revision: confirmed.revision, athleteId: entry.athleteId });
      } catch {
        setFeedback({ tone: "error", message: "Не удалось опубликовать шаблон." });
        setCommandState({ status: "failed", kind: commandKind });
        commandInFlightRef.current = false;
      }
      return;
    }
    await wait(450);
    const command = runtime.commands.publishWorkoutTemplate({ actor: runtime.actor, template: published, athleteId: entry.athleteId });
    if (!command.ok) {
      setFeedback({ tone: "error", message: command.error.message });
      setCommandState({ status: "failed", kind: commandKind });
      commandInFlightRef.current = false;
      return;
    }
    const confirmed = command.receipt.template;
    setDraft(confirmed);
    setBaseline(JSON.stringify(confirmed));
    clearBuilderDraft();
    setFeedback({ tone: "success", message: `Версия ${confirmed.revision} шаблона «${confirmed.title}» опубликована.` });
    setCommandState({ status: "idle" });
    commandInFlightRef.current = false;
    if (andAssign && entry.athleteId) setAssignAfterPublish(true);
    else setPublishReceipt({ templateId: confirmed.id, title: confirmed.title, revision: confirmed.revision, athleteId: entry.athleteId });
  }

  async function createRevision() {
    if (!draft || draft.status !== "published" || commandInFlightRef.current) return;
    commandInFlightRef.current = true;
    setCommandState({ status: "running", kind: "revision" });
    setFeedback(null);
    if (!demoMode) {
      try {
        const confirmed = await createCanonicalBuilderRevision(draft.id);
        upsertCanonical(confirmed);
        openTemplate(confirmed);
        setCommandState({ status: "idle" });
      } catch {
        setFeedback({ tone: "error", message: "Не удалось создать новую версию." });
        setCommandState({ status: "failed", kind: "revision" });
      } finally {
        commandInFlightRef.current = false;
      }
      return;
    }
    const revision = createDraftRevision(draft);
    await wait(350);
    const result = runtime.commands.createWorkoutTemplateRevision({ actor: runtime.actor, template: revision, athleteId: entry.athleteId });
    if (!result.ok) {
      setFeedback({ tone: "error", message: result.error.message });
      setCommandState({ status: "failed", kind: "revision" });
      commandInFlightRef.current = false;
      return;
    }
    openTemplate(result.receipt.template);
    setCommandState({ status: "idle" });
    commandInFlightRef.current = false;
  }

  function openAssignment(template: WorkoutTemplateDraft) {
    if (!entry.athleteId || template.status !== "published") return;
    if (!demoMode) {
      returnToQuickAssign(template);
      return;
    }
    setDraft(template);
    setBaseline(JSON.stringify(template));
    setQuickAssignOpen(true);
    setPublishReceipt(null);
    setAssignAfterPublish(false);
  }

  function returnToQuickAssign(template: WorkoutTemplateDraft) {
    if (!entry.athleteId || !template.revisionId) {
      setFeedback({ tone: "error", message: "Не удалось подтвердить опубликованную версию шаблона." });
      return;
    }
    const existing = entry.handoffToken
      ? publishQuickAssignBuilderHandoff({
          token: entry.handoffToken,
          athleteUserId: entry.athleteId,
          publishedRevisionId: template.revisionId,
        })
      : null;
    if (entry.handoffToken && !existing) {
      setFeedback({ tone: "error", message: "Контекст назначения истёк. Шаблон опубликован, но вернуться к назначению нужно из профиля спортсмена." });
      return;
    }
    const base = existing ?? createQuickAssignBuilderHandoff({
      athleteUserId: entry.athleteId,
      transitionContext: entry.transitionContext
        ?? encodeTrainerWorkflowContext(createTrainerWorkflowContext({
          origin: "direct",
          athleteUserId: entry.athleteId,
          returnTo: `/trainer/clients/${entry.athleteId}?tab=training`,
          returnAnchor: "next-assignment",
        })),
      query: "",
      scheduledFor: "",
      trainerNote: "",
    });
    const published = existing ?? publishQuickAssignBuilderHandoff({
      token: base.token,
      athleteUserId: entry.athleteId,
      publishedRevisionId: template.revisionId,
    });
    if (!published) {
      setFeedback({ tone: "error", message: "Контекст назначения истёк. Вернитесь к профилю спортсмена и откройте назначение снова." });
      return;
    }
    router.push(quickAssignHrefFromHandoff(published));
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

  const title = view === "templates" ? "Шаблоны тренировок" : draft?.title || "Конструктор тренировок";

  return (
    <TrainerShell eyebrow="Конструктор тренировок" title={title} description="Создавайте и сохраняйте тренировки для повторного назначения.">
      {canonicalLoading ? (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-zinc-500">Загружаем шаблоны…</div>
      ) : view === "templates" ? (
        <TemplatesWorkspace templates={templates} athleteId={entry.athleteId} onCreate={createNew} onOpen={openTemplate} onDuplicate={duplicateAndOpen} onArchive={archiveTemplate} onAssign={openAssignment} />
      ) : view === "unknown" ? (
        <UnknownTemplate templateId={entry.templateId} onTemplates={() => setView("templates")} onCreate={createNew} />
      ) : draft ? (
        <>
          <BuilderEditor draft={draft} libraryExercises={libraryExercises} athleteId={entry.athleteId} dirty={dirty} validation={validation} commandState={commandState} selectedExerciseId={selectedExerciseId} onDraftChange={updateDraft} onSelectedExerciseChange={setSelectedExerciseId} onBack={requestTemplates} onSaveDraft={saveDraft} onPublish={() => handlePublish(false)} onCreateRevision={createRevision} onDuplicateTemplate={() => duplicateAndOpen(draft)} onPreview={() => setPreviewOpen(true)} onAssign={() => openAssignment(draft)} onSaveAndAssign={() => handlePublish(true)} />
          {feedback ? <div role={feedback.tone === "error" ? "alert" : "status"} aria-live="polite" className={feedbackClass(feedback.tone)}>{feedback.message}</div> : null}
        </>
      ) : null}

      <TemplatePreviewDialog draft={draft} open={previewOpen} onOpenChange={setPreviewOpen} />

      <Dialog open={unsavedOpen} onOpenChange={(open) => { if (!commandInFlightRef.current) setUnsavedOpen(open); }}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><DialogTitle>Сохранить изменения?</DialogTitle><DialogDescription className="text-zinc-400">Сохраните черновик перед возвратом к списку шаблонов или выйдите без сохранения.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row sm:flex-wrap"><Button type="button" variant="outline" onClick={() => setUnsavedOpen(false)} disabled={commandState.status === "running"} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Продолжить редактирование</Button><Button type="button" variant="destructive" onClick={leaveWithoutSaving} disabled={commandState.status === "running"} className="min-h-11 rounded-full">Выйти без сохранения</Button><Button type="button" onClick={saveDraftAndLeave} disabled={commandState.status === "running"} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">{commandState.status === "running" && commandState.kind === "save" ? "Сохраняем…" : "Сохранить черновик"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(recoveryDraft)}>
        <DialogContent showCloseButton={false} onEscapeKeyDown={(event) => event.preventDefault()} className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><DialogTitle>Восстановить черновик?</DialogTitle><DialogDescription className="text-zinc-400">В этой вкладке остались несохранённые изменения шаблона «{recoveryDraft?.title || "Без названия"}».</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="destructive" onClick={() => { clearBuilderDraft(); setRecoveryDraft(null); }} className="min-h-11 rounded-full">Не восстанавливать</Button><Button type="button" onClick={() => { if (!recoveryDraft) return; const canonical = templates.find((template) => template.id === recoveryDraft.id); setDraft(recoveryDraft); setBaseline(canonical ? JSON.stringify(canonical) : ""); setSelectedExerciseId(getTemplateExercises(recoveryDraft)[0]?.instanceId ?? null); setView("editor"); setRecoveryDraft(null); setFeedback({ tone: "success", message: "Несохранённый черновик восстановлен." }); }} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Восстановить черновик</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publishBlockedOpen} onOpenChange={setPublishBlockedOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><DialogTitle>Шаблон пока нельзя опубликовать</DialogTitle><DialogDescription className="text-zinc-400">Черновик можно сохранить сейчас. Для публикации исправьте обязательные пункты.</DialogDescription></DialogHeader>
          <div role="alert" className="grid gap-2">{validation.errors.map((issue) => <div key={issue.id} className="rounded-lg border border-orange-300/25 bg-orange-300/[0.06] px-3 py-2 text-sm text-orange-100">{issue.message}</div>)}</div>
          <DialogFooter><Button type="button" onClick={() => setPublishBlockedOpen(false)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Вернуться к исправлениям</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(publishReceipt)} onOpenChange={(open) => !open && setPublishReceipt(null)}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-lg">
          <DialogHeader><div className="flex size-11 items-center justify-center rounded-full border border-lime-300/25 bg-lime-300/10 text-lime-200"><CheckCircle2 className="size-5" /></div><DialogTitle className="pt-3">Шаблон опубликован</DialogTitle><DialogDescription className="text-zinc-400">«{publishReceipt?.title}» готов к назначению. Опубликованный вариант открыт только для чтения.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="outline" onClick={() => setPublishReceipt(null)} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Остаться в конструкторе</Button>{entry.athleteId && draft ? <Button type="button" onClick={() => openAssignment(draft)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Dumbbell className="size-4" />Перейти к назначению</Button> : null}</DialogFooter>
        </DialogContent>
      </Dialog>

      {demoMode ? <QuickAssignDrawer key={`${entry.athleteId ?? "none"}-${assignableTemplate?.id ?? "none"}-${assignableTemplate?.revision ?? 0}`} athleteId={entry.athleteId ?? null} context={{ source: "direct", reason: draft ? `Назначение опубликованного шаблона «${draft.title}».` : "Переход из конструктора тренировок.", returnTo: safeTrainerReturnPath(entry.returnTo) ?? "/trainer/builder" }} initialTemplate={assignableTemplate} open={quickAssignOpen} onOpenChange={setQuickAssignOpen} onAssigned={(receipt) => setFeedback({ tone: "success", message: `${receipt.templateTitle} назначена для ${receipt.athleteName}.` })} /> : null}
    </TrainerShell>
  );
}

function UnknownTemplate({ onTemplates, onCreate }: { templateId?: string; onTemplates: () => void; onCreate: () => void }) {
  return <main className="flex min-h-[74vh] items-center justify-center bg-black px-4 py-10 pb-28 text-zinc-100"><section className="w-full max-w-xl text-center"><AlertTriangle className="mx-auto size-8 text-orange-200" /><h1 className="mt-4 text-2xl font-semibold text-zinc-50">Шаблон не найден</h1><p className="mt-2 text-sm leading-relaxed text-zinc-500">Возможно, шаблон был удалён или ссылка устарела. Выберите другой шаблон или создайте новый.</p><div className="mt-6 flex flex-wrap justify-center gap-2"><Button type="button" onClick={onTemplates} variant="outline" className="min-h-11 rounded-full border-zinc-700 text-zinc-100"><ArrowLeft className="size-4" />К шаблонам</Button><Button type="button" onClick={onCreate} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Plus className="size-4" />Создать новый</Button></div></section></main>;
}

function TemplatePreviewDialog({ draft, open, onOpenChange }: { draft: WorkoutTemplateDraft | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!draft) return null;
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-[calc(100vw-24px)] overflow-y-auto border-zinc-800 bg-zinc-950 sm:max-w-2xl"><DialogHeader><div className="flex items-center gap-2"><TemplateStatusBadge status={draft.status} /><span className="text-xs text-zinc-600">Так тренировку увидит спортсмен</span></div><DialogTitle className="pt-2 text-2xl">{draft.title || "Без названия"}</DialogTitle><DialogDescription className="text-zinc-400">{draft.description || "Описание не добавлено."}</DialogDescription></DialogHeader>{draft.generalInstruction ? <div className="rounded-lg border border-lime-300/20 bg-lime-300/[0.05] p-3 text-sm text-zinc-300">{draft.generalInstruction}</div> : null}<ol className="grid gap-3">{draft.items.map((item, index) => item.kind === "exercise" ? <PreviewExercise key={item.id} index={`${index + 1}`} exercise={item.exercise} /> : <li key={item.id} className="rounded-lg border border-lime-300/25 bg-lime-300/[0.04] p-3"><p className="text-xs font-medium uppercase text-lime-200/70">Суперсет · {item.label}</p><p className="mt-1 text-sm text-zinc-500">{item.instruction}</p><ol className="mt-3 grid gap-2">{item.exercises.map((exercise, exerciseIndex) => <PreviewExercise key={exercise.instanceId} index={`A${exerciseIndex + 1}`} exercise={exercise} compact />)}</ol></li>)}</ol><DialogFooter><Button type="button" onClick={() => onOpenChange(false)} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Закрыть предпросмотр</Button></DialogFooter></DialogContent></Dialog>;
}

function PreviewExercise({ index, exercise, compact }: { index: string; exercise: ReturnType<typeof getTemplateExercises>[number]; compact?: boolean }) {
  return <li className="rounded-lg border border-zinc-800 bg-black/20 p-3"><div className="flex items-start gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-xs text-zinc-400">{index}</span><div className="min-w-0"><h3 className="font-medium text-zinc-100">{exercise.title}</h3><p className="mt-1 text-sm text-zinc-500">{exercise.prescription.type === "duration" ? `${exercise.prescription.sets} × ${exercise.prescription.durationSec} сек` : `${exercise.prescription.sets} × ${exercise.prescription.repetitionsMin}${exercise.prescription.repetitionMode === "range" ? `–${exercise.prescription.repetitionsMax}` : ""} повт.`}{exercise.prescription.restSec ? ` · отдых ${exercise.prescription.restSec} сек` : ""}</p>{exercise.perSetMode && !compact ? <p className="mt-1 text-xs text-zinc-600">{exercise.setOverrides.map((set) => `${set.kind === "warmup" ? "Разминка" : "Рабочий"} #${set.order}`).join(" · ")}</p> : null}{exercise.trainerNote ? <p className="mt-2 text-sm text-zinc-300">{exercise.trainerNote}</p> : null}</div></div></li>;
}

function feedbackClass(tone: BuilderFeedback["tone"]) {
  return tone === "error"
    ? "fixed bottom-24 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg border border-rose-300/25 bg-zinc-950 px-4 py-3 text-sm text-rose-100 shadow-2xl lg:bottom-6"
    : "fixed bottom-24 left-1/2 z-40 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-lg border border-lime-300/25 bg-zinc-950 px-4 py-3 text-sm text-lime-100 shadow-2xl lg:bottom-6";
}

function wait(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
