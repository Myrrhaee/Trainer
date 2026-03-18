"use client";

/**
 * Аналитика дохода. Требуется таблица payments:
 * create table payments (
 *   id uuid primary key default gen_random_uuid(),
 *   trainer_id uuid not null references auth.users(id),
 *   client_id uuid not null references profiles(id),
 *   amount numeric not null check (amount > 0),
 *   category text,
 *   created_at timestamptz not null default now()
 * );
 */

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DollarSign, TrendingUp, Receipt } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const supabase = createClient();

type Payment = {
  id: string;
  trainer_id: string;
  client_id: string;
  amount: number;
  category: string | null;
  created_at: string;
};

type ClientOption = {
  id: string;
  full_name: string | null;
};

const CATEGORIES = [
  "Подписка",
  "Программа",
  "Разовое занятие",
  "Консультация",
  "Прочее",
];

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n) + " ₽";
}

export default function AnalyticsPage() {
  const { trainerId } = useTrainer();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!trainerId) return;

    async function load() {
      setLoading(true);
      const [paymentsRes, clientsRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, trainer_id, client_id, amount, category, created_at")
          .eq("trainer_id", trainerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("trainer_clients")
          .select("profiles ( id, full_name )")
          .eq("trainer_id", trainerId),
      ]);

      if (paymentsRes.data) {
        setPayments(paymentsRes.data as unknown as Payment[]);
      }
      if (clientsRes.data) {
        const raw = clientsRes.data as unknown as { profiles: ClientOption | null }[];
        const list = raw.map((r) => r.profiles).filter(Boolean) as ClientOption[];
        setClients(list);
      }
      setLoading(false);
    }

    load();
  }, [trainerId]);

  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cutoff30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { revenue30, avgCheck, forecast, chartData, lastTransactions } = useMemo(() => {
    const last30 = payments.filter((p) => p.created_at >= cutoff30);
    const revenue30 = last30.reduce((s, p) => s + Number(p.amount), 0);
    const avgCheck = last30.length > 0 ? revenue30 / last30.length : 0;
    const revenueThisMonth = payments
      .filter((p) => p.created_at >= monthStart)
      .reduce((s, p) => s + Number(p.amount), 0);
    const forecast = today > 0 ? (revenueThisMonth / today) * daysInMonth : 0;

    const byDay: Record<string, number> = {};
    last30.forEach((p) => {
      const key = p.created_at.slice(0, 10);
      byDay[key] = (byDay[key] ?? 0) + Number(p.amount);
    });
    const chartData = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sum]) => ({
        date,
        label: new Date(date + "Z").toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "short",
        }),
        sum,
      }));

    const lastTransactions = payments
      .slice(0, 10)
      .map((p) => ({
        ...p,
        clientName: clients.find((c) => c.id === p.client_id)?.full_name ?? "—",
      }));

    return {
      revenue30,
      avgCheck,
      forecast,
      chartData,
      lastTransactions,
    };
  }, [payments, clients, cutoff30, monthStart, today, now, daysInMonth]);

  async function handleAddPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trainerId || !selectedClientId || !amount.trim()) return;
    const num = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(num) || num <= 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("payments")
      .insert({
        trainer_id: trainerId,
        client_id: selectedClientId,
        amount: num,
        category: category.trim() || null,
      })
      .select("id, trainer_id, client_id, amount, category, created_at")
      .single();

    setSaving(false);
    if (error) {
      console.error("payments insert error:", error);
      return;
    }
    setPayments((prev) => [data as Payment, ...prev]);
    setDialogOpen(false);
    setSelectedClientId("");
    setAmount("");
    setCategory("");
  }

  if (loading && payments.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-foreground">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
              Аналитика дохода
            </h1>
            <p className="text-sm text-zinc-400">
              Выручка, средний чек и прогноз по платежам
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-500">
                + Добавить платеж
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md border border-border/80 bg-zinc-950/95 text-foreground backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-zinc-50">
                  Новый платёж
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-400">
                  Укажите клиента, сумму и категорию
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddPayment} className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-zinc-200">
                    Клиент
                  </Label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="h-9 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    required
                  >
                    <option value="">Выберите клиента</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name || c.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-zinc-200">
                    Сумма (₽)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="h-9 rounded-xl border-zinc-700 bg-zinc-900/80 text-sm"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-zinc-200">
                    Категория
                  </Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-9 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  >
                    <option value="">Не указана</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={saving || !selectedClientId || !amount.trim()}
                    className="ml-auto rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </header>

        {/* KPI карточки */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border border-border/60 bg-zinc-900/30 ring-1 ring-zinc-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Выручка за месяц
              </CardTitle>
              <div className="rounded-full bg-zinc-950/50 p-2">
                <DollarSign className="h-4 w-4 text-zinc-300" />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                {formatMoney(revenue30)}
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 bg-zinc-900/30 ring-1 ring-zinc-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Средний чек
              </CardTitle>
              <div className="rounded-full bg-zinc-950/50 p-2">
                <Receipt className="h-4 w-4 text-zinc-300" />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-semibold tracking-tight text-zinc-50 md:text-3xl">
                {formatMoney(avgCheck)}
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60 bg-zinc-900/30 ring-1 ring-emerald-500/15">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
                Прогноз на месяц
              </CardTitle>
              <div className="rounded-full bg-emerald-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-2xl font-semibold tracking-tight text-emerald-300 md:text-3xl">
                {formatMoney(forecast)}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* График */}
        <Card className="border border-border/60 bg-zinc-900/30">
          <CardHeader>
            <CardTitle className="text-zinc-50">Доход по дням</CardTitle>
            <CardDescription className="text-zinc-400">
              Последние 30 дней
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {chartData.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-border/40 bg-zinc-950/40 text-sm text-zinc-500">
                  Нет данных за период
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={{ stroke: "#27272a" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v} ₽`}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(39,39,42,0.5)" }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-xl">
                            <div className="text-zinc-400">{p.date}</div>
                            <div className="font-semibold text-emerald-400">
                              {formatMoney(p.sum)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="sum"
                      fill="rgb(16, 185, 129)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Таблица транзакций */}
        <Card className="border border-border/60 bg-zinc-900/30">
          <CardHeader>
            <CardTitle className="text-zinc-50">Последние транзакции</CardTitle>
            <CardDescription className="text-zinc-400">
              До 10 последних платежей
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lastTransactions.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">
                Платежей пока нет. Добавьте первый платёж.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                      <th className="pb-3 pr-4">Клиент</th>
                      <th className="pb-3 pr-4 text-right">Сумма</th>
                      <th className="pb-3 pr-4">Категория</th>
                      <th className="pb-3">Дата</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransactions.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-zinc-800/80 text-zinc-300 last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium text-zinc-100">
                          {t.clientName}
                        </td>
                        <td className="py-3 pr-4 text-right font-medium text-emerald-400">
                          {formatMoney(Number(t.amount))}
                        </td>
                        <td className="py-3 pr-4 text-zinc-500">
                          {t.category || "—"}
                        </td>
                        <td className="py-3 text-zinc-500">
                          {new Date(t.created_at).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
