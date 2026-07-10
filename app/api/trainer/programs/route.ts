import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  title?: string;
  isPublic?: boolean;
  planJson?: {
    weeks?: Array<{
      id?: string;
      name?: string;
      days?: Array<{
        id?: string;
        name?: string;
        trainingType?: string;
        note?: string;
        exercises?: unknown[];
      }>;
    }>;
  } | null;
  programId?: string;
  targetDayId?: string;
  workout?: {
    id?: string;
    name?: string;
    trainingType?: string;
    note?: string;
    exercises?: unknown[];
  } | null;
};

type ProgramPlan = {
  weeks: Array<{
    id: string;
    name: string;
    days: Array<{
      id: string;
      name: string;
      trainingType?: string;
      note?: string;
      exercises: Array<Record<string, unknown>>;
    }>;
  }>;
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePlan(value: unknown): ProgramPlan {
  if (
    value &&
    typeof value === "object" &&
    "weeks" in value &&
    Array.isArray((value as { weeks?: unknown[] }).weeks)
  ) {
    return {
      weeks: (value as { weeks: unknown[] }).weeks.map((week, weekIndex) => {
        const safeWeek = week && typeof week === "object" ? (week as Record<string, unknown>) : {};
        const rawDays = Array.isArray(safeWeek.days) ? safeWeek.days : [];

        return {
          id: typeof safeWeek.id === "string" ? safeWeek.id : createId(),
          name:
            typeof safeWeek.name === "string" && safeWeek.name.trim()
              ? safeWeek.name.trim()
              : `Неделя ${weekIndex + 1}`,
          days: rawDays.map((day, dayIndex) => {
            const safeDay = day && typeof day === "object" ? (day as Record<string, unknown>) : {};

            return {
              id: typeof safeDay.id === "string" ? safeDay.id : createId(),
              name:
                typeof safeDay.name === "string" && safeDay.name.trim()
                  ? safeDay.name.trim()
                  : `День ${dayIndex + 1}`,
              trainingType:
                typeof safeDay.trainingType === "string" ? safeDay.trainingType : undefined,
              note: typeof safeDay.note === "string" ? safeDay.note : undefined,
              exercises: Array.isArray(safeDay.exercises)
                ? (safeDay.exercises as Array<Record<string, unknown>>)
                : [],
            };
          }),
        };
      }),
    };
  }

  return {
    weeks: [
      {
        id: createId(),
        name: "Неделя 1",
        days: [],
      },
    ],
  };
}

function ensureWorkoutDay(body: Body) {
  const safeWorkout =
    body.workout && typeof body.workout === "object"
      ? (body.workout as Record<string, unknown>)
      : {};

  return {
    id:
      typeof body.targetDayId === "string" && body.targetDayId.trim()
        ? body.targetDayId.trim()
        : typeof safeWorkout.id === "string" && safeWorkout.id.trim()
          ? safeWorkout.id.trim()
          : createId(),
    name:
      typeof safeWorkout.name === "string" && safeWorkout.name.trim()
        ? safeWorkout.name.trim()
        : "Новая тренировка",
    trainingType:
      typeof safeWorkout.trainingType === "string" && safeWorkout.trainingType.trim()
        ? safeWorkout.trainingType.trim()
        : "Силовая тренировка",
    note: typeof safeWorkout.note === "string" ? safeWorkout.note.trim() : "",
    exercises: Array.isArray(safeWorkout.exercises)
      ? (safeWorkout.exercises as Array<Record<string, unknown>>)
      : [],
  };
}

async function resolveTrainer(req: Request) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return {
      error: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }),
      userId: null,
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return {
      error: NextResponse.json({ error: "Сервер не настроен" }, { status: 500 }),
      userId: null,
    };
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !userData.user) {
    return {
      error: NextResponse.json({ error: "Сессия недействительна" }, { status: 401 }),
      userId: null,
    };
  }

  const admin = getSupabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: "Профиль не найден" }, { status: 404 }),
      userId: null,
    };
  }

  if ((profile as { role?: string | null }).role !== "trainer") {
    return {
      error: NextResponse.json({ error: "Доступно только тренеру" }, { status: 403 }),
      userId: null,
    };
  }

  return { error: null, userId: userData.user.id };
}

