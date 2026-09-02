"use client";

import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WorkoutTemplateEditorIssue } from "@/lib/workout-template-editor-contract";
import type { EditorDraftContent } from "./workout-template-editor-state";
import { issueLabel } from "./workout-template-editor-state";

type Props = {
  content: EditorDraftContent;
  editable: boolean;
  disabled?: boolean;
  limits: { title: number; description: number; category: number; generalInstruction: number };
  issues: WorkoutTemplateEditorIssue[];
  onChange: (content: EditorDraftContent) => void;
};

export function WorkoutTemplateInformation({ content, editable, disabled = false, limits, issues, onChange }: Props) {
  if (!editable) return (
    <section aria-labelledby="template-information-heading" className="border-b border-zinc-800 pb-7">
      <h2 id="template-information-heading" className="text-base font-semibold text-zinc-100">О шаблоне</h2>
      <dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <ReadFact label="Название" value={content.title || "Без названия"} />
        <ReadFact label="Категория" value={content.category || "Не указана"} />
        <ReadFact label="Ориентировочная длительность" value={content.estimatedDurationMin ? `${content.estimatedDurationMin} мин` : "Не указана"} />
        <ReadFact label="Описание" value={content.description || "Нет описания"} />
        <div className="sm:col-span-2"><ReadFact label="Общая инструкция" value={content.generalInstruction || "Нет общей инструкции"} /></div>
      </dl>
    </section>
  );

  return (
    <section aria-labelledby="template-information-heading" className="border-b border-zinc-800 pb-7">
      <div className="flex items-end justify-between gap-3"><div><h2 id="template-information-heading" className="text-base font-semibold text-zinc-100">О шаблоне</h2><p className="mt-1 text-sm text-zinc-500">Черновик можно сохранить незавершённым.</p></div></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Название" id="template-title" issue={findIssue(issues, "template.title")} count={content.title.length} limit={limits.title}>
          <Input id="template-title" value={content.title} maxLength={limits.title} disabled={disabled} aria-invalid={Boolean(findIssue(issues, "template.title"))} onChange={(event) => onChange({ ...content, title: event.target.value })} placeholder="Например, Силовая тренировка A" className="h-11 border-zinc-800 bg-black" />
        </Field>
        <Field label="Категория" id="template-category" count={content.category.length} limit={limits.category}>
          <Input id="template-category" value={content.category} maxLength={limits.category} disabled={disabled} onChange={(event) => onChange({ ...content, category: event.target.value })} placeholder="Например, Сила" className="h-11 border-zinc-800 bg-black" />
        </Field>
        <Field label="Описание" id="template-description" count={content.description.length} limit={limits.description}>
          <Textarea id="template-description" value={content.description} maxLength={limits.description} disabled={disabled} onChange={(event) => onChange({ ...content, description: event.target.value })} placeholder="Коротко опишите назначение шаблона" className="min-h-24 border-zinc-800 bg-black" />
        </Field>
        <div className="grid content-start gap-5">
          <Field label="Ориентировочная длительность, мин" id="template-duration">
            <Input id="template-duration" type="number" min={1} max={600} value={content.estimatedDurationMin} disabled={disabled} onChange={(event) => onChange({ ...content, estimatedDurationMin: event.target.value })} className="h-11 border-zinc-800 bg-black" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Общая инструкция" id="template-instruction" count={content.generalInstruction.length} limit={limits.generalInstruction}>
            <Textarea id="template-instruction" value={content.generalInstruction} maxLength={limits.generalInstruction} disabled={disabled} onChange={(event) => onChange({ ...content, generalInstruction: event.target.value })} placeholder="Что спортсмен должен учитывать в этой тренировке" className="min-h-24 border-zinc-800 bg-black" />
          </Field>
        </div>
      </div>
    </section>
  );
}

function Field({ label, id, issue, count, limit, children }: { label: string; id: string; issue?: WorkoutTemplateEditorIssue; count?: number; limit?: number; children: ReactNode }) {
  const showCount = typeof count === "number" && typeof limit === "number" && (count >= limit * 0.8 || Boolean(issue));
  return <div><div className="mb-2 flex items-center justify-between gap-3"><Label htmlFor={id} className="text-sm text-zinc-300">{label}</Label>{showCount ? <span className="text-xs text-zinc-600">{count}/{limit}</span> : null}</div>{children}{issue ? <p className="mt-2 text-xs text-rose-200">{issueLabel(issue)}</p> : null}</div>;
}

function ReadFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-zinc-600">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value}</dd></div>;
}

function findIssue(issues: WorkoutTemplateEditorIssue[], path: string) {
  return issues.find((issue) => issue.path === path);
}
