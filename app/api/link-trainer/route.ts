import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
  role?: string | null;
  trainer_id?: string | null;
};

/**
 * Привязка авторизованного пользователя к тренеру по приглашению.
 * userId берётся только из JWT (Bearer), не из тела запроса.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 500 });
    }
    if (!serviceRoleKey) {
      console.error("link-trainer: отсутствует SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json({ error: "Сервер не настроен" }, { status: 500 });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authErr } = await supabaseAuth.auth.getUser(token);
    if (authErr || !userData.user) {
      return NextResponse.json({ error: "Сессия недействительна. Войдите снова." }, { status: 401 });
    }
    const user = userData.user;

    let body: { trainerId?: string };
    try {
      body = (await req.json()) as { trainerId?: string };
    } catch {
      return NextResponse.json({ error: "Некорректное тело запроса" }, { status: 400 });
    }
    const trainerId = typeof body.trainerId === "string" ? body.trainerId.trim() : "";
    if (!trainerId) {
      return NextResponse.json({ error: "Не указан тренер" }, { status: 400 });
    }
    if (user.id === trainerId) {
      return NextResponse.json({ error: "Некорректная ссылка приглашения" }, { status: 400 });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: trainerRow, error: trainerErr } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", trainerId)
      .maybeSingle();

    if (trainerErr || !trainerRow) {
      return NextResponse.json({ error: "Тренер не найден" }, { status: 404 });
    }
    if ((trainerRow as { role?: string }).role !== "trainer") {
      return NextResponse.json({ error: "Некорректная ссылка приглашения" }, { status: 400 });
    }

    const { data: existingProfile, error: profFetchErr } = await admin
      .from("profiles")
      .select("id, role, trainer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profFetchErr) {
      console.error("link-trainer: profiles select", profFetchErr);
      return NextResponse.json({ error: "Не удалось загрузить профиль" }, { status: 500 });
    }

    const prof = existingProfile as ProfileRow | null;
    if (prof?.role === "trainer") {
      return NextResponse.json(
        {
          error:
            "Аккаунт тренера нельзя привязать как клиента. Выйдите и войдите клиентским аккаунтом или зарегистрируйтесь.",
        },
        { status: 400 }
      );
    }

    const email = user.email?.trim().toLowerCase() ?? null;

    if (!prof) {
      const { error: insErr } = await admin.from("profiles").insert({
        id: user.id,
        role: "client",
        trainer_id: trainerId,
        email,
      } as never);
      if (insErr) {
        console.error("link-trainer: profiles insert", insErr);
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    } else {
      const { error: updErr } = await admin
        .from("profiles")
        .update({ trainer_id: trainerId, role: "client" } as never)
        .eq("id", user.id);
      if (updErr) {
        console.error("link-trainer: profiles update", updErr);
        return NextResponse.json({ error: updErr.message }, { status: 500 });
      }
    }

    const { error: delErr } = await admin.from("trainer_clients").delete().eq("client_id", user.id);
    if (delErr) {
      console.warn("link-trainer: удаление старых связей", delErr.message);
    }

    const { error: linkErr } = await admin.from("trainer_clients").insert({
      trainer_id: trainerId,
      client_id: user.id,
      status: "active",
      access_granted: true,
    } as never);

    if (linkErr) {
      console.error("link-trainer: trainer_clients insert", linkErr);
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("link-trainer:", e);
    return NextResponse.json(
      { error: (e as Error)?.message ?? "Внутренняя ошибка" },
      { status: 500 }
    );
  }
}
