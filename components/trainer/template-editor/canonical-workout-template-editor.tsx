"use client";

import { ArrowLeft, Check, CircleAlert, Loader2, RotateCcw, Save, Send } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExerciseSelectionSnapshot } from "@/lib/exercise-library-contract";
import type { WorkoutTemplateEditorIssue, WorkoutTemplateEditorReadModel } from "@/lib/workout-template-editor-contract";
import { resolveWorkoutTemplateExitDestination, safeQuickAssignRestartPath, workoutTemplateEditorHref } from "@/lib/workout-template-editor-navigation";
import { templateWorkspaceReturnWithAnchor } from "@/lib/template-workspace-navigation";
import {
  publishQuickAssignBuilderHandoff,
  quickAssignHrefFromHandoff,
  readQuickAssignBuilderHandoff,
  type QuickAssignBuilderHandoff,
} from "@/components/trainer/quick-assign/quick-assign-handoff";
import { ExerciseLibrarySelectionSheet } from "./exercise-library-selection-sheet";
import { WorkoutTemplateComposition } from "./workout-template-composition";
import {
  EditorRequestError,
  createEditorRevision,
  publishEditorDraft,
  readExactEditor,
  saveEditorDraft,
} from "./workout-template-editor-client";
import {
  clearEditorRecovery,
  readEditorRecovery,
  writeEditorRecovery,
  type EditorRecovery,
} from "./workout-template-editor-recovery";
import {
  createPerSetRows,
  commandStartedAt,
  commandLocksEditor,
  draftFromEditorModel,
  draftsEqual,
  editorCommandReducer,
  editorIssueFocusTarget,
  failedCommandLabel,
  initialEditorCommandState,
  localPublicationIssues,
  moveEditorSequenceItem,
  moveSupersetMember,
  newExerciseDraft,
  normalizeDraft,
  normalizeEditorSequence,
  semanticDraft,
  toCommandContent,
  type CreateRevisionAttempt,
  type EditorDraftContent,
  type EditorExerciseDraft,
  type EditorCommandAttempt,
  type PublishAttempt,
  type SaveAsNewAttempt,
  type SaveDraftAttempt,
  type EditorSaveState,
  type EditorUndoEntry,
} from "./workout-template-editor-state";
import { WorkoutTemplateInformation } from "./workout-template-information";

type Props = {
  actorUserId: string;
  initialModel: WorkoutTemplateEditorReadModel;
  returnTo: string | null;
  handoffToken: string | null;
  showPublishReceipt?: boolean;
};

type PendingConversion =
  | { kind: "prescription"; instanceKey: string; nextType: EditorExerciseDraft["prescriptionType"]; losses: string[] }
  | { kind: "per_set"; instanceKey: string; losses: string[]; resulting: BasicPrescription };

type BasicPrescription = Pick<EditorExerciseDraft, "setCount" | "repetitionsMin" | "repetitionsMax" | "durationSec" | "targetWeightKg" | "restSec">;
type LeaveTarget = { href: string; source: "link" | "back" };
type RecoveryHydration = { key: string; disposition: "none" | "eligible" | "stale" | "active" | "discarded" };
type HandoffState = "none" | "checking" | "accepted" | "unavailable";

