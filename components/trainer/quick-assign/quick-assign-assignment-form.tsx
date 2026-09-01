"use client";

import { AlertTriangle, CalendarDays, CheckCircle2, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { QuickAssignReadModel } from "@/lib/server/quick-assign/quick-assign-types";
import type { QuickAssignClientState } from "./quick-assign-state";

export function QuickAssignAssignmentForm({
  model,
  state,
  errors,
  exactDuplicateId,
  sameDateConflict,
  fieldsDisabled,
  submitDisabled,
  onDateChange,
  onNoteChange,
  onConfirmSameDate,
  onSubmit,
  onRetryUnknown,
}: {
  model: QuickAssignReadModel;
  state: QuickAssignClientState;
  errors: Record<string, string>;
  exactDuplicateId: string | null;
  sameDateConflict: boolean;
  fieldsDisabled: boolean;
  submitDisabled: boolean;
  onDateChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onConfirmSameDate: (confirmed: boolean) => void;
  onSubmit: () => void;
  onRetryUnknown: () => void;
}) {
  const { draft, command } = state;
  const submitting = command.status === "submitting";
  const uncertain = command.status === "outcome_unknown";

  return (
    <section aria-labelledby="quick-assign-parameters-heading" className="border-t border-zinc-800 pt-5">
      <h2 id="quick-assign-parameters-heading" className="text-base font-semibold text-zinc-50">Параметры назначения</h2>
      {Object.keys(errors).length > 0 && command.status === "conflict" ? (
        <div tabIndex={-1} role="alert" className="mt-3 border-l-2 border-rose-300/70 px-3 text-sm text-rose-100 outline-none" data-quick-assign-error-summary>
          Проверьте параметры назначения перед повторной отправкой.
        </div>
      ) : null}

      <div className="mt-4 grid gap-5">
        <fieldset>
          <legend className="text-sm font-medium text-zinc-200">Дата тренировки</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex">
            <DateShortcut label="Сегодня" value={model.calendar.today} selected={draft.scheduledFor === model.calendar.today} disabled={fieldsDisabled} onSelect={onDateChange} />
            <DateShortcut label="Завтра" value={model.calendar.tomorrow} selected={draft.scheduledFor === model.calendar.tomorrow} disabled={fieldsDisabled} onSelect={onDateChange} />
            <div className="relative col-span-2 sm:min-w-48">
              <CalendarDays className="pointer-events-none absolute left-3 top-3.5 size-4 text-zinc-600" />
              <Input
                id="quick-assign-date"
                type="date"
                min={model.calendar.minScheduledFor}
                value={draft.scheduledFor}
                onChange={(event) => onDateChange(event.target.value)}
                disabled={fieldsDisabled}
                aria-label="Выбрать дату тренировки"
                aria-invalid={Boolean(errors.scheduledFor)}
                aria-describedby={errors.scheduledFor ? "quick-assign-date-error" : "quick-assign-timezone-copy"}
                className="h-11 border-zinc-800 bg-black pl-10"
              />
            </div>
          </div>
          {errors.scheduledFor ? <p id="quick-assign-date-error" className="mt-2 text-xs text-rose-200">{errors.scheduledFor}</p> : null}
          {model.calendar.timezoneAvailability === "unavailable" ? (
            <p id="quick-assign-timezone-copy" className="mt-2 text-xs leading-relaxed text-zinc-500">{model.calendar.fallbackExplanation}.</p>
          ) : null}
        </fieldset>

        <div>
          <div className="flex items-center justify-between gap-3"><Label htmlFor="quick-assign-note">Заметка спортсмену</Label><span className="text-xs text-zinc-500">{draft.trainerNote.length}/2000</span></div>
          <Textarea
            id="quick-assign-note"
            value={draft.trainerNote}
            onChange={(event) => onNoteChange(event.target.value)}
            disabled={fieldsDisabled}
            maxLength={2000}
            rows={3}
            placeholder="Необязательно: техника, ограничения или акцент"
            className="mt-2 min-h-24 resize-y border-zinc-800 bg-black"
          />
          <p className="mt-1 text-xs text-zinc-500">Заметка относится только к этому назначению и не меняет шаблон.</p>
        </div>

        <UpcomingSummary model={model} selectedDate={draft.scheduledFor} />

        {exactDuplicateId ? (
          <div className="border-l-2 border-rose-300/70 px-4 py-1" role="alert">
            <p className="text-sm font-medium text-rose-100">Эта версия уже назначена спортсмену на выбранную дату.</p>
            <a href={`/trainer/clients/${model.athlete.athleteUserId}?tab=training#next-assignment`} className="mt-2 inline-flex min-h-11 items-center text-sm text-zinc-300 underline underline-offset-4">Посмотреть в профиле</a>
          </div>
        ) : null}

        {sameDateConflict && !exactDuplicateId ? (
          <div className="border-l-2 border-amber-300/70 px-4 py-1">
            <p className="text-sm font-medium text-amber-100">На эту дату уже назначена другая тренировка.</p>
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={draft.allowAdditionalAssignment}
                onChange={(event) => onConfirmSameDate(event.target.checked)}
                disabled={fieldsDisabled}
                className="size-5 accent-lime-300"
              />
              Назначить ещё одну тренировку на эту дату
            </label>
          </div>
        ) : null}

        {command.status === "conflict" ? <CommandConflict code={command.code} /> : null}
        {uncertain ? (
          <div className="border-l-2 border-amber-300/70 px-4 py-1" role="alert">
            <p className="text-sm font-medium text-amber-100">Результат отправки пока неизвестен</p>
            <p className="mt-1 text-sm text-zinc-500">Проверьте исходную команду. Данные нельзя менять, пока результат не определён.</p>
            <Button type="button" variant="outline" onClick={onRetryUnknown} className="mt-3 min-h-11 border-zinc-700"><RotateCcw className="size-4" />Проверить и повторить</Button>
          </div>
        ) : null}

        {!uncertain ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled || submitting}
            className="min-h-12 w-full rounded-md bg-lime-300 text-black hover:bg-lime-200 sm:ml-auto sm:w-auto sm:min-w-56"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            {submitting ? "Назначаем…" : "Назначить тренировку"}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function DateShortcut({ label, value, selected, disabled, onSelect }: { label: string; value: string; selected: boolean; disabled: boolean; onSelect: (value: string) => void }) {
  return <Button type="button" variant="outline" aria-pressed={selected} disabled={disabled} onClick={() => onSelect(value)} className={selected ? "min-h-11 border-lime-300/50 bg-lime-300/10 text-lime-100" : "min-h-11 border-zinc-800 bg-black text-zinc-400"}>{label}</Button>;
}

function UpcomingSummary({ model, selectedDate }: { model: QuickAssignReadModel; selectedDate: string }) {
  const items = model.athlete.upcomingAssignments;
  return (
    <div className="border-y border-zinc-800 py-4">
      <div className="flex items-center justify-between gap-4"><p className="text-sm font-medium text-zinc-200">Будущие тренировки</p><span className="text-xs text-zinc-500">{model.athlete.upcomingAssignmentCount}</span></div>
      {items.length === 0 ? <p className="mt-2 text-sm text-zinc-500">Будущих тренировок нет.</p> : (
        <ul className="mt-2 grid gap-2">
          {items.slice(0, 3).map((item) => <li key={item.assignmentId} className="flex items-start justify-between gap-4 text-xs"><span className="min-w-0 break-words text-zinc-400">{item.title}</span><span className={item.scheduledFor === selectedDate ? "shrink-0 text-amber-200" : "shrink-0 text-zinc-500"}>{item.scheduledFor}</span></li>)}
        </ul>
      )}
      {items.length > 3 ? <p className="mt-2 text-xs text-zinc-500">И ещё {items.length - 3}</p> : null}
    </div>
  );
}

function CommandConflict({ code }: { code: string }) {
  const copy: Record<string, string> = {
    template_revision_stale: "Версия шаблона изменилась. Выберите актуальную версию самостоятельно.",
    template_unavailable: "Шаблон больше недоступен для назначения.",
    assignment_state_changed: "Будущие назначения изменились. Список обновлён, проверьте дату ещё раз.",
    assignment_duplicate: "Это назначение уже существует.",
    same_date_confirmation_required: "Подтвердите вторую тренировку на выбранную дату.",
    athlete_relation_changed: "Связь со спортсменом изменилась. Назначение недоступно.",
    assignment_forbidden: "Назначение недоступно. Вернитесь к списку спортсменов.",
    assignment_idempotency_conflict: "Данные попытки изменились. Начните новую отправку явно.",
    assignment_validation_failed: "Проверьте дату и заметку.",
    temporarily_unavailable: "Сервис временно недоступен. Значения сохранены.",
  };
  return <div tabIndex={-1} role="alert" className="flex gap-3 border-l-2 border-rose-300/70 px-4 py-1 outline-none focus-visible:ring-2 focus-visible:ring-rose-200" data-quick-assign-command-error><AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-200" /><p className="text-sm text-rose-100">{copy[code] ?? "Не удалось назначить тренировку. Проверьте данные и повторите."}</p></div>;
}
