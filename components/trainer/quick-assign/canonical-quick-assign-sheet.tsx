"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { QuickAssignReadModel, QuickAssignSelectedTemplate } from "@/lib/server/quick-assign/quick-assign-types";
import { QuickAssignAssignmentForm } from "./quick-assign-assignment-form";
import {
  loadQuickAssignModel,
  QuickAssignHttpError,
  submitQuickAssignment,
  type QuickAssignPersistedResponse,
} from "./quick-assign-client";
import { QuickAssignSelectedPreview } from "./quick-assign-preview";
import { quickAssignHeaderSummary } from "./quick-assign-presentation";
import { consumeQuickAssignProfileTrigger } from "./quick-assign-profile-trigger";
import { QuickAssignCompletionReceipt } from "./quick-assign-receipt";
import {
  buildStrictAssignmentPayload,
  exactDuplicateAssignment,
  initialQuickAssignState,
  isQuickAssignDirty,
  mergeTemplatePages,
  quickAssignReducer,
  sameDateAssignments,
  validateQuickAssignDraft,
  type QuickAssignCommandPayload,
} from "./quick-assign-state";
import { QuickAssignTemplateSelection } from "./quick-assign-template-selection";

export function CanonicalQuickAssignSheet({
  athleteUserId,
  initialOpen,
  transitionContext,
  originPhrase,
}: {
  athleteUserId: string;
  initialOpen: boolean;
  transitionContext: string;
  originPhrase: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [state, dispatch] = useReducer(quickAssignReducer, undefined, initialQuickAssignState);
  const [model, setModel] = useState<QuickAssignReadModel | null>(null);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listLoadingMore, setListLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [cursorRecovered, setCursorRecovered] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<QuickAssignPersistedResponse | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const sheetHeadingRef = useRef<HTMLHeadingElement>(null);
  const initializedHistoryRef = useRef(false);
  const openUrlRef = useRef("");
  const dirtyRef = useRef(false);
  const commandRef = useRef(state.command);
  const listSequenceRef = useRef(0);
  const previewSequenceRef = useRef(0);
  const initialLoadedRef = useRef(false);
  const selectedRevisionRef = useRef<string | null>(null);
  const modelRef = useRef<QuickAssignReadModel | null>(null);

  const selectedPreview = model?.selectedTemplate.status === "ready"
    ? model.selectedTemplate.template
    : null;
  const errors = model
    ? validateQuickAssignDraft(model, state.draft, selectedPreview)
    : { model: "Данные назначения не загружены." };
  const exactDuplicate = model ? exactDuplicateAssignment(model, state.draft) : null;
  const sameDateConflict = model
    ? sameDateAssignments(model, state.draft.scheduledFor).length > 0
    : false;
  const commandLocked = state.command.status === "submitting" || state.command.status === "outcome_unknown";

  dirtyRef.current = isQuickAssignDirty(state.draft) && !receipt;
  commandRef.current = state.command;
  modelRef.current = model;

  useEffect(() => {
    if (!initialOpen || initializedHistoryRef.current) return;
    initializedHistoryRef.current = true;
    const openUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const clean = new URL(window.location.href);
    clean.searchParams.delete("assign");
    const cleanUrl = `${clean.pathname}${clean.search}${clean.hash}`;
    openUrlRef.current = openUrl;
    const openedFromProfileTrigger = consumeQuickAssignProfileTrigger(athleteUserId);
    if (!openedFromProfileTrigger) {
      window.history.replaceState({ ...window.history.state, quickAssignBase: true }, "", cleanUrl);
      window.history.pushState({ ...window.history.state, quickAssignOpen: true }, "", openUrl);
    }

    const onPopState = () => {
      const hasAssign = new URL(window.location.href).searchParams.get("assign") === "1";
      if (!hasAssign && dirtyRef.current && commandRef.current.status !== "persisted" && commandRef.current.status !== "revalidation_warning") {
        window.history.pushState({ ...window.history.state, quickAssignOpen: true }, "", openUrlRef.current);
        setDiscardOpen(true);
        return;
      }
      setOpen(hasAssign);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [athleteUserId, initialOpen]);

  const loadFirstPage = useCallback(async (query: string) => {
    const sequence = ++listSequenceRef.current;
    setListLoading(true);
    setListError(null);
    try {
      const next = await loadQuickAssignModel({ athleteUserId, query });
      if (sequence !== listSequenceRef.current) return;
      if (modelRef.current && modelRef.current.athlete.assignmentStateToken !== next.athlete.assignmentStateToken) {
        dispatch({ type: "canonical_state_refreshed" });
      }
      setModel((current) => preservePreview(next, current, selectedRevisionRef.current));
      setInitialError(null);
      initialLoadedRef.current = true;
      setCursorRecovered(false);
    } catch (error) {
      if (sequence !== listSequenceRef.current || isAbort(error)) return;
      const copy = initialLoadedRef.current ? "Не удалось обновить список. Текущие значения сохранены." : readErrorCopy(error);
      if (initialLoadedRef.current) setListError(copy);
      else setInitialError(copy);
    } finally {
      if (sequence === listSequenceRef.current) setListLoading(false);
    }
  }, [athleteUserId]);

  useEffect(() => {
    if (!open || receipt) return;
    const delay = initialLoadedRef.current ? 300 : 0;
    const timer = window.setTimeout(() => void loadFirstPage(state.query), delay);
    return () => window.clearTimeout(timer);
  }, [loadFirstPage, open, receipt, state.query]);

  const loadPreview = useCallback(async (revisionId: string) => {
    const sequence = ++previewSequenceRef.current;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const next = await loadQuickAssignModel({
        athleteUserId,
        query: state.query,
        templateRevisionId: revisionId,
      });
      if (sequence !== previewSequenceRef.current || selectedRevisionRef.current !== revisionId) return;
      if (modelRef.current && modelRef.current.athlete.assignmentStateToken !== next.athlete.assignmentStateToken) {
        dispatch({ type: "canonical_state_refreshed" });
      }
      setModel((current) => current ? {
        ...current,
        selectedTemplate: next.selectedTemplate,
        dataAvailability: { ...current.dataAvailability, preview: next.dataAvailability.preview },
        athlete: next.athlete,
        calendar: next.calendar,
      } : next);
      if (next.selectedTemplate.status !== "ready") {
        dispatch({ type: "command_conflict", code: next.selectedTemplate.status === "stale_revision" ? "template_revision_stale" : "template_unavailable" });
        window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
      }
    } catch (error) {
      if (sequence !== previewSequenceRef.current || isAbort(error)) return;
      setPreviewError(readErrorCopy(error));
    } finally {
      if (sequence === previewSequenceRef.current) setPreviewLoading(false);
    }
  }, [athleteUserId, state.query]);

  function selectTemplate(item: QuickAssignReadModel["templates"]["items"][number]) {
    if (commandLocked) return;
    selectedRevisionRef.current = item.revisionId;
    dispatch({ type: "template_selected", template: item });
    setPreviewError(null);
    setModel((current) => current ? { ...current, selectedTemplate: { status: "idle" } } : current);
    void loadPreview(item.revisionId);
    window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
  }

  async function loadMore() {
    if (!model?.templates.pageInfo.hasNextPage || !model.templates.pageInfo.endCursor || listLoadingMore) return;
    setListLoadingMore(true);
    setListError(null);
    try {
      const next = await loadQuickAssignModel({
        athleteUserId,
        query: state.query,
        cursor: model.templates.pageInfo.endCursor,
      });
      setModel((current) => current ? {
        ...current,
        templates: {
          ...next.templates,
          items: mergeTemplatePages(current.templates.items, next.templates.items),
        },
      } : next);
    } catch (error) {
      if (error instanceof QuickAssignHttpError && error.code === "invalid_cursor") {
        setCursorRecovered(true);
        await loadFirstPage(state.query);
      } else {
        setListError(readErrorCopy(error));
      }
    } finally {
      setListLoadingMore(false);
    }
  }

  async function refreshCanonicalState(code: string) {
    try {
      const next = await loadQuickAssignModel({
        athleteUserId,
        query: state.query,
        templateRevisionId: state.draft.selected?.revisionId ?? null,
      });
      setModel((current) => current ? { ...next, templates: current.templates } : next);
      dispatch({ type: "canonical_state_refreshed" });
      dispatch({ type: "command_conflict", code });
    } catch {
      dispatch({ type: "command_conflict", code: "temporarily_unavailable" });
    }
  }

  async function runCommand(payload: QuickAssignCommandPayload) {
    dispatch({ type: "command_submitting", payload });
    try {
      const result = await submitQuickAssignment(payload);
      setReceipt(result);
      dispatch({ type: "command_persisted", assignmentId: result.assignment.id, warning: result.transition.refreshWarning });
      router.refresh();
    } catch (error) {
      if (!(error instanceof QuickAssignHttpError)) {
        dispatch({ type: "command_outcome_unknown", payload });
        return;
      }
      if (error.code === "assignment_state_changed" || error.code === "same_date_confirmation_required") {
        await refreshCanonicalState(error.code);
        return;
      }
      if (error.code === "template_revision_stale" || error.code === "template_unavailable") {
        dispatch({ type: "command_conflict", code: error.code });
        if (state.draft.selected) void loadPreview(state.draft.selected.revisionId);
        window.requestAnimationFrame(() => previewHeadingRef.current?.focus());
        return;
      }
      if (error.code === "athlete_relation_changed" || error.code === "assignment_forbidden") {
        await refreshCanonicalState(error.code);
        return;
      }
      dispatch({ type: "command_conflict", code: error.code });
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-quick-assign-command-error]")?.focus());
    }
  }

  function submit() {
    if (!model || commandLocked) return;
    setShowValidation(true);
    if (Object.keys(errors).length > 0) {
      dispatch({ type: "command_conflict", code: "assignment_validation_failed" });
      window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-quick-assign-error-summary]")?.focus());
      return;
    }
    const payload = buildStrictAssignmentPayload({
      assignmentId: crypto.randomUUID(),
      model,
      draft: state.draft,
      transitionContext,
    });
    void runCommand(payload);
  }

  function requestClose() {
    if (commandLocked) return;
    if (dirtyRef.current) {
      setDiscardOpen(true);
      return;
    }
    closeThroughHistory();
  }

  function closeThroughHistory() {
    setDiscardOpen(false);
    if (new URL(window.location.href).searchParams.get("assign") === "1") window.history.back();
    else setOpen(false);
  }

  const selectedState: QuickAssignSelectedTemplate = model?.selectedTemplate ?? { status: "idle" };
  const builderHref = useMemo(() => {
    const params = new URLSearchParams({ athleteId: athleteUserId });
    if (transitionContext) params.set("flow", transitionContext);
    return `/trainer/builder?${params}`;
  }, [athleteUserId, transitionContext]);

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && requestClose()}>
        <SheetContent
          side="right"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            if (commandLocked || dirtyRef.current) {
              event.preventDefault();
              if (!commandLocked) setDiscardOpen(true);
            }
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            requestClose();
          }}
          overlayClassName="bg-black/70 backdrop-blur-sm"
          className="inset-0 h-[100dvh] !w-screen !max-w-none gap-0 overflow-hidden border-zinc-800 bg-zinc-950 p-0 text-zinc-100 sm:inset-y-0 sm:left-auto sm:right-0 sm:!w-[min(920px,calc(100vw-32px))] sm:!max-w-[960px] lg:!w-[min(920px,calc(100vw-48px))] motion-reduce:transition-none"
          aria-describedby="quick-assign-description"
        >
          <SheetHeader className="shrink-0 border-b border-zinc-800 px-4 py-3 pr-16 sm:px-5 sm:py-4">
            <div className="flex items-start gap-3 sm:items-center">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-semibold text-zinc-100">
                {model?.athlete.initials ?? <UserRound className="size-4 text-zinc-500" />}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle ref={sheetHeadingRef} className="text-lg font-semibold text-zinc-50">Назначить тренировку</SheetTitle>
                <SheetDescription id="quick-assign-description" className="mt-0.5 break-words text-sm text-zinc-400">
                  {model ? `${model.athlete.displayName} · ${originPhrase}` : originPhrase}
                </SheetDescription>
                {model ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {quickAssignHeaderSummary({
                      persistedScheduledFor: receipt?.assignment.scheduledFor,
                      nextAssignment: model.athlete.nextAssignment,
                      upcomingAssignmentCount: model.athlete.upcomingAssignmentCount,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
            <button type="button" aria-label="Закрыть назначение" onClick={requestClose} disabled={commandLocked} className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-200 disabled:opacity-40 sm:right-4 sm:top-4"><X className="size-5" /></button>
          </SheetHeader>

          {receipt ? <QuickAssignCompletionReceipt result={receipt} athleteDisplayName={model?.athlete.displayName ?? "Спортсмен"} /> : initialError ? (
            <InitialError copy={initialError} onRetry={() => void loadFirstPage(state.query)} onClose={requestClose} />
          ) : !model ? (
            <div className="flex flex-1 items-center justify-center" aria-busy="true"><div className="text-center text-zinc-500"><Loader2 className="mx-auto size-6 animate-spin" /><p className="mt-3 text-sm">Загружаем назначение…</p></div></div>
          ) : !model.athlete.capabilities.canAssign ? (
            <UnavailableState model={model} onClose={requestClose} />
          ) : (
            <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className={state.mobileStep === "selection" ? "h-full min-h-0 lg:block" : "hidden h-full min-h-0 border-r border-zinc-800 lg:block"}>
                <QuickAssignTemplateSelection
                  items={model.templates.items}
                  selectedRevisionId={state.draft.selected?.revisionId ?? null}
                  query={state.query}
                  loading={listLoading}
                  loadingMore={listLoadingMore}
                  disabled={commandLocked}
                  error={listError}
                  hasNextPage={model.templates.pageInfo.hasNextPage}
                  exhausted={!model.templates.pageInfo.hasNextPage && (model.templates.items.length > 0 || cursorRecovered)}
                  onQueryChange={(query) => dispatch({ type: "query_changed", query })}
                  onSelect={selectTemplate}
                  onLoadMore={() => void loadMore()}
                  onRetry={() => void loadFirstPage(state.query)}
                  onCreateTemplate={() => router.push(builderHref)}
                />
              </div>
              <div className={state.mobileStep === "review" ? "h-full min-h-0 overflow-y-auto px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom))] sm:px-6 lg:block" : "hidden h-full min-h-0 overflow-y-auto px-4 py-4 sm:px-6 lg:block"} data-quick-assign-review-scroll>
                {state.mobileStep === "review" ? <Button type="button" variant="ghost" onClick={() => dispatch({ type: "return_to_selection" })} className="mb-3 min-h-11 px-0 text-zinc-300 lg:hidden"><ArrowLeft className="size-4" />К выбору шаблона</Button> : null}
                <QuickAssignSelectedPreview selected={selectedState} loading={previewLoading} error={previewError} headingRef={previewHeadingRef} onRetry={() => state.draft.selected && void loadPreview(state.draft.selected.revisionId)} />
                {state.draft.selected ? (
                  <QuickAssignAssignmentForm
                    model={model}
                    state={state}
                    errors={showValidation ? errors : {}}
                    exactDuplicateId={exactDuplicate?.assignmentId ?? null}
                    sameDateConflict={sameDateConflict}
                    fieldsDisabled={commandLocked}
                    submitDisabled={!selectedPreview || Boolean(exactDuplicate) || !model.athlete.capabilities.canAssign}
                    onDateChange={(scheduledFor) => dispatch({ type: "date_changed", scheduledFor })}
                    onNoteChange={(trainerNote) => dispatch({ type: "note_changed", trainerNote })}
                    onConfirmSameDate={(confirmed) => dispatch({ type: "same_date_confirmed", confirmed })}
                    onSubmit={submit}
                    onRetryUnknown={() => state.command.status === "outcome_unknown" && void runCommand(state.command.payload)}
                  />
                ) : null}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] rounded-lg border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader><DialogTitle>Закрыть без сохранения?</DialogTitle><DialogDescription className="text-zinc-400">Выбранный шаблон, дата и заметка будут сброшены.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row">
            <Button type="button" variant="outline" onClick={() => setDiscardOpen(false)} className="min-h-11 border-zinc-700">Продолжить назначение</Button>
            <Button type="button" onClick={closeThroughHistory} className="min-h-11 bg-rose-200 text-black hover:bg-rose-100">Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function preservePreview(next: QuickAssignReadModel, current: QuickAssignReadModel | null, revisionId: string | null) {
  if (!current || !revisionId || current.selectedTemplate.status === "idle") return next;
  return {
    ...next,
    selectedTemplate: current.selectedTemplate,
    dataAvailability: { ...next.dataAvailability, preview: current.dataAvailability.preview },
  };
}

function InitialError({ copy, onRetry, onClose }: { copy: string; onRetry: () => void; onClose: () => void }) {
  return <div className="flex flex-1 items-center justify-center px-5"><div className="max-w-md border-l-2 border-rose-300/70 px-4"><h2 className="text-lg font-semibold text-zinc-100">Назначение недоступно</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">{copy}</p><div className="mt-5 flex gap-2"><Button type="button" onClick={onRetry} className="min-h-11 bg-lime-300 text-black">Повторить</Button><Button type="button" variant="outline" onClick={onClose} className="min-h-11 border-zinc-700">Закрыть</Button></div></div></div>;
}

function UnavailableState({ model, onClose }: { model: QuickAssignReadModel; onClose: () => void }) {
  const suspended = model.athlete.capabilities.blockedReason === "relation_suspended";
  return <div className="flex flex-1 items-center justify-center px-5"><div className="max-w-md border-l-2 border-zinc-700 px-4"><h2 className="text-lg font-semibold text-zinc-100">{suspended ? "Связь со спортсменом приостановлена" : "Спортсмен недоступен"}</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">Назначить тренировку сейчас нельзя. Данные шаблонов и команды не раскрываются.</p><Button type="button" variant="outline" onClick={onClose} className="mt-5 min-h-11 border-zinc-700">Вернуться к профилю</Button></div></div>;
}


function readErrorCopy(error: unknown) {
  if (error instanceof QuickAssignHttpError) {
    if (error.code === "assignment_forbidden") return "Нет доступа к спортсмену или назначению.";
    if (error.code === "invalid_cursor") return "Список изменился. Загружена первая страница.";
  }
  return "Данные временно недоступны. Повторите запрос.";
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