export function CanonicalWorkoutTemplateEditor({ actorUserId, initialModel, returnTo, handoffToken, showPublishReceipt = false }: Props) {
  const router = useRouter();
  const [model, setModel] = useState(initialModel);
  const [baseline, setBaseline] = useState(() => draftFromEditorModel(initialModel));
  const [draft, setDraft] = useState(() => draftFromEditorModel(initialModel));
  const [saveState, setSaveState] = useState<EditorSaveState>("pristine");
  const [command, dispatchCommand] = useReducer(editorCommandReducer, initialEditorCommandState);
  const [serverIssues, setServerIssues] = useState<WorkoutTemplateEditorIssue[]>(initialModel.validation.publicationBlockers);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [supersetSelection, setSupersetSelection] = useState<Set<string>>(new Set());
  const [undo, setUndo] = useState<EditorUndoEntry[]>([]);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<ExerciseSelectionSnapshot | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [recovery, setRecovery] = useState<EditorRecovery | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget | null>(null);
  const [pendingConversion, setPendingConversion] = useState<PendingConversion | null>(null);
  const [receipt, setReceipt] = useState<WorkoutTemplateEditorReadModel | null>(() => showPublishReceipt ? initialModel : null);
  const [handoff, setHandoff] = useState<QuickAssignBuilderHandoff | null>(null);
  const [handoffState, setHandoffState] = useState<HandoffState>(handoffToken ? "checking" : "none");
  const [recoveryHydration, setRecoveryHydration] = useState<RecoveryHydration | null>(null);
  const historyGuardRef = useRef(false);
  const suppressPopRef = useRef(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const receiptRef = useRef<HTMLElement>(null);
  const handoffStatusRef = useRef<HTMLDivElement>(null);
  const conflictRef = useRef<HTMLHeadingElement>(null);
  const baseEditable = model.mode === "new" || model.mode === "editable";
  const editorLocked = commandLocksEditor(command);
  const editable = baseEditable && !editorLocked;
  const dirty = baseEditable && !draftsEqual(draft, baseline);
  const guarded = dirty || command.phase === "running" || command.phase === "outcome_unknown" || command.phase === "conflict";
  const localIssues = useMemo(() => localPublicationIssues(draft), [draft]);
  const issues = useMemo(() => mergeIssues(serverIssues, localIssues), [localIssues, serverIssues]);
  const recoveryScope = model.identity?.templateId ?? "new";
  const recoveryHydrationKey = `${actorUserId}:${recoveryScope}:${model.concurrency.editToken ?? "new"}`;
  const navigationReturnTo = handoffState === "unavailable" ? null : returnTo;
  const activeHandoffToken = handoffState === "accepted" ? handoffToken : null;
  const quickAssignRestartHref = handoffState === "unavailable" ? safeQuickAssignRestartPath(returnTo) : null;

  useEffect(() => {
    if (!handoffToken) {
      queueMicrotask(() => setHandoffState("none"));
      return;
    }
    const accepted = readQuickAssignBuilderHandoff(handoffToken);
    queueMicrotask(() => {
      setHandoff(accepted);
      setHandoffState(accepted ? "accepted" : "unavailable");
    });
  }, [handoffToken]);

  useEffect(() => {
    if (handoffState !== "unavailable") return;
    requestAnimationFrame(() => handoffStatusRef.current?.focus());
  }, [handoffState]);

  useEffect(() => {
    if (recoveryHydration?.key === recoveryHydrationKey) return;
    const stored = readEditorRecovery(actorUserId, recoveryScope);
    if (!stored) {
      queueMicrotask(() => {
        setRecovery(null);
        setRecoveryHydration({ key: recoveryHydrationKey, disposition: "none" });
      });
      return;
    }
    const tokenMatches = stored.editToken === model.concurrency.editToken;
    const eligible = tokenMatches && !draftsEqual(stored.content, baseline);
    queueMicrotask(() => {
      setRecovery(eligible ? stored : null);
      setRecoveryHydration({ key: recoveryHydrationKey, disposition: eligible ? "eligible" : "stale" });
    });
  }, [actorUserId, baseline, model.concurrency.editToken, recoveryHydration?.key, recoveryHydrationKey, recoveryScope]);

  useEffect(() => {
    if (recoveryHydration?.key !== recoveryHydrationKey || !dirty) return;
    writeEditorRecovery({
      actorUserId,
      scope: recoveryScope,
      templateId: model.identity?.templateId ?? null,
      revisionId: model.identity?.selectedRevisionId ?? null,
      editToken: model.concurrency.editToken,
      content: draft,
      returnTo: navigationReturnTo,
      handoffToken: activeHandoffToken,
    });
    if (recoveryHydration.disposition !== "active") {
      queueMicrotask(() => setRecoveryHydration({ key: recoveryHydrationKey, disposition: "active" }));
    }
  }, [activeHandoffToken, actorUserId, draft, dirty, model.concurrency.editToken, model.identity, navigationReturnTo, recoveryHydration, recoveryHydrationKey, recoveryScope]);

  useEffect(() => {
    if (recoveryHydration?.key !== recoveryHydrationKey || recoveryHydration.disposition !== "active" || dirty || recovery) return;
    clearEditorRecovery(actorUserId, recoveryScope);
    queueMicrotask(() => setRecoveryHydration({ key: recoveryHydrationKey, disposition: "none" }));
  }, [actorUserId, dirty, recovery, recoveryHydration, recoveryHydrationKey, recoveryScope]);

  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => { if (guarded) event.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [guarded]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!guarded || event.defaultPrevented || event.button !== 0) return;
      const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaveTarget({ href: `${anchor.pathname}${anchor.search}${anchor.hash}`, source: "link" });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [guarded]);

  useEffect(() => {
    const onPopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        const pendingNavigation = pendingNavigationRef.current;
        pendingNavigationRef.current = null;
        pendingNavigation?.();
        return;
      }
      if (!historyGuardRef.current) return;
      window.history.pushState({ workoutTemplateEditorGuard: true }, "", window.location.href);
      setLeaveTarget({ href: navigationReturnTo ?? "/trainer/templates", source: "back" });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [navigationReturnTo]);

  useEffect(() => {
    if (guarded && !historyGuardRef.current) {
      window.history.pushState({ workoutTemplateEditorGuard: true }, "", window.location.href);
      historyGuardRef.current = true;
    } else if (!guarded && historyGuardRef.current) {
      historyGuardRef.current = false;
    }
  }, [guarded]);

  useEffect(() => {
    if (!receipt) return;
    requestAnimationFrame(() => receiptRef.current?.focus());
  }, [receipt]);

  useEffect(() => {
    if (command.phase !== "conflict") return;
    requestAnimationFrame(() => conflictRef.current?.focus());
  }, [command.phase]);

  function change(next: EditorDraftContent) {
    if (!editable) return;
    setDraft(normalizeDraft(next));
    setSaveState(draftsEqual(next, baseline) ? "pristine" : "dirty");
    setServerIssues([]);
  }

  function updateExercise(instanceKey: string, update: (exercise: EditorExerciseDraft) => EditorExerciseDraft) {
    change({ ...draft, exercises: draft.exercises.map((exercise) => exercise.instanceKey === instanceKey ? update(exercise) : exercise) });
  }

  function requestPrescriptionType(instanceKey: string, nextType: EditorExerciseDraft["prescriptionType"]) {
    const exercise = draft.exercises.find((item) => item.instanceKey === instanceKey);
    if (!exercise || exercise.prescriptionType === nextType) return;
    const losses = nextType === "duration"
      ? [exercise.repetitionsMin || exercise.repetitionsMax || exercise.sets.some((set) => set.repetitionsMin || set.repetitionsMax) ? "повторения в общих и подходных настройках" : null]
      : [exercise.durationSec || exercise.sets.some((set) => set.durationSec) ? "длительность в общих и подходных настройках" : null];
    const actual = losses.filter((value): value is string => Boolean(value));
    if (actual.length) setPendingConversion({ kind: "prescription", instanceKey, nextType, losses: actual });
    else applyPrescriptionType(instanceKey, nextType);
  }

  function applyPrescriptionType(instanceKey: string, nextType: EditorExerciseDraft["prescriptionType"]) {
    setUndo((items) => [...items.slice(-4), { message: "Формат упражнения изменён", content: draft }]);
    updateExercise(instanceKey, (exercise) => ({
      ...exercise,
      prescriptionType: nextType,
      ...(nextType === "duration"
        ? { repetitionsMin: "", repetitionsMax: "", sets: exercise.sets.map((set) => ({ ...set, repetitionsMin: "", repetitionsMax: "" })) }
        : { durationSec: "", sets: exercise.sets.map((set) => ({ ...set, durationSec: "" })) }),
    }));
    setPendingConversion(null);
  }

  function requestPerSet(instanceKey: string, enabled: boolean) {
    const exercise = draft.exercises.find((item) => item.instanceKey === instanceKey);
    if (!exercise) return;
    if (enabled) {
      updateExercise(instanceKey, (item) => ({ ...item, perSetMode: true, sets: createPerSetRows(item) }));
      return;
    }
    const first = exercise.sets[0];
    const equal = Boolean(first) && exercise.sets.every((set) => set.kind === first.kind
      && set.repetitionsMin === first.repetitionsMin && set.repetitionsMax === first.repetitionsMax
      && set.durationSec === first.durationSec && set.targetWeightKg === first.targetWeightKg && set.restSec === first.restSec);
    setPendingConversion({
      kind: "per_set",
      instanceKey,
      losses: equal ? ["структура отдельных подходов"] : ["индивидуальные значения и типы подходов"],
      resulting: {
        setCount: String(exercise.sets.length),
        repetitionsMin: equal && first ? first.repetitionsMin : exercise.repetitionsMin,
        repetitionsMax: equal && first ? first.repetitionsMax : exercise.repetitionsMax,
        durationSec: equal && first ? first.durationSec : exercise.durationSec,
        targetWeightKg: equal && first ? first.targetWeightKg : exercise.targetWeightKg,
        restSec: equal && first ? first.restSec : exercise.restSec,
      },
    });
  }

  function confirmConversion() {
    if (!pendingConversion) return;
    if (pendingConversion.kind === "prescription") applyPrescriptionType(pendingConversion.instanceKey, pendingConversion.nextType);
    else {
      setUndo((items) => [...items.slice(-4), { message: "Подходы переведены в общий режим", content: draft }]);
      updateExercise(pendingConversion.instanceKey, (item) => ({ ...item, ...pendingConversion.resulting, perSetMode: false, sets: [] }));
      setPendingConversion(null);
    }
  }

  function moveSequence(instanceKey: string, direction: -1 | 1) {
    const exercises = moveEditorSequenceItem(draft.exercises, instanceKey, direction);
    change({ ...draft, exercises });
    const target = exercises.findIndex((item) => item.instanceKey === instanceKey);
    setAnnouncement(`${exercises[target]?.title ?? "Элемент"}: позиция ${target + 1}`);
    requestAnimationFrame(() => document.getElementById(`exercise-${instanceKey}`)?.focus());
  }

  function moveGroupMember(instanceKey: string, direction: -1 | 1) {
    const exercises = moveSupersetMember(draft.exercises, instanceKey, direction);
    change({ ...draft, exercises });
    const exercise = exercises.find((item) => item.instanceKey === instanceKey);
    setAnnouncement(`${exercise?.title ?? "Участник"}: позиция в суперсете ${exercise?.supersetPosition ?? 1}`);
    requestAnimationFrame(() => document.getElementById(`exercise-${instanceKey}`)?.focus());
  }

  function removeExercise(instanceKey: string) {
    const index = draft.exercises.findIndex((item) => item.instanceKey === instanceKey);
    if (index < 0) return;
    setUndo((items) => [...items.slice(-4), { message: "Упражнение удалено", content: draft }]);
    const next = draft.exercises.filter((item) => item.instanceKey !== instanceKey);
    change({ ...draft, exercises: next });
    setAnnouncement("Упражнение удалено. Можно вернуть до сохранения.");
    requestAnimationFrame(() => document.getElementById(next[index]?.instanceKey ? `exercise-${next[index].instanceKey}` : next[index - 1]?.instanceKey ? `exercise-${next[index - 1].instanceKey}` : "template-composition-heading")?.focus());
  }

  function undoLast() {
    const previous = undo.at(-1);
    if (!previous) return;
    setUndo((items) => items.slice(0, -1));
    change(previous.content);
    setAnnouncement("Последнее изменение отменено");
  }

  function acceptExercise(snapshot: ExerciseSelectionSnapshot, force = false) {
    const existing = draft.exercises.find((item) => item.sourceExerciseId === snapshot.sourceExerciseId || item.sourceExerciseKey === snapshot.sourceExerciseKey);
    if (existing && !force) { setDuplicate(snapshot); return; }
    const exercise = newExerciseDraft(snapshot);
    change({ ...draft, exercises: [...draft.exercises, exercise] });
    setExpanded((items) => new Set(items).add(exercise.instanceKey));
    setDuplicate(null);
    setAnnouncement(`${exercise.title} добавлено`);
    requestAnimationFrame(() => document.getElementById(`exercise-${exercise.instanceKey}`)?.scrollIntoView({ block: "center" }));
  }

  function frozenDraft() {
    return normalizeDraft(structuredClone(draft));
  }

  async function save(options: { exitTo?: string | null } = {}) {
    if (!baseEditable || editorLocked || command.phase === "conflict") return;
    const frozenContent = frozenDraft();
    const fingerprint = semanticDraft(frozenContent);
    const previous = command.phase === "failed" && command.attempt?.operation === "save_draft"
      && command.attempt.fingerprint === fingerprint ? command.attempt : null;
    const attempt: SaveDraftAttempt = previous
      ? { ...previous, exitTo: options.exitTo ?? null, resultState: "running" }
      : {
          operation: "save_draft",
          commandId: crypto.randomUUID(),
          templateId: model.identity?.templateId ?? crypto.randomUUID(),
          revisionId: model.identity?.selectedRevisionId ?? crypto.randomUUID(),
          expectedToken: model.concurrency.editToken,
          fingerprint,
          frozenContent,
          frozenPayload: toCommandContent(frozenContent, model.identity?.selectedRevisionNumber ?? 1),
          exitTo: options.exitTo ?? null,
          startedAt: commandStartedAt(),
          resultState: "running",
        };
    dispatchCommand({ type: "begin", attempt });
    setLibraryOpen(false);
    await executeSave(attempt);
  }

  async function executeSave(attempt: SaveDraftAttempt | SaveAsNewAttempt) {
    try {
      await saveEditorDraft({
        commandId: attempt.commandId,
        templateId: attempt.templateId,
        revisionId: attempt.revisionId,
        expectedEditToken: attempt.expectedToken,
        content: attempt.frozenPayload,
      });
      const fresh = await readExactEditor(attempt.templateId, "editable");
      if (!draftsEqual(draftFromEditorModel(fresh), attempt.frozenContent)) {
        dispatchCommand({ type: "conflict", errorCode: "persisted_content_mismatch" });
        return;
      }
      acceptPersisted(fresh, attempt);
    } catch (error) {
      handleCommandError(error);
    }
  }

  async function publish() {
    if (!model.identity || !model.concurrency.editToken || dirty || issues.length || editorLocked) return;
    const previous = command.phase === "failed" && command.attempt?.operation === "publish"
      && command.attempt.revisionId === model.identity.selectedRevisionId ? command.attempt : null;
    const attempt: PublishAttempt = previous ?? {
      operation: "publish",
      commandId: crypto.randomUUID(),
      templateId: model.identity.templateId,
      revisionId: model.identity.selectedRevisionId,
      previousPublishedRevisionId: model.lifecycle.publishedRevisionSummary?.revisionId ?? null,
      expectedToken: model.concurrency.editToken,
      fingerprint: model.identity.selectedRevisionId,
      startedAt: commandStartedAt(),
      resultState: "running",
    };
    dispatchCommand({ type: "begin", attempt });
    await executePublish(attempt);
  }

  async function executePublish(attempt: PublishAttempt) {
    try {
      await publishEditorDraft({
        commandId: attempt.commandId,
        templateId: attempt.templateId,
        revisionId: attempt.revisionId,
        expectedEditToken: attempt.expectedToken!,
      });
      const published = await readExactEditor(attempt.templateId, "published");
      if (published.identity?.selectedRevisionId !== attempt.revisionId) {
        dispatchCommand({ type: "conflict", errorCode: "published_revision_mismatch" });
        return;
      }
      acceptPublication(published);
    } catch (error) {
      handleCommandError(error);
    }
  }

  async function createRevision() {
    if (!model.identity || !model.capabilities.canCreateRevision || editorLocked) return;
    const previous = command.phase === "failed" && command.attempt?.operation === "create_revision"
      && command.attempt.sourceRevisionId === model.identity.selectedRevisionId ? command.attempt : null;
    const attempt: CreateRevisionAttempt = previous ?? {
      operation: "create_revision",
      commandId: crypto.randomUUID(),
      templateId: model.identity.templateId,
      revisionId: null,
      sourceRevisionId: model.identity.selectedRevisionId,
      expectedToken: model.concurrency.lifecycleToken,
      fingerprint: model.identity.selectedRevisionId,
      startedAt: commandStartedAt(),
      resultState: "running",
    };
    dispatchCommand({ type: "begin", attempt });
    await executeCreateRevision(attempt);
  }

  async function executeCreateRevision(attempt: CreateRevisionAttempt) {
    try {
      const result = await createEditorRevision({
        templateId: attempt.templateId,
        commandId: attempt.commandId,
        expectedTemplateToken: attempt.expectedToken,
      });
      const fresh = await readExactEditor(attempt.templateId, "editable");
      if (fresh.identity?.selectedRevisionId !== result.template.revisionId) {
        dispatchCommand({ type: "conflict", errorCode: "created_revision_mismatch" });
        return;
      }
      acceptPersisted(fresh, attempt);
    } catch (error) {
      handleCommandError(error);
    }
  }

  async function saveAsNewTemplate() {
    if (command.phase === "running" || command.phase === "outcome_unknown") return;
    const frozenContent = frozenDraft();
    const fingerprint = semanticDraft(frozenContent);
    const previous = command.phase === "failed" && command.attempt?.operation === "save_as_new"
      && command.attempt.fingerprint === fingerprint ? command.attempt : null;
    const attempt: SaveAsNewAttempt = previous ?? {
      operation: "save_as_new",
      commandId: crypto.randomUUID(),
      templateId: crypto.randomUUID(),
      revisionId: crypto.randomUUID(),
      expectedToken: null,
      fingerprint,
      frozenContent,
      frozenPayload: toCommandContent(frozenContent, 1),
      startedAt: commandStartedAt(),
      resultState: "running",
    };
    dispatchCommand({ type: "begin", attempt });
    await executeSave(attempt);
  }

  async function reconcile() {
    const attempt = command.attempt;
    if (!attempt || command.phase !== "outcome_unknown") return;
    dispatchCommand({ type: "begin", attempt });
    try {
      if (attempt.operation === "save_draft" || attempt.operation === "save_as_new") {
        await reconcileSave(attempt);
      } else if (attempt.operation === "publish") {
        await reconcilePublish(attempt);
      } else {
        await reconcileCreateRevision(attempt);
      }
    } catch (error) {
      handleCommandError(error);
    }
  }

  async function reconcileSave(attempt: SaveDraftAttempt | SaveAsNewAttempt) {
    let fresh: WorkoutTemplateEditorReadModel | null = null;
    try {
      fresh = await readExactEditor(attempt.templateId, "editable");
    } catch (error) {
      if (!(error instanceof EditorRequestError) || error.status !== 404 || attempt.operation !== "save_as_new") throw error;
    }
    if (fresh && draftsEqual(draftFromEditorModel(fresh), attempt.frozenContent)) {
      acceptPersisted(fresh, attempt);
      return;
    }
    const unchanged = fresh && attempt.operation === "save_draft"
      && fresh.identity?.selectedRevisionId === attempt.revisionId
      && fresh.concurrency.editToken === attempt.expectedToken;
    if (fresh && !unchanged) {
      dispatchCommand({ type: "conflict", errorCode: "server_draft_changed" });
      return;
    }
    await saveEditorDraft({
      commandId: attempt.commandId,
      templateId: attempt.templateId,
      revisionId: attempt.revisionId,
      expectedEditToken: attempt.expectedToken,
      content: attempt.frozenPayload,
    });
    const persisted = await readExactEditor(attempt.templateId, "editable");
    if (!draftsEqual(draftFromEditorModel(persisted), attempt.frozenContent)) {
      dispatchCommand({ type: "conflict", errorCode: "replayed_content_mismatch" });
      return;
    }
    acceptPersisted(persisted, attempt);
  }

  async function reconcilePublish(attempt: PublishAttempt) {
    let published: WorkoutTemplateEditorReadModel | null = null;
    try {
      published = await readExactEditor(attempt.templateId, "published");
      if (published.identity?.selectedRevisionId === attempt.revisionId) {
        acceptPublication(published);
        return;
      }
    } catch (error) {
      if (!(error instanceof EditorRequestError)
        || (error.status !== 404 && error.code !== "published_revision_not_found")) throw error;
    }
    const observedPublishedRevisionId = published?.identity?.selectedRevisionId ?? null;
    if (observedPublishedRevisionId !== attempt.previousPublishedRevisionId) {
      dispatchCommand({ type: "conflict", errorCode: "published_revision_changed" });
      return;
    }
    const editableModel = await readExactEditor(attempt.templateId, "editable");
    if (editableModel.identity?.selectedRevisionId !== attempt.revisionId
      || editableModel.concurrency.editToken !== attempt.expectedToken) {
      dispatchCommand({ type: "conflict", errorCode: "publish_source_changed" });
      return;
    }
    await publishEditorDraft({
      commandId: attempt.commandId,
      templateId: attempt.templateId,
      revisionId: attempt.revisionId,
      expectedEditToken: attempt.expectedToken!,
    });
    const replayed = await readExactEditor(attempt.templateId, "published");
    if (replayed.identity?.selectedRevisionId !== attempt.revisionId) {
      dispatchCommand({ type: "conflict", errorCode: "published_revision_mismatch" });
      return;
    }
    acceptPublication(replayed);
  }

  async function reconcileCreateRevision(attempt: CreateRevisionAttempt) {
    const result = await createEditorRevision({
      templateId: attempt.templateId,
      commandId: attempt.commandId,
      expectedTemplateToken: attempt.expectedToken,
    });
    const fresh = await readExactEditor(attempt.templateId, "editable");
    if (fresh.identity?.selectedRevisionId !== result.template.revisionId) {
      dispatchCommand({ type: "conflict", errorCode: "created_revision_mismatch" });
      return;
    }
    acceptPersisted(fresh, attempt);
  }

  function handleCommandError(error: unknown) {
    if (error instanceof EditorRequestError) {
      setServerIssues(error.issues);
      if (error.status === 409) dispatchCommand({ type: "conflict", errorCode: error.code });
      else if (error.uncertain) dispatchCommand({ type: "outcome_unknown" });
      else dispatchCommand({ type: "failed", errorCode: error.code });
      return;
    }
    dispatchCommand({ type: "outcome_unknown" });
  }

  function acceptPersisted(fresh: WorkoutTemplateEditorReadModel, attempt: EditorCommandAttempt) {
    const persisted = draftFromEditorModel(fresh);
    setModel(fresh);
    setBaseline(persisted);
    setDraft(persisted);
    setServerIssues(fresh.validation.publicationBlockers);
    setSaveState("saved");
    setUndo([]);
    setRecovery(null);
    setRecoveryHydration({ key: recoveryHydrationKey, disposition: "none" });
    setLeaveTarget(null);
    dispatchCommand({ type: "clear" });
    clearEditorRecovery(actorUserId, recoveryScope);
    setAnnouncement(attempt.operation === "create_revision" ? "Новая версия создана" : "Черновик сохранён");
    const currentHandoff = handoffToken ? readQuickAssignBuilderHandoff(handoffToken) : null;
    if (handoffToken && !currentHandoff) {
      setHandoff(null);
      setHandoffState("unavailable");
    } else if (currentHandoff) {
      setHandoff(currentHandoff);
      setHandoffState("accepted");
    }
    const exactHref = workoutTemplateEditorHref({
      mode: "exact",
      templateId: attempt.templateId,
      returnTo: handoffToken && !currentHandoff ? null : returnTo,
      handoffToken: currentHandoff?.token,
    });
    if (attempt.operation === "save_draft" && attempt.exitTo) {
      setLeaveTarget(null);
      navigateAfterGuard(() => router.push(resolveWorkoutTemplateExitDestination(attempt.exitTo, attempt.templateId)));
    } else if (attempt.operation === "save_as_new" || !model.identity || attempt.operation === "create_revision") {
      navigateAfterGuard(() => router.replace(exactHref));
    }
  }

  function acceptPublication(published: WorkoutTemplateEditorReadModel) {
    const persisted = draftFromEditorModel(published);
    setModel(published);
    setBaseline(persisted);
    setDraft(persisted);
    setServerIssues(published.validation.publicationBlockers);
    setSaveState("saved");
    setReceipt(published);
    setRecovery(null);
    setRecoveryHydration({ key: recoveryHydrationKey, disposition: "none" });
    setLeaveTarget(null);
    dispatchCommand({ type: "clear" });
    clearEditorRecovery(actorUserId, recoveryScope);
    setAnnouncement("Шаблон опубликован");
    const publishedHandoff = handoffToken && handoff
      ? publishQuickAssignBuilderHandoff({ token: handoffToken, athleteUserId: handoff.athleteUserId, publishedRevisionId: published.identity!.selectedRevisionId })
      : null;
    if (handoffToken) {
      setHandoff(publishedHandoff);
      setHandoffState(publishedHandoff ? "accepted" : "unavailable");
    }
    navigateAfterGuard(() => router.replace(workoutTemplateEditorHref({
      mode: "exact",
      templateId: published.identity!.templateId,
      view: "published",
      receipt: "published",
      returnTo: handoffToken && !publishedHandoff ? null : returnTo,
      handoffToken: publishedHandoff?.token,
    })));
  }

  async function openSavedVersion() {
    if (!model.identity) return;
    try {
      const fresh = await readExactEditor(model.identity.templateId, "default");
      const persisted = draftFromEditorModel(fresh);
      setModel(fresh);
      setBaseline(persisted);
      setDraft(persisted);
      setServerIssues(fresh.validation.publicationBlockers);
      setUndo([]);
      setLeaveTarget(null);
      setRecovery(null);
      setRecoveryHydration({ key: recoveryHydrationKey, disposition: "discarded" });
      dispatchCommand({ type: "clear" });
      clearEditorRecovery(actorUserId, recoveryScope);
      navigateAfterGuard(() => router.replace(workoutTemplateEditorHref({
        mode: "exact",
        templateId: model.identity!.templateId,
        returnTo: navigationReturnTo,
        handoffToken: activeHandoffToken,
      })));
    } catch (error) {
      handleCommandError(error);
    }
  }

  function requestLeave(href: string) {
    if (guarded) setLeaveTarget({ href, source: "link" });
    else router.push(href);
  }

  function discardAndLeave() {
    if (!leaveTarget) return;
    const href = resolveWorkoutTemplateExitDestination(leaveTarget.href, model.identity?.templateId);
    clearEditorRecovery(actorUserId, recoveryScope);
    setDraft(baseline);
    setSaveState("pristine");
    setLeaveTarget(null);
    setRecoveryHydration({ key: recoveryHydrationKey, disposition: "discarded" });
    dispatchCommand({ type: "clear" });
    navigateAfterGuard(() => router.push(href));
  }

  function navigateAfterGuard(navigate: () => void) {
    if (!historyGuardRef.current) {
      navigate();
      return;
    }
    suppressPopRef.current = true;
    historyGuardRef.current = false;
    pendingNavigationRef.current = navigate;
    window.history.back();
  }

  function focusValidationIssue(issue: WorkoutTemplateEditorIssue) {
    const target = editorIssueFocusTarget(issue);
    const groupInstance = target.supersetKey
      ? draft.exercises
          .filter((exercise) => exercise.supersetKey === target.supersetKey)
          .sort((left, right) => (left.supersetPosition ?? 0) - (right.supersetPosition ?? 0))[0]?.instanceKey ?? null
      : null;
    const instanceKey = target.instanceKey ?? groupInstance;
    if (instanceKey) setExpanded((items) => new Set(items).add(instanceKey));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const element = document.getElementById(target.id) ?? document.getElementById("template-composition-heading");
      element?.scrollIntoView({ block: "center" });
      element?.focus({ preventScroll: true });
    }));
  }

  function primary() {
    if (receipt || command.phase === "outcome_unknown" || command.phase === "conflict") return null;
    if (command.phase === "running") return <Button disabled className="min-h-11 bg-lime-300 text-black"><Loader2 className="animate-spin" />{runningLabel(command.attempt?.operation)}</Button>;
    if (model.mode === "published") return model.capabilities.canContinueDraft
      ? <Button onClick={() => router.push(workoutTemplateEditorHref({ mode: "exact", templateId: model.identity!.templateId, returnTo: navigationReturnTo, handoffToken: activeHandoffToken }))} className="min-h-11 bg-lime-300 text-black">Продолжить черновик</Button>
      : <Button onClick={() => void createRevision()} className="min-h-11 bg-lime-300 text-black">Создать новую версию</Button>;
    if (model.mode === "archived") return <Button onClick={() => requestLeave(navigationReturnTo ?? "/trainer/templates")} className="min-h-11 bg-lime-300 text-black">К шаблонам</Button>;
    if (dirty || model.mode === "new") return <Button onClick={() => void save()} className="min-h-11 bg-lime-300 text-black"><Save />Сохранить черновик</Button>;
    if (issues.length) return <Button onClick={() => issues[0] && focusValidationIssue(issues[0])} className="min-h-11 bg-lime-300 text-black"><CircleAlert />Перейти к ошибкам</Button>;
    return <Button onClick={() => void publish()} className="min-h-11 bg-lime-300 text-black"><Send />Опубликовать</Button>;
  }

  const lifecycle = lifecycleLabel(model);
  return <div className="mx-auto max-w-6xl pb-16 [scroll-padding-top:10rem]">
    <div aria-live="polite" className="sr-only">{announcement}</div>
    <header className="sticky top-0 z-20 -mx-2 border-b border-zinc-800 bg-black/95 px-2 py-3 backdrop-blur supports-[backdrop-filter]:bg-black/80 max-h-[40vh]:static">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3"><Button type="button" variant="ghost" size="icon" aria-label="Назад" onClick={() => requestLeave(navigationReturnTo ?? "/trainer/templates")} className="size-11"><ArrowLeft /></Button><div className="min-w-0"><p className="truncate text-lg font-semibold text-zinc-50">{draft.title || (model.mode === "new" ? "Новый шаблон" : "Шаблон")}</p><p className="mt-1 text-xs text-zinc-500">{lifecycle} · {saveLabel(saveState, dirty, command.phase, command.attempt?.operation)}</p>{handoff ? <p className="mt-1 text-xs text-lime-200">Вы создаёте шаблон для последующего назначения</p> : null}</div></div>
        <div className="flex items-center gap-2">{command.phase === "outcome_unknown" ? <Button variant="outline" onClick={() => void reconcile()} className="min-h-11 border-zinc-700"><RotateCcw />{reconcileLabel(command.attempt?.operation)}</Button> : null}{primary()}</div>
      </div>
    </header>

    {handoffState === "unavailable" ? <section ref={handoffStatusRef} tabIndex={-1} role="status" className="mt-5 border-l-2 border-amber-300/70 px-4 py-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60"><h2 className="font-medium text-amber-100">Контекст назначения больше недоступен</h2><p className="mt-1 text-sm text-zinc-400">Шаблон можно сохранить и опубликовать. Возврат выполняется через безопасный профиль спортсмена или список шаблонов.</p></section> : null}

    {recovery ? <section role="status" className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/[0.05] p-4"><p className="font-medium text-amber-100">Найдены несохранённые изменения в этой вкладке</p><p className="mt-1 text-sm text-zinc-400">Серверная версия остаётся основной, пока вы явно не восстановите изменения.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => { setDraft(recovery.content); setSaveState("dirty"); setRecovery(null); setRecoveryHydration({ key: recoveryHydrationKey, disposition: "active" }); }} className="min-h-11 border-zinc-700">Восстановить изменения</Button><Button variant="ghost" onClick={() => { clearEditorRecovery(actorUserId, recoveryScope); setRecovery(null); setRecoveryHydration({ key: recoveryHydrationKey, disposition: "discarded" }); }}>Открыть сохранённую версию</Button></div></section> : null}

    {receipt ? <PublishReceipt containerRef={receiptRef} model={receipt} handoff={handoff} restartHref={quickAssignRestartHref} onContinue={() => handoff ? router.push(quickAssignHrefFromHandoff(handoff)) : quickAssignRestartHref ? router.push(quickAssignRestartHref) : router.push(templateWorkspaceReturnWithAnchor(navigationReturnTo, receipt.identity?.templateId) ?? "/trainer/templates")} onWorkspace={() => router.push(templateWorkspaceReturnWithAnchor(navigationReturnTo, receipt.identity?.templateId) ?? "/trainer/templates")} onView={() => { setReceipt(null); router.replace(workoutTemplateEditorHref({ mode: "exact", templateId: receipt.identity!.templateId, view: "published", returnTo: navigationReturnTo, handoffToken: activeHandoffToken })); }} /> : <main className="pt-7">
      {model.mode === "published" ? <LifecycleContext title="Опубликованная версия" text="Версия неизменяема и доступна для назначения. Чтобы редактировать шаблон, создайте новую версию." /> : model.mode === "archived" ? <LifecycleContext title="Шаблон в архиве" text="Он недоступен для назначения. Содержимое показано в сохранённом виде." /> : null}
      {command.phase === "conflict" ? <div className="mb-6 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] p-4" role="alert"><h2 ref={conflictRef} tabIndex={-1} className="font-semibold text-zinc-100 outline-none">Есть более новая серверная версия</h2><p className="mt-1 text-sm text-zinc-400">Локальные изменения сохранены. Перезапись серверной версии не выполняется.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" onClick={() => void openSavedVersion()} className="min-h-11 border-zinc-700">Открыть сохранённую версию</Button><Button variant="ghost" onClick={() => void saveAsNewTemplate()}>Сохранить как новый шаблон</Button></div></div> : null}
      {command.phase === "failed" ? <LifecycleContext title={failedCommandLabel(command.attempt?.operation)} text="Изменения остались в редакторе. Проверьте поля и повторите действие." tone="danger" /> : null}
      <WorkoutTemplateInformation content={draft} editable={baseEditable} disabled={editorLocked} limits={model.fieldLimits} issues={issues} onChange={change} />
      {issues.length ? <ValidationSummary issues={issues} onIssue={focusValidationIssue} /> : null}
      <WorkoutTemplateComposition content={draft} editable={baseEditable} disabled={editorLocked} expanded={expanded} selectedForSuperset={supersetSelection} issues={issues} undoAvailable={undo.length > 0} onExpandedChange={(key) => setExpanded((items) => { const next = new Set(items); if (next.has(key)) next.delete(key); else next.add(key); return next; })} onSelectForSuperset={(key, selected) => setSupersetSelection((items) => { const next = new Set(items); if (selected) next.add(key); else next.delete(key); return next; })} onCreateSuperset={() => { const key = crypto.randomUUID(); const selected = [...supersetSelection]; const grouped = draft.exercises.map((exercise) => selected.includes(exercise.instanceKey) ? { ...exercise, supersetKey: key, supersetPosition: selected.indexOf(exercise.instanceKey) + 1, supersetLabel: "", supersetInstruction: "" } : exercise); change({ ...draft, exercises: normalizeEditorSequence(grouped) }); setSupersetSelection(new Set()); }} onDissolveSuperset={(key) => change({ ...draft, exercises: draft.exercises.map((exercise) => exercise.supersetKey === key ? { ...exercise, supersetKey: null, supersetPosition: null, supersetLabel: "", supersetInstruction: "" } : exercise) })} onUpdateExercise={updateExercise} onMoveSequence={moveSequence} onMoveSupersetMember={moveGroupMember} onRemoveExercise={removeExercise} onTogglePerSet={requestPerSet} onPrescriptionTypeChange={requestPrescriptionType} onMoveSet={(instanceKey, setKey, direction) => updateExercise(instanceKey, (exercise) => { const index = exercise.sets.findIndex((set) => set.setKey === setKey); const target = index + direction; if (index < 0 || target < 0 || target >= exercise.sets.length) return exercise; const sets = [...exercise.sets]; [sets[index], sets[target]] = [sets[target], sets[index]]; return { ...exercise, sets }; })} onRemoveSet={(instanceKey, setKey) => updateExercise(instanceKey, (exercise) => { const sets = exercise.sets.filter((set) => set.setKey !== setKey); return { ...exercise, sets, setCount: String(sets.length) }; })} onUndo={undoLast} onOpenLibrary={() => { if (!editorLocked) setLibraryOpen(true); }} />
    </main>}

    <ExerciseLibrarySelectionSheet open={libraryOpen && !editorLocked} onOpenChange={(open) => { if (!editorLocked) setLibraryOpen(open); }} onSelect={(snapshot) => acceptExercise(snapshot)} />
    <Dialog open={Boolean(duplicate)} onOpenChange={(open) => { if (!open) setDuplicate(null); }}><DialogContent><DialogHeader><DialogTitle>Это упражнение уже есть в шаблоне</DialogTitle><DialogDescription>Можно добавить ещё один независимый экземпляр с собственными настройками.</DialogDescription></DialogHeader><DialogFooter className="flex-wrap"><Button variant="ghost" onClick={() => setDuplicate(null)}>Отмена</Button><Button variant="outline" onClick={() => { const current = draft.exercises.find((item) => item.sourceExerciseId === duplicate?.sourceExerciseId || item.sourceExerciseKey === duplicate?.sourceExerciseKey); if (current) document.getElementById(`exercise-${current.instanceKey}`)?.scrollIntoView({ block: "center" }); setDuplicate(null); }}>Перейти к добавленному</Button><Button onClick={() => duplicate && acceptExercise(duplicate, true)} className="bg-lime-300 text-black">Добавить ещё раз</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(leaveTarget)} onOpenChange={(open) => { if (!open) setLeaveTarget(null); }}><DialogContent><DialogHeader><DialogTitle>{editorLocked ? "Операция ещё не завершена" : "Есть несохранённые изменения"}</DialogTitle><DialogDescription>{editorLocked ? "Сейчас определяется результат операции. Останьтесь в редакторе, чтобы не потерять подтверждение состояния." : "Сохраните черновик перед выходом или продолжите редактирование."}</DialogDescription></DialogHeader><DialogFooter className="flex-wrap"><Button variant="ghost" onClick={() => setLeaveTarget(null)}>Остаться</Button>{command.phase === "outcome_unknown" ? <Button variant="outline" onClick={() => { setLeaveTarget(null); void reconcile(); }}>{reconcileLabel(command.attempt?.operation)}</Button> : null}{!editorLocked ? <><Button variant="outline" onClick={discardAndLeave}>Выйти без сохранения</Button><Button onClick={() => void save({ exitTo: leaveTarget?.href })} className="bg-lime-300 text-black">Сохранить и выйти</Button></> : null}</DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(pendingConversion)} onOpenChange={(open) => { if (!open) setPendingConversion(null); }}><DialogContent><DialogHeader><DialogTitle>Изменить формат настроек?</DialogTitle><DialogDescription>При переходе будут очищены: {pendingConversion?.losses.join(", ")}. Изменение можно вернуть до следующего успешного сохранения.</DialogDescription></DialogHeader>{pendingConversion?.kind === "per_set" ? <BasicPrescriptionFields value={pendingConversion.resulting} prescriptionType={draft.exercises.find((item) => item.instanceKey === pendingConversion.instanceKey)?.prescriptionType ?? "repetitions"} onChange={(patch) => setPendingConversion((current) => current?.kind === "per_set" ? { ...current, resulting: { ...current.resulting, ...patch } } : current)} /> : null}<DialogFooter><Button variant="outline" onClick={() => setPendingConversion(null)}>Отмена</Button><Button onClick={confirmConversion} className="bg-lime-300 text-black">Применить итоговые значения</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function ValidationSummary({ issues, onIssue }: { issues: WorkoutTemplateEditorIssue[]; onIssue: (issue: WorkoutTemplateEditorIssue) => void }) {
  return <section aria-labelledby="editor-validation-heading" className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-4"><h2 id="editor-validation-heading" className="font-semibold text-amber-100">Что нужно заполнить перед публикацией</h2><ul className="mt-3 grid gap-2">{issues.map((issue, index) => <li key={`${issue.path}-${issue.code}-${index}`}><button type="button" data-issue-path={issue.path} onClick={() => onIssue(issue)} className="text-left text-sm text-zinc-300 underline-offset-4 hover:underline">{issue.path === "template.title" ? "Укажите название" : issue.path === "template.exercises" ? "Добавьте минимум одно упражнение" : "Проверьте настройки упражнения"}</button></li>)}</ul></section>;
}

