"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BadgeDollarSign,
  CalendarRange,
  DollarSign,
  Receipt,
  TrendingUp,
} from "lucide-react";

import { createClient } from "@/lib/supabase-client";
import { useTrainer } from "@/lib/auth-context";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { DemoAnalyticsPage } from "@/components/demo/demo-pages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
] as const;

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AnalyticsPage() {
  if (isDemoModeEnabled()) {
    return <DemoAnalyticsPage />;
  }

  return <AnalyticsSupabasePage />;
}

function AnalyticsSupabasePage() {
  const { trainerId } = useTrainer();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [today] = useState(() => new Date());

  useEffect(() => {
    if (!trainerId) return;
    const currentTrainerId = trainerId;
    let cancelled = false;

    async function load() {
      setLoading(true);

      const [paymentsRes, clientsRes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, trainer_id, client_id, amount, category, created_at")
          .eq("trainer_id", currentTrainerId)
          .order("created_at", { ascending: false }),
        supabase
          .from("trainer_clients")
          .select("profiles ( id, full_name )")
          .eq("trainer_id", currentTrainerId),
      ]);

      if (cancelled) return;

      setPayments((paymentsRes.data ?? []) as Payment[]);
      const raw = (clientsRes.data ?? []) as unknown as { profiles: ClientOption | null }[];
      setClients(raw.map((row) => row.profiles).filter(Boolean) as ClientOption[]);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [trainerId]);

  const metrics = useMemo(() => {
    const nowTs = today.getTime();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    const last30Cutoff = nowTs - 30 * 24 * 60 * 60 * 1000;
    const last14Cutoff = nowTs - 14 * 24 * 60 * 60 * 1000;

    const last30 = payments.filter((payment) => new Date(payment.created_at).getTime() >= last30Cutoff);
    const last14 = payments.filter((payment) => new Date(payment.created_at).getTime() >= last14Cutoff);
    const monthRevenue = payments
      .filter((payment) => new Date(payment.created_at).getTime() >= monthStart)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const revenue30 = last30.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const avgCheck = last30.length > 0 ? revenue30 / last30.length : 0;
    const forecast =
      today.getDate() > 0
        ? (monthRevenue / today.getDate()) *
          new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
        : 0;

    const revenueByDay = last30.reduce<Record<string, number>>((acc, payment) => {
      const key = payment.created_at.slice(0, 10);
      acc[key] = (acc[key] ?? 0) + Number(payment.amount);
      return acc;
    }, {});

    const revenueChart = Object.entries(revenueByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sum]) => ({
        label: new Date(date).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "short",
        }),
        sum,
      }));

    const categoryMap = last30.reduce<Record<string, number>>((acc, payment) => {
      const key = payment.category?.trim() || "Без категории";
      acc[key] = (acc[key] ?? 0) + Number(payment.amount);
      return acc;
    }, {});

    const categoryChart = Object.entries(categoryMap)
      .sort(([, a], [, b]) => b - a)
      .map(([name, sum]) => ({ name, sum }));

    const recent = payments.slice(0, 8).map((payment) => ({
      ...payment,
      clientName: clients.find((client) => client.id === payment.client_id)?.full_name ?? "Клиент",
    }));

    return {
      monthRevenue,
      revenue30,
      avgCheck,
      forecast,
      revenueChart,
      categoryChart,
      recent,
      salesCount14: last14.length,
    };
  }, [clients, payments, today]);

  async function handleAddPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trainerId || !selectedClientId || !amount.trim()) return;

    const numericAmount = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(numericAmount) || numericAmount <= 0) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("payments")
      .insert({
        trainer_id: trainerId,
        client_id: selectedClientId,
        amount: numericAmount,
        category: category.trim() || null,
      })
      .select("id, trainer_id, client_id, amount, category, created_at")
      .single();

    setSaving(false);

    if (error || !data) return;

    setPayments((prev) => [data as Payment, ...prev]);
    setDialogOpen(false);
    setSelectedClientId("");
    setAmount("");
    setCategory("");
  }

  if (loading && payments.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-black">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
        <section className="grid gap-4 xl:grid-cols-[1.45fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98))]">
            <CardContent className="p-6 md:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Revenue room
                  </p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">
                    Аналитика
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-400">
                    Здесь виден не только доход, но и структура продаж: что приносит деньги,
                    как меняется ритм оплат и насколько стабильно работает воронка программ.
                  </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-zinc-100 text-black hover:bg-white">
                      <DollarSign className="mr-2 h-4 w-4" />
                      Добавить платёж
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md border border-zinc-800 bg-zinc-950/95 text-zinc-100">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-semibold text-zinc-50">
                        Новый платёж
                      </DialogTitle>
                      <DialogDescription className="text-zinc-400">
                        Ручная фиксация оплаты помогает собирать реальную картину дохода.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddPayment} className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Клиент</Label>
                        <select
                          value={selectedClientId}
                          onChange={(event) => setSelectedClientId(event.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        >
                          <option value="">Выберите клиента</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.full_name || client.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Сумма</Label>
                        <Input
                          value={amount}
                          onChange={(event) => setAmount(event.target.value)}
                          inputMode="decimal"
                          placeholder="0"
                          className="h-10 rounded-xl border-zinc-700 bg-zinc-900/80"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-zinc-300">Категория</Label>
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                          className="h-10 w-full rounded-xl border border-zinc-700 bg-zinc-900/80 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                        >
                          <option value="">Без категории</option>
                          {CATEGORIES.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={saving || !selectedClientId || !amount.trim()}
                          className="rounded-full bg-zinc-100 text-black hover:bg-white disabled:opacity-60"
                        >
                          {saving ? "Сохранение..." : "Сохранить"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <MetricCard label="30 дней" value={formatMoney(metrics.revenue30)} icon={<DollarSign className="h-4 w-4" />} />
                <MetricCard label="Средний чек" value={formatMoney(metrics.avgCheck)} icon={<Receipt className="h-4 w-4" />} />
                <MetricCard label="Прогноз месяца" value={formatMoney(metrics.forecast)} icon={<TrendingUp className="h-4 w-4" />} />
                <MetricCard label="Сделок за 14 дней" value={String(metrics.salesCount14)} icon={<CalendarRange className="h-4 w-4" />} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Структура дохода</CardTitle>
              <CardDescription className="text-zinc-400">
                Какие категории приносят деньги чаще всего.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.categoryChart.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 px-4 py-8 text-center text-sm text-zinc-500">
                  Пока нет платежей для аналитики.
                </div>
              ) : (
                metrics.categoryChart.slice(0, 5).map((item, index) => (
                  <div key={item.name} className="rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-400">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{item.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">Категория продаж</p>
                        </div>
                      </div>
                      <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200">
                        {formatMoney(item.sum)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr,1fr]">
          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Динамика выручки</CardTitle>
              <CardDescription className="text-zinc-400">
                Пульс платежей за последние 30 дней.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-64">
                {metrics.revenueChart.length === 0 ? (
                  <div className="flex h-full items-center justify-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 text-sm text-zinc-500">
                    Недостаточно платежей для графика.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.revenueChart}>
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as
                            | { label: string; sum: number }
                            | undefined;
                          if (!active || !point) return null;
                          return (
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100">
                              <div className="font-semibold">{formatMoney(point.sum)}</div>
                              <div className="text-zinc-500">{point.label}</div>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="sum"
                        stroke="rgba(244,244,245,0.92)"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#09090b", stroke: "#f4f4f5", strokeWidth: 2 }}
                        activeDot={{ r: 5, fill: "#09090b", stroke: "#f4f4f5", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="h-56">
                {metrics.categoryChart.length === 0 ? null : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.categoryChart}>
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#71717a", fontSize: 11 }}
                      />
                      <YAxis hide />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.04)" }}
                        content={({ active, payload }) => {
                          const point = payload?.[0]?.payload as
                            | { name: string; sum: number }
                            | undefined;
                          if (!active || !point) return null;
                          return (
                            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100">
                              <div className="font-semibold">{point.name}</div>
                              <div className="text-zinc-500">{formatMoney(point.sum)}</div>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="sum" radius={[8, 8, 0, 0]} fill="rgba(244,244,245,0.88)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-zinc-800/80 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-xl text-zinc-50">Последние транзакции</CardTitle>
              <CardDescription className="text-zinc-400">
                Быстрый просмотр клиентов и источников оплаты.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {metrics.recent.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-zinc-800 bg-black/20 px-4 py-8 text-center text-sm text-zinc-500">
                  История оплат появится здесь.
                </div>
              ) : (
                metrics.recent.map((payment) => (
                  <div key={payment.id} className="rounded-[1.4rem] border border-zinc-800 bg-black/20 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{payment.clientName}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {payment.category || "Без категории"} ·{" "}
                          {new Date(payment.created_at).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "long",
                          })}
                        </p>
                      </div>
                      <Badge className="rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200">
                        {formatMoney(payment.amount)}
                      </Badge>
                    </div>
                  </div>
                ))
              )}

              <div className="rounded-[1.5rem] border border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-2 text-zinc-300">
                    <BadgeDollarSign className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-100">Выручка месяца</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      На данный момент: {formatMoney(metrics.monthRevenue)}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
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
    <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <div className="text-zinc-500">{icon}</div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}
