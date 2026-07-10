"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayCircle } from "lucide-react";

import { MobileCabinetNav } from "@/components/client/mobile-cabinet-nav";
import { createClient } from "@/lib/supabase-client";
import { isSupabaseSchemaMismatch, logSupabaseError } from "@/lib/utils";

const supabase = createClient();

type WorkoutLogRow = {
  exercise_id: string;
  performed_weight: number | null;
  performed_reps: number | string | null;
  created_at: string;
};

async function loadWorkoutLogs(userId: string) {
  const fullRes = await supabase
    .from("workout_logs")
    .select("exercise_id, performed_weight, performed_reps, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);

  if (!fullRes.error || !isSupabaseSchemaMismatch(fullRes.error)) {
    return {
      data: (fullRes.data ?? []) as WorkoutLogRow[],
      error: fullRes.error,
    };
  }

  const fallbackRes = await supabase
    .from("workout_logs")
    .select("exercise_id, created_at")
    .eq("client_id", userId)
    .order("created_at", { ascending: false })
    .limit(300);

  return {
    data: ((fallbackRes.data ?? []) as Array<{ exercise_id?: string | null; created_at: string }>).map(
      (row) => ({
        exercise_id: row.exercise_id ?? "exercise",
        performed_weight: null,
        performed_reps: null,
        created_at: row.created_at,
      })
    ),
    error: fallbackRes.error,
  };
}

function groupHistory(rows: WorkoutLogRow[]) {
  const map = new Map<
    string,
    { dateKey: string; createdAt: string; count: number; tonnage: number }
  >();

  rows.forEach((row) => {
    const key = row.created_at.slice(0, 10);
    const entry = map.get(key) ?? {
      dateKey: key,
      createdAt: row.created_at,
      count: 0,
      tonnage: 0,
    };
    entry.count += 1;
    const weight = Number(row.performed_weight ?? 0);
    const reps = Number(row.performed_reps ?? 0);
    entry.tonnage += Number.isFinite(weight) && Number.isFinite(reps) ? weight * reps : 0;
    map.set(key, entry);
  });

  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<WorkoutLogRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?role=client");
        return;
      }

      const { data, error } = await loadWorkoutLogs(user.id);

      if (error) {
        logSupabaseError("history workouts", error);
      }

      if (!cancelled) {
        setLogs((data ?? []) as WorkoutLogRow[]);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const history = useMemo(() => groupHistory(logs), [logs]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg flex-col pb-28">
      <div className="flex-1 space-y-6 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            History
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
            История тренировок
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Последние сессии, тоннаж и ритм работы.
          </p>
        </div>

        <section className="rounded-[1.75rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_36%),linear-gradient(180deg,rgba(24,24,27,0.92),rgba(9,9,11,0.96))] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Общий ритм</p>
              <p className="mt-1 text-xs text-zinc-500">
                {history.length} тренировочных дней сохранено
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
              <div className="text-xs text-zinc-500">Записей</div>
              <div className="text-lg font-semibold text-zinc-100">{logs.length}</div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-5 text-sm text-zinc-500">
              Загружаем историю...
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800/80 bg-zinc-950/40 p-5 text-center">
              <p className="text-sm font-medium text-zinc-200">История пока пуста</p>
              <p className="mt-2 text-sm text-zinc-500">
                Первая тренировка появится здесь сразу после сохранения.
              </p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.dateKey}
                className="rounded-[1.4rem] border border-zinc-800/90 bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">
                      {new Date(item.createdAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "long",
                      })}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">{item.count} записей по упражнениям</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-right">
                    <div className="text-xs text-zinc-500">Тоннаж</div>
                    <div className="text-sm font-semibold text-zinc-100">
                      {Math.round(item.tonnage)} кг
                    </div>
                  </div>
                </div>
                <Link
                  href="/client/me"
                  className="mt-4 inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-zinc-100"
                >
                  <PlayCircle className="h-4 w-4" />
                  Открыть текущий кабинет
                </Link>
              </div>
            ))
          )}
        </section>
      </div>

      <MobileCabinetNav />
    </div>
  );
}
