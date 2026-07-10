"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Crown,
  Play,
  ShoppingBag,
  Sparkles,
  Target,
  Ticket,
} from "lucide-react";

import { MobileCabinetNav } from "@/components/client/mobile-cabinet-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase-client";
import { isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type ClientProfile = {
  id: string;
  full_name: string | null;
  trainer_id: string | null;
};

type AssignedProgramRow = {
  template_id: string;
  status: string | null;
};

type PurchasedProgramRow = {
  template_id: string;
};

type PlanExercise = {
  id: string;
  title: string;
};

type PlanDay = {
  id: string;
  name: string;
  exercises: PlanExercise[];
};

type PlanWeek = {
  id: string;
  name: string;
  days: PlanDay[];
};

type PlanJson = {
  weeks: PlanWeek[];
};

type TemplateRow = {
  id: string;
  title: string;
  goal: string | null;
  price: number | null;
  is_public: boolean | null;
  created_at: string | null;
  plan_json: PlanJson | null;
};

type QueryResult<T> = {
  data: T;
  error: unknown;
};

function countDays(template: TemplateRow) {
  return template.plan_json?.weeks?.flatMap((week) => week.days).length ?? 0;
}

function countExercises(template: TemplateRow) {
  return (
    template.plan_json?.weeks?.flatMap((week) => week.days).flatMap((day) => day.exercises).length ??
    0
  );
}

function formatCurrency(value: number | null) {
  if (value == null) return "По запросу";
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

async function loadAssignedPrograms(userId: string): Promise<QueryResult<AssignedProgramRow[]>> {
  const res = await supabase
    .from("assigned_programs")
    .select("template_id, status")
    .eq("client_id", userId);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [], error: null };
  }

  return {
    data: (res.data ?? []) as AssignedProgramRow[],
    error: res.error,
  };
}

async function loadPurchasedPrograms(userId: string): Promise<QueryResult<PurchasedProgramRow[]>> {
  const res = await supabase.from("client_programs").select("template_id").eq("client_id", userId);

  if (isSupabaseSchemaMismatch(res.error)) {
    return { data: [], error: null };
  }

  return {
    data: (res.data ?? []) as PurchasedProgramRow[],
    error: res.error,
  };
}

async function loadTemplatesByIds(ids: string[]): Promise<QueryResult<TemplateRow[]>> {
  const fullRes =
    ids.length > 0
      ? await supabase
          .from("workout_templates")
          .select("id, title, goal, price, is_public, created_at, plan_json")
          .in("id", ids)
      : { data: [], error: null };

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as TemplateRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title, plan_json")
    .in("id", ids);

  return {
    data: ((fallbackRes.data ?? []) as Array<{ id: string; title: string; plan_json?: PlanJson | null }>).map(
      (row) => ({
        id: row.id,
        title: row.title,
        goal: null,
        price: null,
        is_public: null,
        created_at: null,
        plan_json: row.plan_json ?? null,
      })
    ),
    error: fallbackRes.error,
  };
}

async function loadTrainerTemplates(trainerId: string): Promise<QueryResult<TemplateRow[]>> {
  const fullRes = await supabase
    .from("workout_templates")
    .select("id, title, goal, price, is_public, created_at, plan_json")
    .eq("trainer_id", trainerId);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as TemplateRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_templates")
    .select("id, title, plan_json")
    .eq("trainer_id", trainerId);

  return {
    data: ((fallbackRes.data ?? []) as Array<{ id: string; title: string; plan_json?: PlanJson | null }>).map(
      (row) => ({
        id: row.id,
        title: row.title,
        goal: null,
        price: null,
        is_public: null,
        created_at: null,
        plan_json: row.plan_json ?? null,
      })
    ),
    error: fallbackRes.error,
  };
}