function LifecycleContext({ title, text, tone = "neutral" }: { title: string; text: string; tone?: "neutral" | "danger" }) {
  return <section role={tone === "danger" ? "alert" : "status"} className={`mb-6 rounded-lg border p-4 ${tone === "danger" ? "border-rose-300/20 bg-rose-300/[0.04]" : "border-zinc-800 bg-zinc-950/60"}`}><h2 className="font-semibold text-zinc-100">{title}</h2><p className="mt-1 text-sm text-zinc-400">{text}</p></section>;
}

function BasicPrescriptionFields({ value, prescriptionType, onChange }: { value: BasicPrescription; prescriptionType: EditorExerciseDraft["prescriptionType"]; onChange: (patch: Partial<BasicPrescription>) => void }) {
  return <div className="grid gap-4 py-2 sm:grid-cols-2">
    <div className="sm:col-span-2"><p className="text-sm font-medium text-zinc-200">Итоговые общие значения</p><p className="mt-1 text-xs text-zinc-500">Проверьте их до удаления отдельных подходов.</p></div>
    <label className="grid gap-2"><Label htmlFor="conversion-set-count">Подходы</Label><Input id="conversion-set-count" type="number" min={1} max={20} value={value.setCount} onChange={(event) => onChange({ setCount: event.target.value })} /></label>
    {prescriptionType === "duration"
      ? <label className="grid gap-2"><Label htmlFor="conversion-duration">Длительность, сек</Label><Input id="conversion-duration" type="number" min={1} value={value.durationSec} onChange={(event) => onChange({ durationSec: event.target.value })} /></label>
      : <><label className="grid gap-2"><Label htmlFor="conversion-repetitions-min">Повторения от</Label><Input id="conversion-repetitions-min" type="number" min={1} value={value.repetitionsMin} onChange={(event) => onChange({ repetitionsMin: event.target.value })} /></label><label className="grid gap-2"><Label htmlFor="conversion-repetitions-max">Повторения до</Label><Input id="conversion-repetitions-max" type="number" min={1} value={value.repetitionsMax} onChange={(event) => onChange({ repetitionsMax: event.target.value })} /></label></>}
    <label className="grid gap-2"><Label htmlFor="conversion-weight">Целевой вес, кг</Label><Input id="conversion-weight" type="number" min={0} step="0.5" value={value.targetWeightKg} onChange={(event) => onChange({ targetWeightKg: event.target.value })} /></label>
    <label className="grid gap-2"><Label htmlFor="conversion-rest">Отдых, сек</Label><Input id="conversion-rest" type="number" min={0} value={value.restSec} onChange={(event) => onChange({ restSec: event.target.value })} /></label>
  </div>;
}

