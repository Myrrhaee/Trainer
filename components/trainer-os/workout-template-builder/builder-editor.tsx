"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Dumbbell,
  Eye,
  GripVertical,
  Layers3,
  Library,
  Loader2,
  Menu,
  PanelRight,
  Plus,
  Save,
  Send,
  Trash2,
  Ungroup,
} from "lucide-react";

import { ExerciseDetailSheet } from "@/components/trainer/exercise-detail-sheet";
import { ExerciseLibraryPanel } from "@/components/trainer/exercise-library-panel";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ExerciseLibraryRow } from "@/lib/exercise-library";
import { EXERCISE_FILTER_CATEGORIES, matchesExerciseCategory } from "@/lib/exercise-categories";
import { cn } from "@/lib/utils";

import {
  createBuilderId,
  createExerciseInstance,
  findExerciseInstance,
  getPrescriptionSummary,
  getTemplateExercises,
  removeExerciseInstance,
  type SupersetGroupDraft,
  type TemplateValidationResult,
  type WorkoutTemplateDraft,
  type WorkoutTemplateExerciseDraft,
  type WorkoutTemplateItemDraft,
} from "./builder-model";
import { ExerciseInspector } from "./exercise-inspector";
import { TemplateStatusBadge } from "./templates-workspace";

type ConfirmState =
  | { kind: "remove"; exercise: WorkoutTemplateExerciseDraft }
  | { kind: "duplicate"; exercise: WorkoutTemplateExerciseDraft }
  | { kind: "add-duplicate"; exercise: ExerciseLibraryRow }
  | null;