export default function ProgramsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [assignedPrograms, setAssignedPrograms] = useState<AssignedProgramRow[]>([]);
  const [purchasedPrograms, setPurchasedPrograms] = useState<PurchasedProgramRow[]>([]);
  const [ownedTemplates, setOwnedTemplates] = useState<TemplateRow[]>([]);
  const [trainerTemplates, setTrainerTemplates] = useState<TemplateRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) logSupabaseError("programs auth", authError);
      const userId = authData.user?.id;

      if (!userId) {
        router.replace("/login?role=client");
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("id, full_name, trainer_id")
        .eq("id", userId)
        .maybeSingle();

      if (profileRes.error) logSupabaseError("programs profile", profileRes.error);

      const profile = (profileRes.data ?? null) as ClientProfile | null;
      if (!profile) {
        setLoading(false);
        return;
      }

      const [assignedRes, purchasedRes] = await Promise.all([
        loadAssignedPrograms(userId),
        loadPurchasedPrograms(userId),
      ]);

      if (assignedRes.error) logSupabaseError("programs assigned", assignedRes.error);
      if (purchasedRes.error) logSupabaseError("programs purchased", purchasedRes.error);

      const assigned = (assignedRes.data ?? []) as AssignedProgramRow[];
      const purchased = (purchasedRes.data ?? []) as PurchasedProgramRow[];
      const ownedIds = [...new Set([...assigned, ...purchased].map((row) => row.template_id).filter(Boolean))];

      const [ownedRes, trainerRes] = await Promise.all([
        ownedIds.length > 0 ? loadTemplatesByIds(ownedIds) : Promise.resolve({ data: [], error: null }),
        profile.trainer_id ? loadTrainerTemplates(profile.trainer_id) : Promise.resolve({ data: [], error: null }),
      ]);

      if (cancelled) return;

      if (ownedRes.error) logSupabaseError("programs owned templates", ownedRes.error);
      if (trainerRes.error) logSupabaseError("programs trainer templates", trainerRes.error);

      setClient(profile);
      setAssignedPrograms(assigned);
      setPurchasedPrograms(purchased);
      setOwnedTemplates((ownedRes.data ?? []) as TemplateRow[]);
      setTrainerTemplates((trainerRes.data ?? []) as TemplateRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const detail = useMemo(() => {
    const assignedMap = new Map(assignedPrograms.map((row) => [row.template_id, row.status ?? "assigned"]));
    const purchasedIds = new Set(purchasedPrograms.map((row) => row.template_id));
    const activeTemplate =
      ownedTemplates.find((template) => assignedMap.get(template.id) === "active") ??
      ownedTemplates[0] ??
      null;

    const unlockedIds = new Set(ownedTemplates.map((template) => template.id));
    const recommended = trainerTemplates.filter((template) => !unlockedIds.has(template.id)).slice(0, 3);

    return {
      activeTemplate,
      totalOwned: unlockedIds.size,
      totalAssigned: assignedPrograms.length,
      totalPurchased: purchasedPrograms.length,
      ownedCards: ownedTemplates
        .slice()
        .sort((left, right) => {
          const leftStatus = assignedMap.get(left.id) === "active" ? 1 : 0;
          const rightStatus = assignedMap.get(right.id) === "active" ? 1 : 0;
          return rightStatus - leftStatus;
        })
        .map((template) => ({
          template,
          isActive: assignedMap.get(template.id) === "active",
          isAssigned: assignedMap.has(template.id),
          isPurchased: purchasedIds.has(template.id),
        })),
      recommended,
    };
  }, [assignedPrograms, ownedTemplates, purchasedPrograms, trainerTemplates]);

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-semibold text-zinc-100">Профиль не найден</p>
            <p className="mt-2 text-sm text-zinc-500">Не удалось загрузить программы.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-28 pt-4">
        <section className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Program Vault
              </p>
              <h1 className="mt-2 text-[1.95rem] font-semibold tracking-tight text-zinc-50">
                Programs
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Активные планы, купленные программы и следующие шаги в одном месте.
              </p>
            </div>
            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-right">
              <div className="text-xs text-zinc-500">Открыто</div>
              <div className="text-lg font-semibold text-zinc-100">{detail.totalOwned}</div>
            </div>
          </div>
        </section>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl text-zinc-50">Активная программа</CardTitle>
                <CardDescription className="text-zinc-400">
                  Программа должна ощущаться как поток, а не как статичный документ.
                </CardDescription>
              </div>
              {detail.activeTemplate ? (
                <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                  В работе
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {detail.activeTemplate ? (
              <div className="rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_38%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Сейчас в фокусе
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
                      {detail.activeTemplate.title}
                    </h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {detail.activeTemplate.goal || "План от тренера с прогрессией нагрузки"}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 px-3 py-2 text-right">
                    <div className="text-xs text-zinc-500">Дней</div>
                    <div className="text-lg font-semibold text-zinc-100">
                      {countDays(detail.activeTemplate)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <ProgramStat
                    label="Упражнений"
                    value={String(countExercises(detail.activeTemplate))}
                    icon={<BookOpen className="h-4 w-4" />}
                  />
                  <ProgramStat
                    label="Фокус"
                    value={detail.activeTemplate.goal || "Сила"}
                    icon={<Target className="h-4 w-4" />}
                  />
                  <ProgramStat
                    label="Формат"
                    value="Живой план"
                    icon={<Sparkles className="h-4 w-4" />}
                  />
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  <Button asChild className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white">
                    <Link href={`/client/${client.id}?program=${detail.activeTemplate.id}`}>
                      <Play className="mr-2 h-4 w-4" />
                      Открыть программу
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="h-12 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  >
                    <Link href="/client/me">
                      В dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 p-5 text-center">
                <p className="text-sm font-medium text-zinc-100">Активной программы пока нет</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Можно открыть магазин программ или попросить тренера назначить план.
                </p>
                <Button asChild className="mt-4 rounded-full bg-zinc-100 text-black hover:bg-white">
                  <Link href="/explore">Открыть магазин</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-3">
          <ProgramStat
            label="Назначено"
            value={String(detail.totalAssigned)}
            icon={<Crown className="h-4 w-4" />}
          />
          <ProgramStat
            label="Куплено"
            value={String(detail.totalPurchased)}
            icon={<Ticket className="h-4 w-4" />}
          />
          <ProgramStat
            label="Доступно"
            value={String(detail.totalOwned)}
            icon={<ShoppingBag className="h-4 w-4" />}
          />
        </section>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-50">Мои программы</CardTitle>
            <CardDescription className="text-zinc-400">
              Назначенные тренером и открытые после покупки.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.ownedCards.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 p-5 text-center">
                <p className="text-sm font-medium text-zinc-100">Программ пока нет</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Когда тренер назначит план или вы купите программу, она появится здесь.
                </p>
              </div>
            ) : (
              detail.ownedCards.map(({ template, isActive, isAssigned, isPurchased }) => (
                <div
                  key={template.id}
                  className="rounded-[1.45rem] border border-zinc-800/90 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        {isActive ? (
                          <Badge className="rounded-full border border-emerald-400/20 bg-emerald-500/10 text-emerald-200">
                            Активна
                          </Badge>
                        ) : null}
                        {isAssigned ? (
                          <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                            Назначена
                          </Badge>
                        ) : null}
                        {isPurchased ? (
                          <Badge className="rounded-full border border-sky-400/20 bg-sky-500/10 text-sky-200">
                            Куплена
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold tracking-tight text-zinc-50">
                        {template.title}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {template.goal || "Персональный фокус тренировки"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-right">
                      <div className="text-xs text-zinc-500">Дней</div>
                      <div className="text-sm font-semibold text-zinc-100">{countDays(template)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-500">
                    <span>{countExercises(template)} упражнений в плане</span>
                    <span>{formatCurrency(template.price)}</span>
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 h-11 w-full rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
                  >
                    <Link href={`/client/${client.id}?program=${template.id}`}>
                      Открыть программу
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-50">Следующие программы</CardTitle>
            <CardDescription className="text-zinc-400">
              Что ещё можно открыть у тренера или в магазине.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.recommended.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 p-5 text-center">
                <p className="text-sm font-medium text-zinc-100">Подборка скоро появится</p>
                <p className="mt-2 text-sm text-zinc-500">
                  Пока можно перейти в магазин и посмотреть все доступные программы.
                </p>
              </div>
            ) : (
              detail.recommended.map((template) => (
                <div
                  key={template.id}
                  className="rounded-[1.45rem] border border-zinc-800/90 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-50">{template.title}</h3>
                      <p className="mt-1 text-sm text-zinc-400">
                        {template.goal || "Новый цикл тренировок"}
                      </p>
                    </div>
                    <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300">
                      {formatCurrency(template.price)}
                    </Badge>
                  </div>
                </div>
              ))
            )}

            <Button asChild className="h-12 w-full rounded-full bg-zinc-100 text-black hover:bg-white">
              <Link href="/explore">
                Открыть магазин программ
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>

      <MobileCabinetNav />
    </div>
  );
}

function ProgramStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-zinc-950/90 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <span>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}
