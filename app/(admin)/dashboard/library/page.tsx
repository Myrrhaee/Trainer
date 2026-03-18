"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetTrigger,
} from "@/components/ui/sheet";

type Exercise = {
  id: string;
  title: string;
  muscle_group: string;
  description: string | null;
  video_url: string | null;
};

const supabase = createClient();

const MUSCLE_GROUPS = [
  "Грудь",
  "Спина",
  "Ноги",
  "Плечи",
  "Руки",
  "Кора",
] as const;

export default function LibraryPage() {
  const { trainerId } = useTrainer();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);

  const [title, setTitle] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<string>("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadExercises() {
      if (!trainerId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("exercises")
        .select("id, title, muscle_group, description, video_url")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setExercises(data as Exercise[]);
      }

      setLoading(false);
    }

    loadExercises();
  }, [trainerId]);

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => {
      return (
        ex.title.toLowerCase().includes(q) ||
        (ex.muscle_group || "").toLowerCase().includes(q)
      );
    });
  }, [search, exercises]);

  function openForCreate() {
    setEditing(null);
    setTitle("");
    setMuscleGroup("");
    setDescription("");
    setVideoUrl("");
    setSheetOpen(true);
  }

  function openForEdit(ex: Exercise) {
    setEditing(ex);
    setTitle(ex.title);
    setMuscleGroup(ex.muscle_group);
    setDescription(ex.description ?? "");
    setVideoUrl(ex.video_url ?? "");
    setSheetOpen(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !muscleGroup) return;
    if (!trainerId) {
      alert("Войдите в аккаунт, чтобы сохранить упражнение.");
      return;
    }
    setSaving(true);

    if (editing) {
      const { data, error } = await supabase
        .from("exercises")
        .update({
          title: title.trim(),
          muscle_group: muscleGroup,
          description: description.trim() || null,
          video_url: videoUrl.trim() || null,
        })
        .eq("id", editing.id)
        .select("id, title, muscle_group, description, video_url")
        .single();

      if (error || !data) {
        console.error("Ошибка обновления упражнения:", error);
        alert("Не удалось обновить упражнение. Проверьте настройки Supabase.");
        setSaving(false);
        return;
      }

      setExercises((prev) =>
        prev.map((ex) => (ex.id === editing.id ? (data as Exercise) : ex))
      );
    } else {
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          trainer_id: trainerId,
          title: title.trim(),
          muscle_group: muscleGroup,
          description: description.trim() || null,
          video_url: videoUrl.trim() || null,
        })
        .select("id, title, muscle_group, description, video_url")
        .single();

      if (error || !data) {
        console.error("Ошибка создания упражнения:", error);
        alert("Не удалось создать упражнение. Проверьте настройки Supabase.");
        setSaving(false);
        return;
      }

      setExercises((prev) => [data as Exercise, ...prev]);
    }

    setSaving(false);
    setSheetOpen(false);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-black px-4 py-10 text-foreground">
      <main className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Библиотека упражнений
            </h1>
            <p className="text-sm text-muted-foreground">
              Храните свои упражнения в аккуратной библиотеке, чтобы быстро
              собирать программы.
            </p>
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                onClick={openForCreate}
                className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md"
              >
                + Упражнение
              </Button>
            </SheetTrigger>
            <SheetContent className="border-l border-border/70 bg-zinc-950/95 backdrop-blur-xl">
              <SheetHeader>
                <SheetTitle className="text-lg font-semibold text-zinc-50">
                  {editing ? "Редактирование упражнения" : "Новое упражнение"}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  Заполните поля, чтобы сохранить упражнение в библиотеку.
                </SheetDescription>
              </SheetHeader>
              <form
                onSubmit={handleSubmit}
                className="flex h-full flex-col gap-4 overflow-y-auto px-4 pb-6 pt-2"
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Название</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTitle(e.target.value)
                    }
                    placeholder="Например, Жим лежа"
                    className="h-9 rounded-xl border-border/70 bg-zinc-900/80 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="muscle">Группа мышц</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {MUSCLE_GROUPS.map((group) => (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setMuscleGroup(group)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          muscleGroup === group
                            ? "bg-zinc-100 text-black"
                            : "bg-zinc-900/80 text-zinc-300 hover:bg-zinc-800/90"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setDescription(e.target.value)
                    }
                    placeholder="Кратко опишите технику, подходы, повторения..."
                    className="min-h-28 rounded-xl border-border/70 bg-zinc-900/80 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video">Ссылка на видео</Label>
                  <Input
                    id="video"
                    value={videoUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setVideoUrl(e.target.value)
                    }
                    placeholder="https://..."
                    className="h-9 rounded-xl border-border/70 bg-zinc-900/80 text-sm"
                  />
                </div>
                <SheetFooter className="mt-auto flex-row justify-end gap-2 px-0">
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full px-4 text-sm text-zinc-300 hover:bg-zinc-900"
                    onClick={() => setSheetOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || !title.trim() || !muscleGroup}
                    className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving
                      ? editing
                        ? "Сохранение..."
                        : "Добавление..."
                      : editing
                      ? "Сохранить"
                      : "Добавить"}
                  </Button>
                </SheetFooter>
              </form>
            </SheetContent>
          </Sheet>
        </header>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder="Поиск по названию или группе мышц..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearch(e.target.value)
              }
              className="h-9 max-w-md rounded-full border-border/70 bg-zinc-900/80 text-sm"
            />
          </div>

          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <SkeletonExerciseCard />
              <SkeletonExerciseCard />
              <SkeletonExerciseCard />
            </div>
          ) : filteredExercises.length === 0 ? (
            <Card className="border border-border/70 bg-zinc-950/60">
              <CardHeader>
                <CardTitle className="text-zinc-100">
                  Упражнений пока нет
                </CardTitle>
                <CardDescription>
                  Добавьте первое упражнение, чтобы начать собирать библиотеку.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {filteredExercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => openForEdit(ex)}
                  className="group text-left"
                >
                  <Card className="h-full border border-border/70 bg-zinc-950/60 transition hover:-translate-y-0.5 hover:border-zinc-500/80 hover:bg-zinc-900/70">
                    <CardHeader className="space-y-2">
                      <CardTitle className="line-clamp-2 text-sm font-medium text-zinc-50">
                        {ex.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400">
                        {ex.muscle_group}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                      {ex.description && (
                        <p className="line-clamp-3 text-xs text-zinc-400">
                          {ex.description}
                        </p>
                      )}
                      {ex.video_url && (
                        <p className="text-[11px] text-zinc-500 underline underline-offset-2">
                          Видео: {ex.video_url}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SkeletonExerciseCard() {
  return (
    <Card className="border border-border/50 bg-zinc-950/40">
      <CardHeader className="space-y-3">
        <div className="h-4 w-32 rounded-full bg-zinc-800/80" />
        <div className="h-3 w-20 rounded-full bg-zinc-900/80" />
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        <div className="h-2.5 w-full rounded-full bg-zinc-900/80" />
        <div className="h-2.5 w-3/4 rounded-full bg-zinc-900/80" />
      </CardContent>
    </Card>
  );
}

