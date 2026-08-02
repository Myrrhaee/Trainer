"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Dumbbell,
  ExternalLink,
  FileEdit,
  Loader2,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { getQuickAssignView } from "@/components/trainer-os/demo-runtime/selectors";
import { TrainerClientPreviewLink } from "@/components/trainer-os/demo-runtime/trainer-client-preview-link";
import { useTrainerDemoRuntime } from "@/components/trainer-os/demo-runtime/trainer-demo-runtime";
import type { RuntimeWorkoutAssignment } from "@/components/trainer-os/demo-runtime/types";
import { cn } from "@/lib/utils";

import {
  createAssignmentReceipt,
  getBuilderHref,
  isTemplateSuitable,
  type AssignmentReceipt,
  type ExerciseAssignmentOverride,
  type QuickAssignEntryContext,
  type QuickAssignView,
  type TemplateGroup,
  type WorkoutAssignmentDraft,
  type WorkoutTemplateExercise,
  type WorkoutTemplateListItem,
} from "./quick-assign-model";

type QuickAssignDrawerProps = {
  athleteId: string | null;
  context?: QuickAssignEntryContext;
  initialTemplate?: WorkoutTemplateListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned?: (receipt: AssignmentReceipt) => void;
  onNextAthlete?: (receipt: AssignmentReceipt) => void;
  onOpenAssignment?: (receipt: AssignmentReceipt) => void;
};

const defaultContext: QuickAssignEntryContext = { source: "direct" };
const groupLabels: Record<TemplateGroup, string> = {
  suitable: "Подходящие",
  recent: "Недавние",
  all: "Все шаблоны",
};

