"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type Program = {
  id: string;
  title: string;
  weeks: number | null;
  price: number | null;
};

const supabase = createClient();

export default function ProgramsPage() {
  const { trainerId } = useTrainer();
  const router = useRouter();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    async function loadPrograms() {
      if (!trainerId) return;
      setLoading(true);

      const { data, error } = await supabase
        .from("workout_templates")
        .select("id, title, weeks, price")
        .eq("trainer_id", trainerId)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setPrograms(data as Program[]);
      }

      setLoading(false);
    }

    loadPrograms();
  }, [trainerId]);

  async function handleCreateProgram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim()) return;
    if (!trainerId) {
      alert("Войдите в аккаунт, чтобы создать программу.");
      return;
    }
    setCreating(true);

    const { data, error } = await supabase
      .from("workout_templates")
      .insert({
        trainer_id: trainerId,
        title: title.trim(),
        weeks: 4,
        is_public: isPublic,
      })
      .select("id, title, weeks, price")
      .single();

    setCreating(false);

    if (error || !data) {
      console.error("Ошибка создания программы:", error);
      alert("Не удалось создать программу. Проверьте настройки Supabase.");
      return;
    }

    setPrograms((prev) => [data as Program, ...prev]);
    setDialogOpen(false);
    setTitle("");
    setIsPublic(false);
    router.push(`/dashboard/programs/${data.id}`);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-black px-4 py-10 text-foreground">
      <main className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Программы тренировок
            </h1>
            <p className="text-sm text-muted-foreground">
              Создавайте структурированные программы по неделям и дням.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md">
                + Создать программу
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border border-border/80 bg-zinc-950/95 text-foreground backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-zinc-50">
                  Новая программа
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Укажите название программы. Структуру вы настроите позже.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProgram} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label
                    htmlFor="title"
                    className="text-xs font-medium text-zinc-200"
                  >
                    Название программы
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setTitle(e.target.value)
                    }
                    className="h-9 rounded-xl border-border/70 bg-zinc-900/80 text-sm text-foreground ring-0 focus-visible:ring-2 focus-visible:ring-zinc-400/70"
                    placeholder="Например, 8-недельный массонабор"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-border/60 bg-zinc-900/40 px-4 py-3">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="is_public"
                      className="text-sm font-medium text-zinc-200"
                    >
                      Опубликовать в Маркете
                    </Label>
                    <p className="text-xs text-zinc-500">
                      Если включено, программу смогут видеть и покупать все пользователи платформы.
                    </p>
                  </div>
                  <Switch
                    id="is_public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={creating || !title.trim()}
                    className="ml-auto rounded-full bg-zinc-100 px-5 py-2 text-sm font-medium text-black shadow-sm transition hover:bg-white hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creating ? "Создание..." : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        <section>
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <ProgramSkeleton />
              <ProgramSkeleton />
              <ProgramSkeleton />
            </div>
          ) : programs.length === 0 ? (
            <Card className="border border-border/70 bg-zinc-950/60">
              <CardHeader>
                <CardTitle className="text-zinc-100">
                  Программ пока нет
                </CardTitle>
                <CardDescription>
                  Создайте первую программу, чтобы начать конструировать тренировки.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {programs.map((program) => (
                <button
                  key={program.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/programs/${program.id}`)}
                  className="group text-left"
                >
                  <Card className="h-full border border-border/70 bg-zinc-950/60 transition hover:-translate-y-0.5 hover:border-zinc-500/80 hover:bg-zinc-900/70">
                    <CardHeader className="space-y-2">
                      <CardTitle className="line-clamp-2 text-sm font-medium text-zinc-50">
                        {program.title}
                      </CardTitle>
                      <CardDescription className="text-xs text-zinc-400">
                        {program.weeks
                          ? `${program.weeks} недель`
                          : "Без указания длительности"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4 text-xs text-zinc-500">
                      {program.price
                        ? `Цена: ${program.price.toLocaleString("ru-RU")} ₽`
                        : "Не для продажи"}
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

function ProgramSkeleton() {
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