function PublishReceipt({ containerRef, model, handoff, restartHref, onContinue, onWorkspace, onView }: { containerRef: RefObject<HTMLElement | null>; model: WorkoutTemplateEditorReadModel; handoff: QuickAssignBuilderHandoff | null; restartHref: string | null; onContinue: () => void; onWorkspace: () => void; onView: () => void }) {
  const sets = model.content.exercises.reduce((sum, exercise) => sum + (exercise.prescription.setCount ?? exercise.sets.length), 0);
  const contextual = Boolean(handoff || restartHref);
  return <main ref={containerRef} tabIndex={-1} className="mx-auto mt-12 max-w-2xl rounded-lg border border-lime-300/20 bg-lime-300/[0.04] p-6 outline-none"><Check className="size-8 text-lime-300" /><h2 className="mt-5 text-2xl font-semibold text-zinc-50">Шаблон опубликован</h2><p className="mt-2 text-zinc-300">{model.content.title} · версия {model.identity?.selectedRevisionNumber}</p><p className="mt-1 text-sm text-zinc-500">{model.content.exercises.length} упражнений · {sets} подходов · доступен для назначения</p>{contextual ? <p className="mt-5 text-sm text-zinc-300">Шаблон сохранён. Назначение спортсмену подтверждается отдельно.</p> : null}<div className="mt-6 flex flex-wrap gap-2"><Button onClick={onContinue} className="min-h-11 bg-lime-300 text-black">{handoff ? "Перейти к назначению" : restartHref ? "Начать назначение заново" : "К шаблонам"}</Button>{contextual ? <Button variant="outline" onClick={onWorkspace} className="min-h-11 border-zinc-700">К шаблонам</Button> : null}<Button variant="ghost" onClick={onView} className="min-h-11">Посмотреть опубликованную версию</Button></div></main>;
}

