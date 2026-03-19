"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TrainerRow = {
  id: string;
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  slug: string | null;
};

function firstLetter(value: string | null): string {
  const v = (value ?? "").trim();
  return (v[0] ?? "T").toUpperCase();
}

export function TrainersCatalogClient() {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (supabaseRef.current === null) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [trainers, setTrainers] = useState<TrainerRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, team_logo_url, slug")
        .eq("role", "trainer")
        .eq("is_public", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.error("trainers catalog load failed:", error);
        setTrainers([]);
        setLoading(false);
        return;
      }

      setTrainers((data ?? []) as unknown as TrainerRow[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainers;
    return trainers.filter((t) => {
      const team = (t.display_name ?? "").toLowerCase();
      const name = (t.full_name ?? "").toLowerCase();
      return team.includes(q) || name.includes(q);
    });
  }, [query, trainers]);

  return (
    <div className="min-h-screen bg-zinc-950 text-foreground">
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Каталог тренеров
            </h1>
            <p className="text-sm text-zinc-400">
              Найдите тренера по названию команды или имени.
            </p>
          </div>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit rounded-full text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-100"
          >
            <Link href="/">На главную</Link>
          </Button>
        </header>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по команде или имени тренера..."
            className="h-10 rounded-xl border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-400"
          />
        </div>

        {loading ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card
                key={i}
                className="rounded-2xl border-zinc-800 bg-zinc-950/80"
              >
                <CardHeader className="space-y-3">
                  <div className="h-12 w-12 rounded-full bg-zinc-900/70" />
                  <div className="h-4 w-40 rounded bg-zinc-900/60" />
                  <div className="h-3 w-28 rounded bg-zinc-900/60" />
                </CardHeader>
                <CardContent>
                  <div className="h-9 w-full rounded-xl bg-zinc-900/60" />
                </CardContent>
              </Card>
            ))}
          </section>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-zinc-800 bg-zinc-950/80">
            <CardHeader>
              <CardTitle className="text-zinc-50">Ничего не найдено</CardTitle>
              <CardDescription className="text-zinc-400">
                Пока нет публичных тренеров, соответствующих вашему запросу
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t) => {
              const teamName = t.display_name?.trim() || "Без названия";
              const fullName = t.full_name?.trim() || "Тренер";
              const canOpen = Boolean(t.slug?.trim());
              return (
                <Card
                  key={t.id}
                  className="rounded-2xl border-zinc-800 bg-zinc-950/80 transition hover:-translate-y-0.5 hover:border-zinc-600 hover:bg-zinc-950"
                >
                  <CardHeader className="space-y-3">
                    <Avatar size="lg" className="bg-zinc-900">
                      {t.team_logo_url ? (
                        <AvatarImage src={t.team_logo_url} alt="Логотип команды" />
                      ) : (
                        <AvatarFallback className="bg-zinc-900 text-zinc-200">
                          {firstLetter(t.display_name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="space-y-0.5">
                      <CardTitle className="truncate text-base font-semibold text-zinc-50">
                        {teamName}
                      </CardTitle>
                      <CardDescription className="truncate text-sm text-zinc-400">
                        {fullName}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      asChild
                      disabled={!canOpen}
                      className="w-full rounded-xl bg-zinc-100 text-black hover:bg-white disabled:opacity-50"
                    >
                      <Link href={canOpen ? `/t/${encodeURIComponent(t.slug!.trim())}` : "#"}>
                        Посмотреть профиль
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