export function BuilderEditor({
  draft,
  libraryExercises,
  athleteId,
  dirty,
  validation,
  commandState,
  selectedExerciseId,
  onDraftChange,
  onSelectedExerciseChange,
  onBack,
  onSaveDraft,
  onPublish,
  onCreateRevision,
  onDuplicateTemplate,
  onPreview,
  onAssign,
  onSaveAndAssign,
}: {
  draft: WorkoutTemplateDraft;
  libraryExercises: ExerciseLibraryRow[];
  athleteId?: string;
  dirty: boolean;
  validation: TemplateValidationResult;
  commandState: { status: "idle" | "running" | "failed"; kind?: "save" | "publish" | "publish-and-assign" | "revision" };
  selectedExerciseId: string | null;
  onDraftChange: (draft: WorkoutTemplateDraft) => void;
  onSelectedExerciseChange: (id: string | null) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  onCreateRevision: () => void;
  onDuplicateTemplate: () => void;
  onPreview: () => void;
  onAssign: () => void;
  onSaveAndAssign: () => void;
}) {
  const locked = draft.status !== "draft";
  const busy = commandState.status === "running";
  const selectedExercise = selectedExerciseId ? findExerciseInstance(draft, selectedExerciseId) : null;
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [selectedLibraryExercise, setSelectedLibraryExercise] = useState<ExerciseLibraryRow | null>(null);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"mine" | "system">("system");
  const [category, setCategory] = useState("Все");
  const [equipment, setEquipment] = useState("Всё оборудование");
  const [selectedForSuperset, setSelectedForSuperset] = useState<Set<string>>(() => new Set());
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const visibleLibrary = useMemo(() => libraryExercises.filter((exercise) => {
    if (scope === "mine" && exercise.is_system) return false;
    if (scope === "system" && !exercise.is_system) return false;
    if (!matchesExerciseCategory(exercise, category)) return false;
    if (equipment !== "Всё оборудование" && exercise.equipment !== equipment) return false;
    const haystack = [exercise.title, exercise.muscle_group, exercise.equipment, exercise.description, ...exercise.muscle_groups].filter(Boolean).join(" ").toLocaleLowerCase("ru");
    return haystack.includes(search.trim().toLocaleLowerCase("ru"));
  }), [category, equipment, libraryExercises, scope, search]);
  const equipmentOptions = useMemo(() => Array.from(new Set(libraryExercises.map((exercise) => exercise.equipment).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, "ru")), [libraryExercises]);

  function addExercise(exercise: ExerciseLibraryRow, force = false) {
    if (!force && getTemplateExercises(draft).some((item) => item.exerciseId === exercise.id)) {
      setConfirm({ kind: "add-duplicate", exercise });
      return;
    }
    const instance = createExerciseInstance(exercise);
    onDraftChange({ ...draft, items: [...draft.items, { id: instance.instanceId, kind: "exercise", exercise: instance }] });
    onSelectedExerciseChange(instance.instanceId);
    setLibraryOpen(false);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-exercise-id="${instance.instanceId}"]`)?.focus());
  }

  function updateExercise(exercise: WorkoutTemplateExerciseDraft) {
    onDraftChange({
      ...draft,
      items: draft.items.map((item) => {
        if (item.kind === "exercise") return item.exercise.instanceId === exercise.instanceId ? { ...item, exercise } : item;
        return { ...item, exercises: item.exercises.map((value) => value.instanceId === exercise.instanceId ? exercise : value) };
      }),
    });
  }

  function duplicateExercise(exercise: WorkoutTemplateExerciseDraft) {
    const copy = copyExercise(exercise);
    const nextItems = draft.items.flatMap((item) => {
      if (item.kind === "exercise" && item.exercise.instanceId === exercise.instanceId) return [item, { id: copy.instanceId, kind: "exercise", exercise: copy } as WorkoutTemplateItemDraft];
      if (item.kind === "superset" && item.exercises.some((value) => value.instanceId === exercise.instanceId) && item.exercises.length < 4) {
        const index = item.exercises.findIndex((value) => value.instanceId === exercise.instanceId);
        const exercises = [...item.exercises];
        exercises.splice(index + 1, 0, copy);
        return [{ ...item, exercises }];
      }
      return [item];
    });
    onDraftChange({ ...draft, items: nextItems });
    onSelectedExerciseChange(copy.instanceId);
  }

  function removeExercise(exercise: WorkoutTemplateExerciseDraft) {
    onDraftChange(removeExerciseInstance(draft, exercise.instanceId));
    if (selectedExerciseId === exercise.instanceId) onSelectedExerciseChange(null);
    setSelectedForSuperset((current) => {
      const next = new Set(current);
      next.delete(exercise.instanceId);
      return next;
    });
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    const index = draft.items.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= draft.items.length) return;
    const items = [...draft.items];
    [items[index], items[target]] = [items[target], items[index]];
    onDraftChange({ ...draft, items });
  }

  function moveItemTo(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    const source = draft.items.findIndex((item) => item.id === sourceId);
    const target = draft.items.findIndex((item) => item.id === targetId);
    if (source < 0 || target < 0) return;
    const items = [...draft.items];
    const [moved] = items.splice(source, 1);
    items.splice(target, 0, moved);
    onDraftChange({ ...draft, items });
  }

  function createSuperset() {
    const selected = draft.items.filter((item) => item.kind === "exercise" && selectedForSuperset.has(item.exercise.instanceId)) as Array<{ id: string; kind: "exercise"; exercise: WorkoutTemplateExerciseDraft }>;
    if (selected.length < 2 || selected.length > 4) return;
    const firstIndex = Math.min(...selected.map((item) => draft.items.findIndex((value) => value.id === item.id)));
    const remaining = draft.items.filter((item) => item.kind !== "exercise" || !selectedForSuperset.has(item.exercise.instanceId));
    const group: SupersetGroupDraft = { id: createBuilderId("superset"), kind: "superset", label: "Новый суперсет", instruction: "Выполнить упражнения последовательно; отдых после последнего.", exercises: selected.map((item) => item.exercise) };
    remaining.splice(firstIndex, 0, group);
    onDraftChange({ ...draft, items: remaining });
    setSelectedForSuperset(new Set());
  }

  function ungroup(group: SupersetGroupDraft) {
    const items = draft.items.flatMap((item) => item.id === group.id ? group.exercises.map((exercise) => ({ id: exercise.instanceId, kind: "exercise" as const, exercise })) : [item]);
    onDraftChange({ ...draft, items });
  }

  function moveInsideGroup(group: SupersetGroupDraft, exerciseId: string, direction: -1 | 1) {
    const index = group.exercises.findIndex((exercise) => exercise.instanceId === exerciseId);
    const target = index + direction;
    if (target < 0 || target >= group.exercises.length) return;
    const exercises = [...group.exercises];
    [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
    onDraftChange({ ...draft, items: draft.items.map((item) => item.id === group.id ? { ...group, exercises } : item) });
  }

  function updateGroup(group: SupersetGroupDraft, patch: Partial<SupersetGroupDraft>) {
    onDraftChange({ ...draft, items: draft.items.map((item) => item.id === group.id ? { ...group, ...patch } : item) });
  }

  const library = (
    <ExerciseLibraryPanel exercises={visibleLibrary} search={search} onSearchChange={setSearch} scope={scope} onScopeChange={setScope} category={category} onCategoryChange={setCategory} equipment={equipment} onEquipmentChange={setEquipment} categories={[...EXERCISE_FILTER_CATEGORIES]} equipmentOptions={equipmentOptions} loading={false} copyingId={null} addLabel="Добавить в шаблон" modeHint="Добавление кнопкой доступно на desktop, keyboard и touch." onAdd={addExercise} onAddToMine={() => undefined} onInspect={setSelectedLibraryExercise} />
  );

  return (
    <main className="min-h-screen bg-black pb-28 text-zinc-100 lg:pb-8">
      <header className="z-30 border-b border-zinc-800 bg-black/94 px-4 py-3 backdrop-blur-xl sm:px-6 lg:sticky lg:top-[112px] lg:px-8">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" size="icon-lg" variant="ghost" onClick={onBack} disabled={busy} aria-label="Вернуться к шаблонам" className="shrink-0 rounded-full text-zinc-400"><ArrowLeft className="size-5" /></Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><TemplateStatusBadge status={draft.status} /><span className="text-xs text-zinc-600">версия {draft.revision}</span>{busy ? <span role="status" className="inline-flex items-center gap-1.5 text-xs text-lime-200"><Loader2 className="size-3 animate-spin" />{builderCommandLabel(commandState.kind)}</span> : dirty ? <span className="inline-flex items-center gap-1 text-xs text-amber-200"><span className="size-1.5 rounded-full bg-amber-300" />Есть несохранённые изменения</span> : <span className="inline-flex items-center gap-1 text-xs text-zinc-600"><Check className="size-3" />Сохранено</span>}</div>
              <Input id="template-title" aria-label="Название шаблона" value={draft.title} disabled={locked} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} className="mt-1 h-9 max-w-xl border-0 bg-transparent px-0 text-xl font-semibold text-zinc-50 shadow-none focus-visible:ring-0 disabled:opacity-100" />
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2 pb-1 [&>button]:min-w-[calc(50%-0.25rem)] [&>button]:flex-1 xl:flex-nowrap xl:justify-end xl:pb-0 xl:[&>button]:min-w-0 xl:[&>button]:flex-none">
            <Button type="button" variant="outline" onClick={onPreview} disabled={busy} className="min-h-11 shrink-0 rounded-full border-zinc-700 text-zinc-200"><Eye className="size-4" />Предпросмотр</Button>
            <Button type="button" variant="outline" onClick={onDuplicateTemplate} disabled={busy} className="min-h-11 shrink-0 rounded-full border-zinc-700 text-zinc-200"><Copy className="size-4" />Дублировать</Button>
            {draft.status === "draft" ? <><Button type="button" variant="outline" onClick={onSaveDraft} disabled={busy || !dirty} className="min-h-11 shrink-0 rounded-full border-zinc-700 text-zinc-100">{busy && commandState.kind === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{busy && commandState.kind === "save" ? "Сохраняем…" : "Сохранить черновик"}</Button><Button type="button" onClick={onPublish} disabled={busy} className="min-h-11 shrink-0 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">{busy && commandState.kind === "publish" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{busy && commandState.kind === "publish" ? "Публикуем…" : "Опубликовать"}</Button>{athleteId ? <Button type="button" variant="outline" onClick={onSaveAndAssign} disabled={busy} className="min-h-11 shrink-0 rounded-full border-lime-300/35 text-lime-100">{busy && commandState.kind === "publish-and-assign" ? <Loader2 className="size-4 animate-spin" /> : <Dumbbell className="size-4" />}{busy && commandState.kind === "publish-and-assign" ? "Публикуем…" : "Опубликовать и перейти к назначению"}</Button> : null}</> : draft.status === "published" ? <><Button type="button" onClick={onCreateRevision} disabled={busy} className="min-h-11 shrink-0 rounded-full bg-lime-300 px-4 text-black hover:bg-lime-200">{busy && commandState.kind === "revision" ? <Loader2 className="size-4 animate-spin" /> : <FileRevisionIcon />}{busy && commandState.kind === "revision" ? "Создаём…" : "Создать новую версию"}</Button>{athleteId ? <Button type="button" variant="outline" onClick={onAssign} disabled={busy} className="min-h-11 shrink-0 rounded-full border-lime-300/30 text-lime-100"><Dumbbell className="size-4" />Перейти к назначению</Button> : null}</> : null}
          </div>
        </div>
      </header>

      <div aria-busy={busy} className={cn("mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-4 transition-opacity sm:px-6 lg:px-8 xl:grid-cols-[320px_minmax(420px,1fr)_360px] xl:items-start", busy && "pointer-events-none opacity-70")}>
        <aside aria-label="Библиотека упражнений" className="hidden min-w-0 xl:sticky xl:top-[104px] xl:block xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">{locked ? <LockedPanel text="Опубликованный шаблон нельзя изменить. Создайте новую версию, чтобы добавить упражнение." /> : library}</aside>

        <section className="min-w-0">
          <div className="mb-4 flex gap-2 xl:hidden">
            <Button type="button" variant="outline" onClick={() => setLibraryOpen(true)} disabled={locked} className="min-h-11 flex-1 rounded-full border-zinc-700 text-zinc-200"><Library className="size-4" />Библиотека</Button>
            <Button type="button" variant="outline" onClick={() => setInspectorOpen(true)} disabled={!selectedExercise} className="min-h-11 flex-1 rounded-full border-zinc-700 text-zinc-200"><PanelRight className="size-4" />Настройки</Button>
          </div>

          {athleteId ? <div className="mb-4 rounded-lg border border-lime-300/20 bg-lime-300/[0.055] px-4 py-3"><p className="text-xs font-medium uppercase text-lime-200/70">Спортсмен выбран</p><p className="mt-1 text-sm text-zinc-400">После публикации вы сможете сразу назначить эту тренировку.</p></div> : null}

          <GeneralSettings draft={draft} locked={locked} onChange={onDraftChange} />

          {validation.errors.length || validation.warnings.length ? <ValidationSummary validation={validation} /> : null}

          <section id="workout-canvas" aria-labelledby="workout-canvas-heading" className="mt-4 min-w-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-medium uppercase text-lime-200/70">Порядок упражнений</p><h2 id="workout-canvas-heading" className="mt-1 text-2xl font-semibold text-zinc-50">Структура тренировки</h2><p className="mt-1 text-sm text-zinc-500">{getTemplateExercises(draft).length} упражнений · {draft.items.length} блоков</p></div>
              {!locked && selectedForSuperset.size ? <Button type="button" onClick={createSuperset} disabled={selectedForSuperset.size < 2 || selectedForSuperset.size > 4} className="min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200"><Layers3 className="size-4" />Объединить ({selectedForSuperset.size})</Button> : null}
            </div>

            {draft.items.length ? (
              <ol className="mt-4 grid gap-3" aria-label="Порядок блоков тренировки">
                {draft.items.map((item, index) => (
                  <li key={item.id} draggable={!locked} onDragStart={() => setDraggedItemId(item.id)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedItemId) moveItemTo(draggedItemId, item.id); setDraggedItemId(null); }}>
                    {item.kind === "exercise" ? <ExerciseCanvasCard exercise={item.exercise} order={index + 1} selected={selectedExerciseId === item.exercise.instanceId} checked={selectedForSuperset.has(item.exercise.instanceId)} locked={locked} canMoveUp={index > 0} canMoveDown={index < draft.items.length - 1} onSelect={() => { onSelectedExerciseChange(item.exercise.instanceId); setInspectorOpen(true); }} onCheck={(checked) => setSelectedForSuperset((current) => { const next = new Set(current); if (checked) next.add(item.exercise.instanceId); else next.delete(item.exercise.instanceId); return next; })} onMove={(direction) => moveItem(item.id, direction)} onDuplicate={() => setConfirm({ kind: "duplicate", exercise: item.exercise })} onRemove={() => setConfirm({ kind: "remove", exercise: item.exercise })} /> : <SupersetCanvasBlock group={item} order={index + 1} locked={locked} selectedExerciseId={selectedExerciseId} canMoveUp={index > 0} canMoveDown={index < draft.items.length - 1} onMove={(direction) => moveItem(item.id, direction)} onSelect={(id) => { onSelectedExerciseChange(id); setInspectorOpen(true); }} onUpdate={(patch) => updateGroup(item, patch)} onUngroup={() => ungroup(item)} onMoveInside={(id, direction) => moveInsideGroup(item, id, direction)} onRemoveExercise={(exercise) => setConfirm({ kind: "remove", exercise })} />}
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-950/45 px-6 py-12 text-center"><Dumbbell className="mx-auto size-7 text-zinc-600" /><h3 className="mt-4 text-lg font-semibold text-zinc-100">Добавьте первое упражнение</h3><p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">Выберите упражнение в библиотеке. Черновик можно сохранить и с пустой структурой.</p>{!locked ? <Button type="button" onClick={() => setLibraryOpen(true)} className="mt-5 min-h-11 rounded-full bg-lime-300 text-black hover:bg-lime-200 xl:hidden"><Plus className="size-4" />Добавить упражнение</Button> : null}</div>
            )}
          </section>
        </section>

        <aside aria-label="Инспектор упражнения" className="hidden min-w-0 xl:sticky xl:top-[104px] xl:block xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto"><ExerciseInspector exercise={selectedExercise} locked={locked} onChange={updateExercise} /></aside>
      </div>

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}><SheetContent side="right" className="!w-[calc(100vw-8px)] !max-w-[720px] overflow-y-auto border-zinc-800 bg-black p-3 text-zinc-100 sm:!max-w-[720px]"><SheetHeader className="pr-10"><SheetTitle className="text-zinc-50">Библиотека упражнений</SheetTitle><SheetDescription className="text-zinc-500">Найдите упражнение и добавьте его в тренировку.</SheetDescription></SheetHeader>{library}</SheetContent></Sheet>
      <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}><SheetContent side="right" className="!w-[calc(100vw-8px)] !max-w-[640px] overflow-y-auto border-zinc-800 bg-black p-3 text-zinc-100 sm:!max-w-[640px]"><SheetHeader className="pr-10"><SheetTitle className="text-zinc-50">Настройки упражнения</SheetTitle><SheetDescription className="text-zinc-500">Настройте подходы, повторения, вес и заметку спортсмену.</SheetDescription></SheetHeader><ExerciseInspector exercise={selectedExercise} locked={locked} onChange={updateExercise} /></SheetContent></Sheet>
      <ExerciseDetailSheet exercise={selectedLibraryExercise} onClose={() => setSelectedLibraryExercise(null)} />

      <Dialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="max-w-[calc(100vw-32px)] border-zinc-800 bg-zinc-950 sm:max-w-md">
          <DialogHeader><DialogTitle>{confirm?.kind === "remove" ? "Удалить упражнение?" : "Добавить ещё одну копию?"}</DialogTitle><DialogDescription className="text-zinc-400">{confirm?.kind === "remove" ? "Упражнение исчезнет из черновика, но останется в библиотеке." : "Можно добавить одно упражнение несколько раз и настроить каждую копию отдельно."}</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col-reverse sm:flex-row"><Button type="button" variant="outline" onClick={() => setConfirm(null)} className="min-h-11 rounded-full border-zinc-700 text-zinc-100">Отмена</Button><Button type="button" onClick={() => { if (confirm?.kind === "remove") removeExercise(confirm.exercise); if (confirm?.kind === "duplicate") duplicateExercise(confirm.exercise); if (confirm?.kind === "add-duplicate") addExercise(confirm.exercise, true); setConfirm(null); }} className={cn("min-h-11 rounded-full", confirm?.kind === "remove" ? "bg-rose-300 text-black hover:bg-rose-200" : "bg-lime-300 text-black hover:bg-lime-200")}>{confirm?.kind === "remove" ? "Удалить" : "Добавить копию"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function GeneralSettings({ draft, locked, onChange }: { draft: WorkoutTemplateDraft; locked: boolean; onChange: (draft: WorkoutTemplateDraft) => void }) {
  return <section aria-labelledby="general-settings-heading" className="rounded-lg border border-zinc-800 bg-zinc-950/72 p-4"><div><p className="text-xs font-medium uppercase text-zinc-500">Общие настройки</p><h2 id="general-settings-heading" className="mt-1 text-lg font-semibold text-zinc-100">Описание шаблона</h2></div><fieldset disabled={locked} className="mt-4 grid min-w-0 gap-3 disabled:opacity-70"><div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_180px]"><div><Label htmlFor="template-description" className="text-sm text-zinc-300">Короткое описание</Label><Input id="template-description" value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} placeholder="Для чего подходит эта тренировка" className="mt-2 h-11 min-w-0 border-zinc-800 bg-black/30 text-zinc-100" /></div><div><Label htmlFor="template-category-field" className="text-sm text-zinc-300">Цель / категория</Label><Input id="template-category-field" value={draft.category} onChange={(event) => onChange({ ...draft, category: event.target.value })} placeholder="Сила" className="mt-2 h-11 border-zinc-800 bg-black/30 text-zinc-100" /></div></div><div className="grid min-w-0 gap-3 sm:grid-cols-[140px_1fr]"><div><Label htmlFor="template-duration" className="text-sm text-zinc-300">Время, мин</Label><Input id="template-duration" type="number" min="1" value={draft.estimatedDurationMin} onChange={(event) => onChange({ ...draft, estimatedDurationMin: event.target.value })} className="mt-2 h-11 border-zinc-800 bg-black/30 text-zinc-100" /></div><div><Label htmlFor="template-instruction" className="text-sm text-zinc-300">Общая инструкция</Label><Textarea id="template-instruction" value={draft.generalInstruction} onChange={(event) => onChange({ ...draft, generalInstruction: event.target.value })} placeholder="Что спортсмен должен учитывать в этой тренировке" className="mt-2 min-h-20 border-zinc-800 bg-black/30 text-zinc-100" /></div></div></fieldset>{locked ? <p className="mt-3 text-xs text-zinc-500">Опубликованный или архивный шаблон открыт только для чтения.</p> : null}</section>;
}

function ExerciseCanvasCard({ exercise, order, selected, checked, locked, canMoveUp, canMoveDown, onSelect, onCheck, onMove, onDuplicate, onRemove }: { exercise: WorkoutTemplateExerciseDraft; order: number; selected: boolean; checked: boolean; locked: boolean; canMoveUp: boolean; canMoveDown: boolean; onSelect: () => void; onCheck: (checked: boolean) => void; onMove: (direction: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void }) {
  return <article data-exercise-id={exercise.instanceId} tabIndex={-1} className={cn("rounded-lg border bg-zinc-950/74 p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60 motion-reduce:transition-none", selected ? "border-lime-300/45" : "border-zinc-800 hover:border-zinc-700")}><div className="flex min-w-0 flex-wrap items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-sm text-zinc-400">{order}</span><button type="button" onClick={onSelect} className="min-w-[180px] flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60"><h3 className="truncate font-semibold text-zinc-100">{exercise.title}</h3><p className="mt-1 text-sm text-zinc-500">{getPrescriptionSummary(exercise)}</p><div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600"><span>{exercise.category}</span>{exercise.perSetMode ? <span>Индивидуальные подходы</span> : null}{exercise.trainerNote ? <span>Есть заметка</span> : null}</div></button>{!locked ? <div className="flex w-full shrink-0 items-center justify-end gap-1 border-t border-zinc-800 pt-2 sm:w-auto sm:border-0 sm:pt-0"><label title="Выбрать для суперсета" className="flex size-10 cursor-pointer items-center justify-center rounded-full hover:bg-zinc-900"><input type="checkbox" checked={checked} onChange={(event) => onCheck(event.target.checked)} aria-label={`Выбрать ${exercise.title} для суперсета`} className="size-4 accent-lime-300" /></label><GripVertical className="hidden size-4 text-zinc-700 sm:block" aria-label="Можно перетащить" /><CanvasActions canMoveUp={canMoveUp} canMoveDown={canMoveDown} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} /></div> : null}</div></article>;
}

function SupersetCanvasBlock({ group, order, locked, selectedExerciseId, canMoveUp, canMoveDown, onMove, onSelect, onUpdate, onUngroup, onMoveInside, onRemoveExercise }: { group: SupersetGroupDraft; order: number; locked: boolean; selectedExerciseId: string | null; canMoveUp: boolean; canMoveDown: boolean; onMove: (direction: -1 | 1) => void; onSelect: (id: string) => void; onUpdate: (patch: Partial<SupersetGroupDraft>) => void; onUngroup: () => void; onMoveInside: (id: string, direction: -1 | 1) => void; onRemoveExercise: (exercise: WorkoutTemplateExerciseDraft) => void }) {
  return <section aria-label={`Суперсет ${group.label}`} className="rounded-lg border border-lime-300/25 bg-lime-300/[0.04] p-3"><div className="flex flex-wrap items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-lime-300/25 text-sm text-lime-100">{order}</span><div className="min-w-[180px] flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-lime-300/25 px-2 py-1 text-xs text-lime-100">Суперсет · {group.exercises.length}</span>{locked ? <h3 className="font-semibold text-zinc-100">{group.label}</h3> : <Input aria-label="Название суперсета" value={group.label} onChange={(event) => onUpdate({ label: event.target.value })} className="h-9 min-w-[180px] flex-1 border-zinc-800 bg-black/25 text-zinc-100" />}</div>{locked ? <p className="mt-2 text-sm text-zinc-500">{group.instruction}</p> : <Input aria-label="Инструкция суперсета" value={group.instruction} onChange={(event) => onUpdate({ instruction: event.target.value })} className="mt-2 h-9 border-zinc-800 bg-black/25 text-zinc-300" />}</div>{!locked ? <div className="flex w-full justify-end gap-1 border-t border-lime-300/15 pt-2 sm:w-auto sm:border-0 sm:pt-0"><IconAction label="Поднять суперсет" disabled={!canMoveUp} onClick={() => onMove(-1)}><ArrowUp /></IconAction><IconAction label="Опустить суперсет" disabled={!canMoveDown} onClick={() => onMove(1)}><ArrowDown /></IconAction><IconAction label="Разъединить суперсет" onClick={onUngroup}><Ungroup /></IconAction></div> : null}</div><ol className="mt-3 grid gap-2 border-t border-lime-300/15 pt-3">{group.exercises.map((exercise, index) => <li key={exercise.instanceId} className={cn("flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-3 py-2", selectedExerciseId === exercise.instanceId ? "border-lime-300/40 bg-black/35" : "border-zinc-800 bg-black/20")}><span className="text-xs font-semibold text-lime-200">A{index + 1}</span><button type="button" onClick={() => onSelect(exercise.instanceId)} className="min-w-[180px] flex-1 text-left"><span className="block truncate text-sm font-medium text-zinc-100">{exercise.title}</span><span className="mt-0.5 block text-xs text-zinc-600">{getPrescriptionSummary(exercise)}</span></button>{!locked ? <div className="flex w-full justify-end sm:w-auto"><IconAction label={`Поднять ${exercise.title} внутри суперсета`} disabled={index === 0} onClick={() => onMoveInside(exercise.instanceId, -1)}><ArrowUp /></IconAction><IconAction label={`Опустить ${exercise.title} внутри суперсета`} disabled={index === group.exercises.length - 1} onClick={() => onMoveInside(exercise.instanceId, 1)}><ArrowDown /></IconAction><IconAction label={`Удалить ${exercise.title} из суперсета`} onClick={() => onRemoveExercise(exercise)}><Trash2 /></IconAction></div> : null}</li>)}</ol></section>;
}

function CanvasActions({ canMoveUp, canMoveDown, onMove, onDuplicate, onRemove }: { canMoveUp: boolean; canMoveDown: boolean; onMove: (direction: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void }) {
  return <div className="flex"><IconAction label="Поднять упражнение" disabled={!canMoveUp} onClick={() => onMove(-1)}><ArrowUp /></IconAction><IconAction label="Опустить упражнение" disabled={!canMoveDown} onClick={() => onMove(1)}><ArrowDown /></IconAction><IconAction label="Дублировать упражнение" onClick={onDuplicate}><Copy /></IconAction><IconAction label="Удалить упражнение" onClick={onRemove}><Trash2 /></IconAction></div>;
}

function IconAction({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="flex size-10 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-25 [&_svg]:size-4">{children}</button>;
}

function ValidationSummary({ validation }: { validation: TemplateValidationResult }) {
  return <section aria-labelledby="validation-heading" aria-live="polite" className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/72 p-4"><div className="flex items-center gap-2"><AlertTriangle className={cn("size-4", validation.errors.length ? "text-orange-200" : "text-amber-200")} /><h2 id="validation-heading" className="font-semibold text-zinc-100">Проверка шаблона</h2></div><div className="mt-3 grid gap-2">{[...validation.errors, ...validation.warnings].map((issue) => <button key={issue.id} type="button" onClick={() => { if (issue.itemId) document.querySelector(`[data-exercise-id="${issue.itemId}"]`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" }); else if (issue.field) document.getElementById(issue.field)?.focus(); }} className={cn("min-h-11 rounded-lg border px-3 text-left text-sm", issue.severity === "error" ? "border-orange-300/25 bg-orange-300/[0.06] text-orange-100" : "border-amber-300/20 bg-amber-300/[0.04] text-amber-100/80")}>{issue.severity === "error" ? "Ошибка: " : "Совет: "}{issue.message}</button>)}</div></section>;
}

function LockedPanel({ text }: { text: string }) {
  return <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-5"><Archive className="size-5 text-zinc-600" /><p className="mt-3 text-sm leading-relaxed text-zinc-500">{text}</p></div>;
}

function copyExercise(source: WorkoutTemplateExerciseDraft) {
  const instanceId = createBuilderId("exercise-instance");
  return { ...source, instanceId, prescription: { ...source.prescription }, setOverrides: source.setOverrides.map((set, index) => ({ ...set, id: `${instanceId}-set-${index + 1}` })) };
}

function FileRevisionIcon() {
  return <Menu className="size-4" />;
}

function builderCommandLabel(kind?: "save" | "publish" | "publish-and-assign" | "revision") {
  if (kind === "save") return "Сохраняем черновик…";
  if (kind === "publish-and-assign") return "Публикуем перед назначением…";
  if (kind === "publish") return "Публикуем версию…";
  return "Создаём новую версию…";
}
