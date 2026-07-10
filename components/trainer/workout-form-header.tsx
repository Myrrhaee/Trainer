"use client";

import { Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function WorkoutFormHeader({
  onSave,
  onSaveAsTemplate,
  onCancel,
  saving,
}: {
  onSave: () => void;
  onSaveAsTemplate: () => void;
  onCancel: () => void;
  saving?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
          Конструктор тренировки
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
          Конструктор тренировки
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Соберите тренировку из упражнений и сохраните её в программу клиента.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
          onClick={onCancel}
        >
          <X className="mr-2 h-4 w-4" />
          Отменить
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
          onClick={onSaveAsTemplate}
          disabled={saving}
        >
          Сохранить как шаблон
        </Button>
        <Button
          type="button"
          className="rounded-full bg-zinc-100 text-black hover:bg-white"
          onClick={onSave}
          disabled={saving}
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Сохраняем..." : "Сохранить"}
        </Button>
      </div>
    </div>
  );
}