export async function POST(req: Request) {
  try {
    const { error, userId } = await resolveTrainer(req);
    if (error) return error;
    if (!userId) {
      return NextResponse.json({ error: "Не удалось определить пользователя" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const isPublic = body.isPublic === true;
    const planJson =
      body.planJson && typeof body.planJson === "object"
        ? body.planJson
        : {
            weeks: [],
          };

    if (!title) {
      return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const insertPayload = {
      trainer_id: userId,
      title,
      weeks: 4,
      is_public: isPublic,
      plan_json: planJson,
    };

    const insertRes = (await admin
      .from("workout_templates")
      .insert(insertPayload as never)
      .select("id, title, weeks, price, is_public, description, cover_url")
      .single()) as {
      data: Record<string, unknown> | null;
      error: { message?: string } | null;
    };

    if (insertRes.error || !insertRes.data) {
      return NextResponse.json(
        { error: insertRes.error?.message ?? "Не удалось создать программу" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      program: {
        ...(insertRes.data as Record<string, unknown>),
        goal: null,
      },
    });
  } catch (error) {
    console.error("trainer/programs POST error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { error, userId } = await resolveTrainer(req);
    if (error) return error;
    if (!userId) {
      return NextResponse.json({ error: "Не удалось определить пользователя" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const programId = typeof body.programId === "string" ? body.programId.trim() : "";

    if (!programId) {
      return NextResponse.json({ error: "Не выбрана программа" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data: program, error: programError } = await admin
      .from("workout_templates")
      .select("id, trainer_id, title, plan_json")
      .eq("id", programId)
      .eq("trainer_id", userId)
      .maybeSingle();

    if (programError || !program) {
      return NextResponse.json({ error: "Программа не найдена" }, { status: 404 });
    }

    const plan = normalizePlan((program as { plan_json?: unknown }).plan_json ?? null);
    const workoutDay = ensureWorkoutDay(body);
    const targetDayId =
      typeof body.targetDayId === "string" && body.targetDayId.trim()
        ? body.targetDayId.trim()
        : "";

    let replaced = false;

    const nextWeeks = plan.weeks.map((week, weekIndex) => {
      const nextDays = week.days.map((day) => {
        if (!targetDayId || day.id !== targetDayId) return day;
        replaced = true;
        return {
          ...day,
          ...workoutDay,
          id: day.id,
        };
      });

      if (!replaced && !targetDayId && weekIndex === 0) {
        return {
          ...week,
          days: [...nextDays, workoutDay],
        };
      }

      return {
        ...week,
        days: nextDays,
      };
    });

    if (!replaced && targetDayId) {
      const firstWeek = nextWeeks[0] ?? {
        id: createId(),
        name: "Неделя 1",
        days: [],
      };
      nextWeeks[0] = {
        ...firstWeek,
        days: [...firstWeek.days, workoutDay],
      };
    }

    const finalWeeks =
      nextWeeks.length > 0
        ? nextWeeks
        : [
            {
              id: createId(),
              name: "Неделя 1",
              days: [workoutDay],
            },
          ];

    const { error: updateError } = await admin
      .from("workout_templates")
      .update({
        plan_json: { weeks: finalWeeks },
        weeks: Math.max(1, finalWeeks.length),
      } as never)
      .eq("id", programId)
      .eq("trainer_id", userId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message ?? "Не удалось сохранить тренировку" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      day: {
        id: workoutDay.id,
        name: workoutDay.name,
        trainingType: workoutDay.trainingType,
      },
    });
  } catch (error) {
    console.error("trainer/programs PATCH error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