export function QuickAssignDrawer({
  athleteId,
  context = defaultContext,
  initialTemplate,
  open,
  onOpenChange,
  onAssigned,
  onNextAthlete,
  onOpenAssignment,
}: QuickAssignDrawerProps) {
  const router = useRouter();
  const runtime = useTrainerDemoRuntime();
  const [today] = useState(() => toLocalIsoDate(new Date()));
  const defaultDate = useMemo(() => addDays(today, 1), [today]);
  const view = useMemo(() => {
    const baseView = getQuickAssignView(runtime.state, athleteId, context);
    if (!baseView || !initialTemplate) return baseView;
    const templates = baseView.templates.some((template) => template.id === initialTemplate.id)
      ? baseView.templates.map((template) => template.id === initialTemplate.id ? initialTemplate : template)
      : [initialTemplate, ...baseView.templates];
    return { ...baseView, templates };
  }, [athleteId, context, initialTemplate, runtime.state]);
  const [draft, setDraft] = useState<WorkoutAssignmentDraft>(() => ({
    ...emptyDraft(athleteId, defaultDate),
    templateId: initialTemplate?.id ?? null,
  }));
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<TemplateGroup>(() => initialTemplate ? "all" : "suitable");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [adjustingExerciseIds, setAdjustingExerciseIds] = useState<Set<string>>(() => new Set());
  const [receipt, setReceipt] = useState<AssignmentReceipt | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [pendingBuilderHref, setPendingBuilderHref] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "failed">("idle");
  const [wasAlreadyAssigned, setWasAlreadyAssigned] = useState(false);
  const submitInFlightRef = useRef(false);

  useEffect(() => {
    if (!open || !athleteId) return;
    runtime.commands.recordPilotEvent({
      name: "quick_assign_opened",
      athleteId,
      attentionItemId: context.attentionItemId,
      workoutSessionId: context.reviewSessionId,
    });
  }, [athleteId, context.attentionItemId, context.reviewSessionId, open, runtime.commands]);

  function resetSession() {
    setDraft({ ...emptyDraft(athleteId, defaultDate), templateId: initialTemplate?.id ?? null });
    setQuery("");
    setGroup(initialTemplate ? "all" : "suitable");
    setDetailsOpen(false);
    setAdjustingExerciseIds(new Set());
    setReceipt(null);
    setDiscardOpen(false);
    setPendingBuilderHref(null);
    setCommandError(null);
    setSubmitStatus("idle");
    setWasAlreadyAssigned(false);
    submitInFlightRef.current = false;
  }

  const selectedTemplate = view?.templates.find((template) => template.id === draft.templateId) ?? null;
  const filteredTemplates = useMemo(() => {
    if (!view) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("ru");
    return view.templates.filter((template) => {
      const inGroup =
        group === "all" ||
        (group === "recent" && template.recent) ||
        (group === "suitable" && isTemplateSuitable(template, view.athlete));
      if (!inGroup) return false;
      if (!normalizedQuery) return true;
      return [template.title, template.description, template.category, ...template.focus]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(normalizedQuery);
    });
  }, [group, query, view]);

  const isDirty = Boolean(
    draft.templateId ||
      draft.scheduledDate !== defaultDate ||
      draft.trainerNote.trim() ||
      draft.generalInstruction.trim() ||
      Object.keys(draft.exerciseOverrides).length
  );
  const dateError = !draft.scheduledDate
    ? "Выберите дату тренировки."
    : draft.scheduledDate < today
      ? "Нельзя назначить тренировку в прошлом."
      : null;
  const exactAssignment = view?.recentAssignments.find(
    (assignment) => assignment.scheduledDate === draft.scheduledDate && assignment.templateId === draft.templateId
  );
  const conflictingAssignment = view?.recentAssignments.find(
    (assignment) => assignment.scheduledDate === draft.scheduledDate && assignment.id !== exactAssignment?.id
  );
  const submitDisabledReason = getSubmitDisabledReason(
    view,
    selectedTemplate,
    dateError,
    Boolean(exactAssignment),
    Boolean(conflictingAssignment),
    draft.conflictAccepted
  );
  const isSubmitting = submitStatus === "submitting";

  function requestClose() {
    if (submitInFlightRef.current) return;
    if (receipt || !isDirty) {
      resetSession();
      onOpenChange(false);
      return;
    }
    setPendingBuilderHref(null);
    setDiscardOpen(true);
  }

  function selectTemplate(template: WorkoutTemplateListItem) {
    if (template.state !== "published") return;
    setDraft((current) => ({
      ...current,
      templateId: template.id,
      exerciseOverrides: {},
      conflictAccepted: false,
    }));
    setDetailsOpen(false);
    setAdjustingExerciseIds(new Set());
  }

  function updateOverride(exercise: WorkoutTemplateExercise, patch: ExerciseAssignmentOverride) {
    setDraft((current) => ({
      ...current,
      exerciseOverrides: {
        ...current.exerciseOverrides,
        [exercise.id]: { ...current.exerciseOverrides[exercise.id], ...patch },
      },
    }));
  }

  async function submitAssignment() {
    if (!view || !selectedTemplate || submitDisabledReason || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitStatus("submitting");
    setCommandError(null);
    const nextReceipt = createAssignmentReceipt(view, draft, selectedTemplate);
    await wait(350);
    const result = runtime.commands.createWorkoutAssignment({ actor: runtime.actor, receipt: nextReceipt });
    if (!result.ok) {
      setCommandError(result.error.message);
      setSubmitStatus("failed");
      submitInFlightRef.current = false;
      return;
    }
    const confirmedReceipt = assignmentToReceipt(result.receipt.assignment, view.athlete.displayName);
    setWasAlreadyAssigned(result.receipt.alreadyApplied);
    setReceipt(confirmedReceipt);
    setSubmitStatus("idle");
    submitInFlightRef.current = false;
    onAssigned?.(confirmedReceipt);
  }

  function openBuilder(href: string) {
    if (isDirty) {
      setPendingBuilderHref(href);
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
    router.push(href);
  }

  function discardChanges() {
    const href = pendingBuilderHref;
    resetSession();
    onOpenChange(false);
    if (href) router.push(href);
  }

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) onOpenChange(true);
          else requestClose();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) {
              event.preventDefault();
              return;
            }
            if (isDirty && !receipt) {
              event.preventDefault();
              setDiscardOpen(true);
            }
          }}
          className="!w-[calc(100vw-12px)] !max-w-[920px] gap-0 overflow-hidden border-zinc-800 bg-[#070707] p-0 text-zinc-100 sm:!w-[min(92vw,920px)] sm:!max-w-[920px]"
        >
          <SheetHeader className="shrink-0 border-b border-zinc-800/80 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3 pr-1">
              <div className="min-w-0">
                <SheetTitle className="text-lg font-semibold text-zinc-50 sm:text-xl">Быстрое назначение</SheetTitle>
                <SheetDescription className="mt-1 text-zinc-500">
                  Одна тренировка из сохранённого шаблона.
                </SheetDescription>
              </div>
              <Button
                type="button"
                size="icon-lg"
                variant="ghost"
                onClick={requestClose}
                disabled={isSubmitting}
                aria-label="Закрыть быстрое назначение"
                className="shrink-0 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <X className="size-5" />
              </Button>
            </div>
          </SheetHeader>

          {receipt && view ? (
            <AssignmentConfirmation
              receipt={receipt}
              view={view}
              wasAlreadyAssigned={wasAlreadyAssigned}
              onClose={() => {
                resetSession();
                onOpenChange(false);
              }}
              onNext={onNextAthlete ? () => onNextAthlete(receipt) : undefined}
              onOpenAssignment={onOpenAssignment ? () => {
                resetSession();
                onOpenAssignment(receipt);
              } : undefined}
            />
          ) : view ? (
            <>
              <div aria-busy={isSubmitting} className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 transition-opacity sm:px-5 sm:py-5", isSubmitting && "pointer-events-none opacity-70")}>
                <div className="mx-auto grid w-full min-w-0 max-w-[860px] gap-5">
                  <AthleteContext view={view} />

                  {!view.constraints.assignmentAllowed ? (
                    <PausedAthleteState view={view} />
                  ) : (
                    <>
                      <TemplateSelection
                        view={view}
                        templates={filteredTemplates}
                        query={query}
                        group={group}
                        selectedTemplateId={draft.templateId}
                        onQueryChange={setQuery}
                        onGroupChange={setGroup}
                        onSelect={selectTemplate}
                        onClear={() => {
                          setQuery("");
                          setGroup("all");
                        }}
                        onOpenBuilder={openBuilder}
                      />

                      {selectedTemplate ? (
                        <SelectedTemplate
                          template={selectedTemplate}
                          draft={draft}
                          detailsOpen={detailsOpen}
                          adjustingExerciseIds={adjustingExerciseIds}
                          onDetailsOpenChange={setDetailsOpen}
                          onToggleExercise={(exerciseId) =>
                            setAdjustingExerciseIds((current) => {
                              const next = new Set(current);
                              if (next.has(exerciseId)) next.delete(exerciseId);
                              else next.add(exerciseId);
                              return next;
                            })
                          }
                          onOverride={updateOverride}
                          onResetOverrides={() =>
                            setDraft((current) => ({ ...current, exerciseOverrides: {} }))
                          }
                          onOpenBuilder={() => openBuilder(getBuilderHref(view, selectedTemplate.id))}
                        />
                      ) : null}

                      <AssignmentSchedule
                        today={today}
                        draft={draft}
                        dateError={dateError}
                        exactAssignment={exactAssignment}
                        conflictingAssignment={conflictingAssignment}
                        onChange={setDraft}
                      />

                      {selectedTemplate ? (
                        <AssignmentPreview view={view} template={selectedTemplate} draft={draft} />
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <SheetFooter className="shrink-0 border-t border-zinc-800/80 bg-zinc-950/96 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:px-5">
                {view.constraints.assignmentAllowed ? (
                  <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p id="quick-assign-disabled-reason" aria-live="polite" className="text-xs text-zinc-500">
                      {isSubmitting
                        ? `Назначаем ${selectedTemplate?.title ?? "тренировку"} для ${view.athlete.displayName}…`
                        : commandError ?? submitDisabledReason ?? (selectedTemplate
                          ? `${selectedTemplate.title} · ${formatDate(draft.scheduledDate)} · ${view.athlete.displayName}`
                          : "Выберите шаблон и дату.")}
                    </p>
                    <Button
                      type="button"
                      onClick={submitAssignment}
                      disabled={Boolean(submitDisabledReason) || isSubmitting}
                      aria-busy={isSubmitting}
                      aria-describedby="quick-assign-disabled-reason"
                      className="min-h-11 w-full shrink-0 rounded-full bg-lime-300 px-5 text-black hover:bg-lime-200 sm:w-auto"
                    >
                      {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                      {isSubmitting ? "Назначаем…" : submitStatus === "failed" ? "Повторить назначение" : "Назначить тренировку"}
                    </Button>
                  </div>
                ) : null}
              </SheetFooter>
            </>
          ) : (
            <UnknownAthleteState athleteId={athleteId} onClose={() => {
              resetSession();
              onOpenChange(false);
            }} />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Отказаться от изменений?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Выбранный шаблон, дата и индивидуальные настройки не сохранятся.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">
              Продолжить редактирование
            </Button>
            <Button type="button" variant="destructive" onClick={discardChanges} className="min-h-11 rounded-full">
              Отказаться
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AthleteContext({ view }: { view: QuickAssignView }) {
  return (
    <section className="w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/74 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar className="size-12 shrink-0 border border-zinc-800 bg-zinc-950">
          <AvatarFallback className="bg-zinc-900 text-sm font-semibold text-zinc-100">{view.athlete.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-zinc-50">{view.athlete.displayName}</h2>
            <span className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-300">{view.athlete.status}</span>
          </div>
          {view.athlete.goal ? <p className="mt-1 truncate text-sm text-zinc-500">{view.athlete.goal}</p> : null}
        </div>
        <Button asChild size="icon-lg" variant="ghost" className="shrink-0 rounded-full text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100">
          <Link href={`/trainer/clients/${view.athlete.id}`} aria-label={`Открыть профиль ${view.athlete.displayName}`}>
            <UserRound className="size-5" />
          </Link>
        </Button>
      </div>
      <div className="mt-3 rounded-lg border border-lime-300/15 bg-lime-300/[0.055] px-3 py-2.5">
        <p className="text-xs font-medium uppercase text-lime-200/70">{sourceLabel(view.context.source)}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-300">{view.context.reason ?? defaultReason(view)}</p>
      </div>
    </section>
  );
}

function TemplateSelection({
  view,
  templates,
  query,
  group,
  selectedTemplateId,
  onQueryChange,
  onGroupChange,
  onSelect,
  onClear,
  onOpenBuilder,
}: {
  view: QuickAssignView;
  templates: WorkoutTemplateListItem[];
  query: string;
  group: TemplateGroup;
  selectedTemplateId: string | null;
  onQueryChange: (value: string) => void;
  onGroupChange: (value: TemplateGroup) => void;
  onSelect: (template: WorkoutTemplateListItem) => void;
  onClear: () => void;
  onOpenBuilder: (href: string) => void;
}) {
  if (view.templates.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/70 p-6 text-center">
        <Dumbbell className="mx-auto size-6 text-zinc-500" />
        <h3 className="mt-3 text-lg font-semibold text-zinc-50">Сохранённых шаблонов пока нет</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
          Чтобы назначить тренировку, сначала создайте и опубликуйте шаблон.
        </p>
        <Button type="button" onClick={() => onOpenBuilder(getBuilderHref(view))} className="mt-4 min-h-11 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">
          <FileEdit className="size-4" />Создать шаблон
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby="quick-assign-templates-heading" className="grid w-full min-w-0 gap-3">
      <div>
        <h3 id="quick-assign-templates-heading" className="text-base font-semibold text-zinc-100">Выберите шаблон</h3>
        <p className="mt-1 text-sm text-zinc-500">Назначить можно только опубликованный шаблон.</p>
      </div>
      <div className="relative min-w-0">
        <Label htmlFor="quick-assign-template-search" className="sr-only">Поиск шаблона</Label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
        <Input
          id="quick-assign-template-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по названию, цели или категории"
          className="h-11 w-full min-w-0 border-zinc-800 bg-black/30 pl-10 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      <div role="tablist" aria-label="Группы шаблонов" className="flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(groupLabels) as TemplateGroup[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={group === value}
            onClick={() => onGroupChange(value)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60",
              group === value
                ? "border-lime-300/35 bg-lime-300/10 text-lime-100"
                : "border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100"
            )}
          >
            {groupLabels[value]}
          </button>
        ))}
      </div>
      {templates.length ? (
        <div role="listbox" aria-label="Шаблоны тренировок" className="grid min-w-0 gap-2 sm:grid-cols-2">
          {templates.map((template) => {
            const selected = template.id === selectedTemplateId;
            const unavailable = template.state !== "published";
            return (
              <button
                key={template.id}
                type="button"
                role="option"
                aria-selected={selected}
                aria-disabled={unavailable}
                disabled={unavailable}
                onClick={() => onSelect(template)}
                className={cn(
                  "min-h-[118px] w-full min-w-0 overflow-hidden rounded-lg border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60 disabled:cursor-not-allowed disabled:opacity-55",
                  selected
                    ? "border-lime-300/45 bg-lime-300/[0.07]"
                    : "border-zinc-800 bg-zinc-950/72 hover:border-zinc-700 hover:bg-zinc-900/60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-50">{template.title}</span>
                      {selected ? <Check className="size-4 text-lime-300" aria-label="Выбрано" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{template.description}</p>
                  </div>
                  <TemplateStateBadge state={template.state} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span>{template.exercises.length} упр.</span>
                  <span>{template.durationMin} мин</span>
                  <span>{template.category}</span>
                  {template.recent ? <span className="text-lime-200/80">Недавнее</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div role="status" className="rounded-lg border border-dashed border-zinc-700 bg-zinc-950/60 p-5 text-center">
          <p className="font-medium text-zinc-200">Шаблоны не найдены</p>
          <p className="mt-1 text-sm text-zinc-500">Сбросьте поиск или создайте новый шаблон.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button type="button" variant="outline" onClick={onClear} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Сбросить фильтры</Button>
            <Button type="button" variant="ghost" onClick={() => onOpenBuilder(getBuilderHref(view))} className="min-h-11 rounded-full text-zinc-300">Создать шаблон</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function SelectedTemplate({
  template,
  draft,
  detailsOpen,
  adjustingExerciseIds,
  onDetailsOpenChange,
  onToggleExercise,
  onOverride,
  onResetOverrides,
  onOpenBuilder,
}: {
  template: WorkoutTemplateListItem;
  draft: WorkoutAssignmentDraft;
  detailsOpen: boolean;
  adjustingExerciseIds: Set<string>;
  onDetailsOpenChange: (open: boolean) => void;
  onToggleExercise: (exerciseId: string) => void;
  onOverride: (exercise: WorkoutTemplateExercise, patch: ExerciseAssignmentOverride) => void;
  onResetOverrides: () => void;
  onOpenBuilder: () => void;
}) {
  const overrideCount = Object.keys(draft.exerciseOverrides).length;
  return (
    <section className="w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/72 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-lime-200/70">Выбранный шаблон</p>
          <h3 className="mt-1 text-xl font-semibold text-zinc-50">{template.title}</h3>
          <p className="mt-1 text-sm text-zinc-500">{template.focus.join(" · ")} · {template.durationMin} мин · {template.exercises.length} упражнений</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">{template.instruction}</p>
        </div>
        <Button type="button" variant="outline" onClick={onOpenBuilder} className="min-h-11 shrink-0 rounded-full border-zinc-700 text-zinc-200">
          <ExternalLink className="size-4" />Открыть шаблон
        </Button>
      </div>
      <button
        type="button"
        aria-expanded={detailsOpen}
        onClick={() => onDetailsOpenChange(!detailsOpen)}
        className="mt-4 flex min-h-11 w-full items-center justify-between rounded-lg border border-zinc-800 px-3 text-left text-sm text-zinc-200 hover:bg-zinc-900/60"
      >
        <span>Посмотреть состав{template.hasSupersets ? " · есть суперсет" : ""}</span>
        <ChevronDown className={cn("size-4 transition-transform", detailsOpen && "rotate-180")} />
      </button>
      {detailsOpen ? (
        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase text-zinc-500">Изменения только для этого назначения</p>
            {overrideCount ? (
              <Button type="button" size="sm" variant="ghost" onClick={onResetOverrides} className="min-h-9 rounded-full text-zinc-400">
                <RotateCcw className="size-3.5" />Вернуть параметры шаблона
              </Button>
            ) : null}
          </div>
          {template.exercises.map((exercise) => {
            const override = draft.exerciseOverrides[exercise.id];
            const adjusting = adjustingExerciseIds.has(exercise.id);
            return (
              <div key={exercise.id} className="rounded-lg border border-zinc-800 bg-black/25 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-100">{exercise.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {override?.sets ?? exercise.sets} × {override?.repetitions ?? exercise.repetitions}
                      {exercise.targetWeightKg ? ` · ${override?.targetWeightKg ?? exercise.targetWeightKg} кг` : ""}
                      {override ? " · изменено" : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" aria-expanded={adjusting} onClick={() => onToggleExercise(exercise.id)} className="min-h-9 rounded-full border-zinc-700 text-zinc-300">
                    Настроить
                  </Button>
                </div>
                {adjusting ? (
                  <div className="mt-3 grid gap-3 border-t border-zinc-800 pt-3 sm:grid-cols-3">
                    <NumberField label="Подходы" value={override?.sets ?? exercise.sets} min={1} max={12} onChange={(value) => onOverride(exercise, { sets: value })} />
                    <NumberField label="Повторения" value={override?.repetitions ?? exercise.repetitions} min={1} max={50} onChange={(value) => onOverride(exercise, { repetitions: value })} />
                    {exercise.targetWeightKg ? (
                      <NumberField label="Целевой вес, кг" value={override?.targetWeightKg ?? exercise.targetWeightKg} min={0} max={500} step={0.5} onChange={(value) => onOverride(exercise, { targetWeightKg: value })} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function AssignmentSchedule({
  today,
  draft,
  dateError,
  exactAssignment,
  conflictingAssignment,
  onChange,
}: {
  today: string;
  draft: WorkoutAssignmentDraft;
  dateError: string | null;
  exactAssignment?: { title: string };
  conflictingAssignment?: { title: string };
  onChange: (value: WorkoutAssignmentDraft | ((current: WorkoutAssignmentDraft) => WorkoutAssignmentDraft)) => void;
}) {
  return (
    <section className="w-full min-w-0 rounded-lg border border-zinc-800 bg-zinc-950/72 p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-4 text-lime-300" />
        <h3 className="font-semibold text-zinc-100">Дата и инструкция</h3>
      </div>
      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor="quick-assign-date" className="text-sm text-zinc-300">Дата тренировки</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              aria-pressed={draft.scheduledDate === today}
              onClick={() => onChange((current) => ({ ...current, scheduledDate: today, conflictAccepted: false }))}
              className={cn("min-h-11 flex-1 rounded-full text-zinc-200", draft.scheduledDate === today ? "border-lime-300/40 bg-lime-300/10 text-lime-100" : "border-zinc-700")}
            >
              Сегодня
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={draft.scheduledDate === addDays(today, 1)}
              onClick={() => onChange((current) => ({ ...current, scheduledDate: addDays(today, 1), conflictAccepted: false }))}
              className={cn("min-h-11 flex-1 rounded-full text-zinc-200", draft.scheduledDate === addDays(today, 1) ? "border-lime-300/40 bg-lime-300/10 text-lime-100" : "border-zinc-700")}
            >
              Завтра
            </Button>
          </div>
          <Input
            id="quick-assign-date"
            type="date"
            min={today}
            value={draft.scheduledDate}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? "quick-assign-date-error" : undefined}
            onChange={(event) => onChange((current) => ({ ...current, scheduledDate: event.target.value, conflictAccepted: false }))}
            className="h-11 border-zinc-800 bg-black/30 text-zinc-100 [color-scheme:dark]"
          />
          {dateError ? <p id="quick-assign-date-error" role="alert" className="text-xs text-orange-200">{dateError}</p> : null}
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="quick-assign-instruction" className="text-sm text-zinc-300">Общая инструкция</Label>
            <Input id="quick-assign-instruction" value={draft.generalInstruction} onChange={(event) => onChange((current) => ({ ...current, generalInstruction: event.target.value }))} placeholder="Например: держать RPE до 7" className="h-11 border-zinc-800 bg-black/30 text-zinc-100" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="quick-assign-note" className="text-sm text-zinc-300">Заметка тренера</Label>
            <Textarea id="quick-assign-note" value={draft.trainerNote} onChange={(event) => onChange((current) => ({ ...current, trainerNote: event.target.value }))} placeholder="Необязательный комментарий спортсмену" className="min-h-20 resize-y border-zinc-800 bg-black/30 text-zinc-100" />
          </div>
        </div>
      </div>
      {exactAssignment ? (
        <div role="alert" className="mt-4 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-lime-200" />
            <div>
              <p className="text-sm font-medium text-lime-100">{exactAssignment.title} уже назначена на эту дату</p>
              <p className="mt-1 text-xs leading-relaxed text-lime-100/70">Повторная копия не будет создана. Выберите другой шаблон или дату.</p>
            </div>
          </div>
        </div>
      ) : conflictingAssignment ? (
        <div role="alert" className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/[0.07] p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-200" />
            <div>
              <p className="text-sm font-medium text-amber-100">На эту дату уже назначено: {conflictingAssignment.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/70">Можно выбрать другую дату или явно подтвердить вторую тренировку.</p>
            </div>
          </div>
          <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-amber-300/20 px-3 text-sm text-zinc-200">
            <input type="checkbox" checked={draft.conflictAccepted} onChange={(event) => onChange((current) => ({ ...current, conflictAccepted: event.target.checked }))} className="size-4 accent-lime-300" />
            Всё равно назначить на эту дату
          </label>
        </div>
      ) : null}
    </section>
  );
}

function AssignmentPreview({ view, template, draft }: { view: QuickAssignView; template: WorkoutTemplateListItem; draft: WorkoutAssignmentDraft }) {
  const overrideCount = Object.keys(draft.exerciseOverrides).length;
  return (
    <section aria-labelledby="quick-assign-preview-heading" className="w-full min-w-0 rounded-lg border border-lime-300/20 bg-lime-300/[0.045] p-4">
      <p className="text-xs font-medium uppercase text-lime-200/70">Предпросмотр назначения</p>
      <h3 id="quick-assign-preview-heading" className="mt-1 text-lg font-semibold text-zinc-50">{template.title} для {view.athlete.displayName}</h3>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <PreviewRow label="Дата" value={draft.scheduledDate ? formatDate(draft.scheduledDate) : "Не выбрана"} />
        <PreviewRow label="Состав" value={`${template.exercises.length} упражнений · ${template.durationMin} мин`} />
        <PreviewRow label="Индивидуальные изменения" value={overrideCount ? `${overrideCount} упражн.` : "Нет"} />
        <PreviewRow label="Источник" value={sourceLabel(view.context.source)} />
      </div>
      {draft.trainerNote.trim() ? <p className="mt-3 text-sm text-zinc-300"><span className="text-zinc-500">Заметка:</span> {draft.trainerNote.trim()}</p> : null}
    </section>
  );
}

function AssignmentConfirmation({
  receipt,
  view,
  wasAlreadyAssigned,
  onClose,
  onNext,
  onOpenAssignment,
}: {
  receipt: AssignmentReceipt;
  view: QuickAssignView;
  wasAlreadyAssigned: boolean;
  onClose: () => void;
  onNext?: () => void;
  onOpenAssignment?: () => void;
}) {
  return (
    <div role="status" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-full max-w-xl flex-col justify-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-lime-300/30 bg-lime-300/10 text-lime-200">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="mt-5 text-xs font-medium uppercase text-lime-200/70">{wasAlreadyAssigned ? "Уже было назначено" : "Назначено"}</p>
        <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{receipt.templateTitle}</h2>
        <p className="mt-2 text-base text-zinc-300">{receipt.athleteName} · {formatDate(receipt.scheduledDate)}</p>
        <div className="mt-5 grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950/74 p-4 text-sm">
          <PreviewRow label="Упражнений" value={String(receipt.snapshotExercises.length)} />
          <PreviewRow label="Индивидуальных изменений" value={String(receipt.overrideCount)} />
          {wasAlreadyAssigned ? <PreviewRow label="Дубликат" value="Не создан" /> : null}
          <PreviewRow label="Что дальше" value="Тренировка уже доступна в профиле спортсмена и на главной." />
        </div>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {onNext && (view.context.source === "dashboard" || view.context.source === "review") ? (
            <Button type="button" onClick={onNext} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">
              Следующий клиент<ArrowRight className="size-4" />
            </Button>
          ) : null}
          {view.context.source === "profile" && onOpenAssignment ? (
            <Button type="button" onClick={onOpenAssignment} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200">Открыть тренировку</Button>
          ) : null}
          <Button type="button" variant="outline" onClick={onClose} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">
            {closeLabel(view.context.source)}
          </Button>
          <Button asChild type="button" variant="ghost" className="min-h-11 rounded-full text-zinc-300">
            <Link href={`/trainer/clients/${view.athlete.id}`}>Открыть профиль</Link>
          </Button>
          <Button asChild type="button" variant="ghost" className="min-h-11 rounded-full text-zinc-300">
            <TrainerClientPreviewLink athleteId={view.athlete.id}>
              <ExternalLink className="size-4" />Открыть вид клиента
            </TrainerClientPreviewLink>
          </Button>
          {(view.context.source === "profile" || view.context.source === "review" || view.context.source === "direct") ? (
            <Button asChild type="button" variant="ghost" className="min-h-11 rounded-full text-zinc-400">
              <Link href="/trainer/dashboard">На главную</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PausedAthleteState({ view }: { view: QuickAssignView }) {
  return (
    <section className="rounded-lg border border-amber-300/25 bg-amber-300/[0.06] p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-200" />
        <div>
          <h3 className="font-semibold text-amber-100">Назначение недоступно</h3>
          <p className="mt-1 text-sm leading-relaxed text-amber-100/70">{view.constraints.reason}</p>
        </div>
      </div>
      <Button asChild variant="outline" className="mt-4 min-h-11 rounded-full border-amber-200/25 text-zinc-100">
        <Link href={`/trainer/clients/${view.athlete.id}`}><UserRound className="size-4" />Открыть профиль</Link>
      </Button>
    </section>
  );
}

function UnknownAthleteState({ athleteId, onClose }: { athleteId: string | null; onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-6">
      <section className="max-w-md text-center">
        <AlertTriangle className="mx-auto size-7 text-orange-200" />
        <h2 className="mt-4 text-xl font-semibold text-zinc-50">Спортсмен не найден</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          {athleteId ? "Проверьте спортсмена и повторите попытку. Данные другого человека не будут показаны." : "Сначала выберите спортсмена, которому нужна тренировка."}
        </p>
        <Button type="button" onClick={onClose} variant="outline" className="mt-5 min-h-11 rounded-full border-zinc-700 text-zinc-100">Закрыть</Button>
      </section>
    </div>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-zinc-500">{label}</Label>
      <Input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="h-11 border-zinc-800 bg-zinc-950 text-zinc-100" />
    </div>
  );
}

function TemplateStateBadge({ state }: { state: WorkoutTemplateListItem["state"] }) {
  const label = state === "published" ? "Опубликован" : state === "draft" ? "Черновик" : "Архив";
  return <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[11px]", state === "published" ? "border-lime-300/20 text-lime-100" : "border-zinc-700 text-zinc-500")}>{label}</span>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 rounded-lg border border-zinc-800/80 bg-black/20 px-3 py-2"><span className="text-zinc-500">{label}</span><span className="text-right font-medium text-zinc-200">{value}</span></div>;
}

function emptyDraft(athleteId: string | null, scheduledDate: string): WorkoutAssignmentDraft {
  return { athleteId: athleteId ?? "", templateId: null, scheduledDate, trainerNote: "", generalInstruction: "", exerciseOverrides: {}, conflictAccepted: false };
}

function getSubmitDisabledReason(view: QuickAssignView | null, template: WorkoutTemplateListItem | null, dateError: string | null, hasExactAssignment: boolean, hasConflict: boolean, conflictAccepted: boolean) {
  if (!view) return "Спортсмен не найден.";
  if (!view.constraints.assignmentAllowed) return view.constraints.reason ?? "Назначение недоступно.";
  if (!template) return "Сначала выберите опубликованный шаблон.";
  if (template.state !== "published") return "Черновики и архивные шаблоны назначать нельзя.";
  if (dateError) return dateError;
  if (hasExactAssignment) return "Этот шаблон уже назначен спортсмену на выбранную дату.";
  if (hasConflict && !conflictAccepted) return "Подтвердите конфликт даты или выберите другую дату.";
  return null;
}

function sourceLabel(source: QuickAssignEntryContext["source"]) {
  if (source === "dashboard") return "Из очереди внимания";
  if (source === "profile") return "Из профиля спортсмена";
  if (source === "review") return "Следующий шаг после разбора";
  if (source === "clients") return "Из списка клиентов";
  return "Быстрое назначение";
}

function defaultReason(view: QuickAssignView) {
  if (view.athlete.state === "needs_assignment") return "Следующая тренировка ещё не назначена.";
  if (view.athlete.state === "after_review") return "Разбор завершён; новое назначение остаётся необязательным следующим шагом.";
  if (view.athlete.state === "paused") return "Ведение спортсмена приостановлено.";
  return "Плановое назначение для спортсмена, который сейчас идёт по плану.";
}

function closeLabel(source: QuickAssignEntryContext["source"]) {
  if (source === "dashboard") return "Вернуться к очереди";
  if (source === "profile") return "Остаться в профиле";
  if (source === "review") return "Вернуться к разбору";
  if (source === "clients") return "Вернуться к клиентам";
  return "Закрыть";
}

function toLocalIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, offset: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + offset);
  return toLocalIsoDate(date);
}

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(year, month - 1, day));
}

function assignmentToReceipt(assignment: RuntimeWorkoutAssignment, athleteName: string): AssignmentReceipt {
  return {
    id: assignment.id,
    athleteId: assignment.athleteId,
    athleteName,
    templateId: assignment.sourceTemplateId,
    templateTitle: assignment.templateTitle,
    scheduledDate: assignment.scheduledDate,
    sourceTemplateRevision: assignment.sourceTemplateRevision,
    snapshotExercises: assignment.snapshotExercises,
    overrideCount: assignment.overrideCount,
    trainerNote: assignment.trainerNote,
    generalInstruction: assignment.generalInstruction,
    createdContext: assignment.createdContext,
  };
}

function wait(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
