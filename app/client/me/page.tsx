"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type ClientProfile = {
  id: string;
  trainer_id: string | null;
};

type TrainerProfile = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
};

function normalizeTelegramLink(value: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (v.startsWith("@")) return `https://t.me/${v.slice(1)}`;
  return v;
}

export default function ClientMePage() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);

  useEffect(() => {
    async function go() {
      setLoading(true);
      setError(null);

      const { data: userRes, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.error("client/me getUser failed:", userErr);
      }
      const user = userRes.user;
      if (!user) {
        router.replace("/login?role=client");
        return;
      }

      const { data: clientRow, error: clientErr } = await supabase
        .from("profiles")
        .select("id, trainer_id")
        .eq("id", user.id)
        .maybeSingle();

      if (clientErr) {
        console.error("client/me load client profile failed:", clientErr);
        setError("Не удалось загрузить профиль. Попробуйте позже.");
        setLoading(false);
        return;
      }

      const clientProfile = (clientRow ?? null) as ClientProfile | null;
      const trainerId = clientProfile?.trainer_id?.trim() || null;
      if (!trainerId) {
        setTrainer(null);
        setLoading(false);
        return;
      }

      const { data: trainerRow, error: trainerErr } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, team_logo_url, telegram_link")
        .eq("id", trainerId)
        .maybeSingle();

      if (trainerErr) {
        console.error("client/me load trainer profile failed:", trainerErr);
        setError("Не удалось загрузить данные тренера. Попробуйте позже.");
        setLoading(false);
        return;
      }

      setTrainer((trainerRow ?? null) as TrainerProfile | null);
      setLoading(false);
    }
    go();
  }, [router, supabase]);

  const telegramUrl = useMemo(
    () => normalizeTelegramLink(trainer?.telegram_link ?? null),
    [trainer?.telegram_link]
  );
  const trainerTitle = trainer?.display_name?.trim() || "Мой тренер";
  const trainerName = trainer?.full_name?.trim() || "—";
  const fallbackLetter = (trainer?.display_name?.trim()?.[0] ?? "T").toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Кабинет клиента
            </h1>
            <p className="text-sm text-zinc-400">
              Ваш прогресс и программа тренировок.
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <Link href="/">На главную</Link>
          </Button>
        </header>

        {error && (
          <div
            className="rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
            role="alert"
          >
            {error}
          </div>
        )}

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Мой тренер</CardTitle>
            <CardDescription className="text-zinc-400">
              Контакты и команда.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-zinc-900/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-44 rounded bg-zinc-900/60" />
                  <div className="h-3 w-28 rounded bg-zinc-900/60" />
                </div>
              </div>
            ) : trainer ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar size="lg" className="bg-zinc-900">
                    {trainer.team_logo_url ? (
                      <AvatarImage src={trainer.team_logo_url} alt="Логотип команды" />
                    ) : (
                      <AvatarFallback className="bg-zinc-900 text-zinc-200">
                        {fallbackLetter}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-100">
                      {trainerTitle}
                    </div>
                    <div className="truncate text-xs text-zinc-400">
                      {trainerName}
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  disabled={!telegramUrl}
                  className="rounded-xl bg-zinc-100 px-5 text-sm font-medium text-black hover:bg-white disabled:opacity-50"
                >
                  <a href={telegramUrl ?? "#"} target="_blank" rel="noreferrer">
                    Написать тренеру в Telegram
                  </a>
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
                У вас пока не указан тренер. Перейдите по ссылке тренера и зарегистрируйтесь как клиент.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
          <CardHeader>
            <CardTitle className="text-zinc-50">Моя программа на сегодня</CardTitle>
            <CardDescription className="text-zinc-400">
              Скоро здесь появится ваш план тренировки.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-400">
              Пусто.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