function saveLabel(state: EditorSaveState, dirty: boolean, phase: "idle" | "running" | "outcome_unknown" | "failed" | "conflict", operation?: EditorCommandAttempt["operation"]) {
  if (phase === "running") return runningLabel(operation).replace("…", "");
  if (phase === "failed") return failedCommandLabel(operation);
  if (phase === "outcome_unknown") return operation === "publish" ? "Результат публикации неизвестен" : "Результат сохранения неизвестен";
  if (phase === "conflict") return "Конфликт изменений";
  return dirty ? "Есть несохранённые изменения" : state === "saved" ? "Сохранено" : "Без изменений";
}

function runningLabel(operation?: EditorCommandAttempt["operation"]) {
  if (operation === "publish") return "Публикуем…";
  if (operation === "create_revision") return "Создаём версию…";
  if (operation === "save_as_new") return "Создаём копию…";
  return "Сохраняем…";
}

function reconcileLabel(operation?: EditorCommandAttempt["operation"]) {
  if (operation === "publish") return "Проверить публикацию";
  if (operation === "create_revision") return "Проверить создание версии";
  return "Проверить сохранение";
}

function lifecycleLabel(model: WorkoutTemplateEditorReadModel) {
  if (model.mode === "new") return "Не сохранено";
  if (model.mode === "archived") return "В архиве";
  if (model.mode === "published") return `Опубликована версия ${model.identity?.selectedRevisionNumber}`;
  return `Черновик · Версия ${model.identity?.selectedRevisionNumber}`;
}

function mergeIssues(server: WorkoutTemplateEditorIssue[], local: WorkoutTemplateEditorIssue[]) {
  const seen = new Set<string>();
  return [...server, ...local].filter((issue) => { const key = `${issue.path}:${issue.code}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
