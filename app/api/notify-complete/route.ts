import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_TRAINER_CHAT_ID = process.env.TELEGRAM_TRAINER_CHAT_ID;

export async function POST(req: Request) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_TRAINER_CHAT_ID) {
    console.error(
      "TELEGRAM_BOT_TOKEN or TELEGRAM_TRAINER_CHAT_ID is not set"
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { clientId } = await req.json().catch(() => ({ clientId: null }));

  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ ok: false, error: "Invalid clientId" }, { status: 400 });
  }

  const supabase = getSupabaseClient();

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", clientId)
      .single();

    if (error || !profile) {
      console.error("Не удалось найти профиль клиента для уведомления:", error);
      return NextResponse.json({ ok: false }, { status: 404 });
    }

    const name = profile.full_name || "клиент";
    const text = `Клиент ${name} завершил тренировку!`;

    const res = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_TRAINER_CHAT_ID,
          text,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Ошибка отправки уведомления тренеру:", errText);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Неожиданная ошибка при отправке уведомления:", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

