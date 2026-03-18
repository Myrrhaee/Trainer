"use client";

import { useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const supabase = createClient();

type WeightLogRow = {
  id: string;
  client_id: string;
  weight: number;
  created_at: string;
};

type RangeKey = "1w" | "1m" | "3m" | "all";

export function WeightTracker({ clientId }: { clientId: string }) {
  const [range, setRange] = useState<RangeKey>("1m");
  const [rows, setRows] = useState<WeightLogRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("weight_logs")
        .select("id, client_id, weight, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Ошибка загрузки weight_logs:", error);
        setRows([]);
      } else {
        setRows((data ?? []) as WeightLogRow[]);
      }
      setLoading(false);
    }

    load();
  }, [clientId]);

  const filteredRows = useMemo(() => {
    if (rows.length === 0) return rows;
    if (range === "all") return rows;

    const now = Date.now();
    const days =
      range === "1w" ? 7 : range === "1m" ? 30 : range === "3m" ? 90 : 3650;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  }, [rows, range]);

  const chartData = useMemo(() => {
    return filteredRows.map((r) => {
      const d = new Date(r.created_at);
      const label = d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      });
      return {
        ts: d.getTime(),
        dateLabel: label,
        weight: r.weight,
        fullDate: d.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
      };
    });
  }, [filteredRows]);

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return {
        current: null as number | null,
        monthDelta: null as number | null,
        totalDelta: null as number | null,
      };
    }

    const first = rows[0];
    const last = rows[rows.length - 1];
    const current = last.weight;

    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let monthBase = first;
    for (let i = rows.length - 1; i >= 0; i--) {
      const t = new Date(rows[i].created_at).getTime();
      if (t <= cutoff) {
        monthBase = rows[i];
        break;
      }
    }

    return {
      current,
      monthDelta: current - monthBase.weight,
      totalDelta: current - first.weight,
    };
  }, [rows]);

  async function addWeight() {
    const normalized = weightInput.replace(",", ".").trim();
    const value = Number(normalized);
    if (!clientId || !normalized || Number.isNaN(value) || value <= 0) return;

    setSaving(true);
    const { data, error } = await supabase
      .from("weight_logs")
      .insert({
        client_id: clientId,
        weight: value,
      })
      .select("id, client_id, weight, created_at")
      .single();

    setSaving(false);

    if (error || !data) {
      console.error("Ошибка добавления веса:", error);
      return;
    }

    setRows((prev) => [...prev, data as WeightLogRow]);
    setWeightInput("");
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={weightInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setWeightInput(e.target.value)
          }
          inputMode="decimal"
          placeholder="Вес (кг)"
          className="h-10 flex-1 rounded-full border-border/60 bg-zinc-950/60 text-sm"
        />
        <Button
          type="button"
          onClick={addWeight}
          disabled={saving}
          className="h-10 rounded-full bg-zinc-100 px-4 text-sm font-semibold text-black hover:bg-white disabled:opacity-60"
        >
          {saving ? "..." : "+ Добавить вес"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <RangeButton active={range === "1w"} onClick={() => setRange("1w")}>
          1Н
        </RangeButton>
        <RangeButton active={range === "1m"} onClick={() => setRange("1m")}>
          1М
        </RangeButton>
        <RangeButton active={range === "3m"} onClick={() => setRange("3m")}>
          3М
        </RangeButton>
        <RangeButton active={range === "all"} onClick={() => setRange("all")}>
          Все
        </RangeButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Текущий вес" value={stats.current} unit="кг" />
        <DeltaCard label="Прогресс за месяц" delta={stats.monthDelta} />
        <DeltaCard label="Всего" delta={stats.totalDelta} />
      </div>

      <Card className="border border-border/60 bg-zinc-950/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-zinc-50">
            Вес
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="h-64 w-full">
            {loading ? (
              <div className="h-full w-full rounded-2xl bg-zinc-900/60" />
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border border-border/40 bg-zinc-950/40 text-sm text-zinc-400">
                Добавьте первую запись веса
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e4e4e7" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#e4e4e7" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="dateLabel"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#71717a", fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                  <Tooltip
                    cursor={{ stroke: "rgba(244,244,245,0.12)", strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      return (
                        <div className="rounded-2xl border border-border/60 bg-zinc-950/95 px-3 py-2 text-xs text-zinc-100 shadow-[0_18px_60px_rgba(0,0,0,0.85)]">
                          <div className="font-semibold">{p.weight} кг</div>
                          <div className="text-zinc-400">{p.fullDate}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#e4e4e7"
                    strokeWidth={2}
                    fill="url(#weightFill)"
                    dot={{ r: 3, stroke: "#e4e4e7", strokeWidth: 2, fill: "#09090b" }}
                    activeDot={{ r: 5, stroke: "#f4f4f5", strokeWidth: 2, fill: "#09090b" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function RangeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-zinc-100 text-black"
          : "bg-zinc-950/60 text-zinc-300 hover:bg-zinc-900/70"
      }`}
    >
      {children}
    </button>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null;
  unit?: string;
}) {
  return (
    <Card className="border border-border/60 bg-zinc-950/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-2xl font-semibold tracking-tight text-zinc-50">
          {value === null ? "—" : `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`}
        </div>
      </CardContent>
    </Card>
  );
}

function DeltaCard({ label, delta }: { label: string; delta: number | null }) {
  const sign = delta === null ? null : delta === 0 ? "zero" : delta > 0 ? "up" : "down";
  const color =
    sign === "down"
      ? "text-emerald-400"
      : sign === "up"
      ? "text-rose-400"
      : "text-zinc-300";
  const arrow = sign === "down" ? "↓" : sign === "up" ? "↑" : "→";

  return (
    <Card className="border border-border/60 bg-zinc-950/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className={`text-2xl font-semibold tracking-tight ${color}`}>
          {delta === null ? "—" : `${arrow} ${Math.abs(delta).toFixed(1)} кг`}
        </div>
      </CardContent>
    </Card>
  );
}

