"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MessageCircle,
  Ruler,
  Settings,
  Sparkles,
  Target,
  Weight,
} from "lucide-react";

import { MobileCabinetNav } from "@/components/client/mobile-cabinet-nav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase-client";
import { logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type ClientProfile = {
  id: string;
  full_name: string | null;
  trainer_id: string | null;
  weight: number | null;
  height: number | null;
  target_weight: number | null;
};

type TrainerProfile = {
  full_name: string | null;
  display_name: string | null;
  team_logo_url: string | null;
  telegram_link: string | null;
};

function initials(value: string | null): string {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "AT";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function normalizeTelegramLink(value: string | null): string | null {
  const clean = (value ?? "").trim();
  if (!clean) return null;
  if (clean.startsWith("@")) return `https://t.me/${clean.slice(1)}`;
  return clean;
}

function formatWeight(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)} кг`;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [trainer, setTrainer] = useState<TrainerProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) logSupabaseError("profile auth", authError);
      const userId = authData.user?.id;

      if (!userId) {
        router.replace("/login?role=client");
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("id, full_name, trainer_id, weight, height, target_weight")
        .eq("id", userId)
        .maybeSingle();

      if (profileRes.error) logSupabaseError("profile client", profileRes.error);

      const profile = (profileRes.data ?? null) as ClientProfile | null;
      if (!profile) {
        setLoading(false);
        return;
      }

      const trainerRes = profile.trainer_id
        ? await supabase
            .from("profiles")
            .select("full_name, display_name, team_logo_url, telegram_link")
            .eq("id", profile.trainer_id)
            .maybeSingle()
        : { data: null, error: null };

      if (cancelled) return;

      if (trainerRes.error) logSupabaseError("profile trainer", trainerRes.error);

      setClient(profile);
      setTrainer((trainerRes.data ?? null) as TrainerProfile | null);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
            <p className="mt-2 text-sm text-zinc-500">Не удалось загрузить данные аккаунта.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = client.full_name?.trim() || "Атлет";
  const trainerName = trainer?.display_name?.trim() || trainer?.full_name?.trim() || "Тренер";
  const telegramUrl = normalizeTelegramLink(trainer?.telegram_link ?? null);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 pb-28 pt-4">
        <section className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))] p-5">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 rounded-[1.6rem] bg-zinc-900">
              <AvatarImage src={trainer?.team_logo_url ?? undefined} alt={clientName} />
              <AvatarFallback className="rounded-[1.6rem] bg-zinc-900 text-zinc-100">
                {initials(clientName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Profile
              </p>
              <h1 className="mt-2 text-[1.95rem] font-semibold tracking-tight text-zinc-50">
                {clientName}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                Настройки, цели и связь с тренером в одном месте.
              </p>
            </div>
          </div>
        </section>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-50">Параметры</CardTitle>
            <CardDescription className="text-zinc-400">
              Всё, что влияет на программу и прогресс.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Вес" value={formatWeight(client.weight)} icon={<Weight className="h-4 w-4" />} />
            <MetricCard
              label="Рост"
              value={client.height ? `${client.height} см` : "—"}
              icon={<Ruler className="h-4 w-4" />}
            />
            <MetricCard
              label="Цель"
              value={formatWeight(client.target_weight)}
              icon={<Target className="h-4 w-4" />}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-50">Аккаунт и действия</CardTitle>
            <CardDescription className="text-zinc-400">
              Самые частые сценарии без лишних переходов.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionRow
              title="Редактировать профиль"
              description="Имя, антропометрия, Telegram и цели."
              href="/client/settings"
              icon={<Settings className="h-4 w-4" />}
            />
            <ActionRow
              title="Открыть прогресс"
              description="Вес, замеры и контрольные чек-ины."
              href="/check-in"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <ActionRow
              title="Мои программы"
              description="Активные циклы и купленные планы."
              href="/programs"
              icon={<Target className="h-4 w-4" />}
            />
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-xl text-zinc-50">Связь с тренером</CardTitle>
            <CardDescription className="text-zinc-400">
              Telegram остаётся частью UX и держит коммуникацию живой.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-[1.5rem] border border-zinc-800/90 bg-black/20 p-4">
              <Avatar className="h-12 w-12 rounded-2xl bg-zinc-900">
                <AvatarImage src={trainer?.team_logo_url ?? undefined} alt={trainerName} />
                <AvatarFallback className="rounded-2xl bg-zinc-900 text-zinc-100">
                  {initials(trainerName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-100">{trainerName}</p>
                <p className="text-xs text-zinc-500">Ваш тренер</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button asChild className="h-12 rounded-full bg-zinc-100 text-black hover:bg-white">
                <Link href={telegramUrl ?? "https://web.telegram.org/"} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Написать тренеру
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-12 rounded-full border-zinc-700 bg-zinc-950/40 text-zinc-100 hover:bg-zinc-900"
              >
                <Link href="/client/settings">
                  Открыть настройки
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <MobileCabinetNav />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
        <span>{icon}</span>
        {label}
      </div>
      <p className="mt-3 text-lg font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function ActionRow({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/50"
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-3 text-zinc-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{description}</p>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-zinc-600" />
    </Link>
  );
}
