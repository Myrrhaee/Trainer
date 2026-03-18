import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_BASE_URL =
  process.env.NEXT_PUBLIC_WEBAPP_BASE_URL ??
  "https://trainer-two-iota.vercel.app";

const MESSAGES = (name: string) => [
  `Привет, ${name}! Заметил, что тебя пару дней не было в приложении. Всё в порядке? Если просто закрутился — ничего страшного, жду тебя на тренировке! 🔥`,
  `${name}, привет! Вижу, ты немного выпал из графика. Не давай лени победить, программа на сегодня уже в боте. Давай хотя бы короткую разминку? 💪`,
  `Привет! Как настрой? Давно не видел твоих отметок в трекере. Помни, ради чего начинали. Если нужна помощь — пиши! ⚡️`,
];

export async function POST(req: Request) {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN is not set" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const clientId = body?.clientId;
    const clientName =
      typeof body?.clientName === "string" ? body.clientName.trim() : null;

    if (!clientId || typeof clientId !== "string") {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id, last_reminder_at, full_name")
      .eq("id", clientId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Профиль клиента не найден" },
        { status: 404 }
      );
    }

    const telegramId = (profile as { telegram_id?: string | null }).telegram_id;
    if (!telegramId) {
      return NextResponse.json(
        { error: "У клиента не привязан Telegram" },
        { status: 400 }
      );
    }

    const lastReminderAt = (profile as { last_reminder_at?: string | null })
      .last_reminder_at;
    if (lastReminderAt) {
      const hoursSinceLast =
        (Date.now() - new Date(lastReminderAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLast < 24) {
        return NextResponse.json(
          { error: "Слишком рано, следующее напоминание через 24 часа" },
          { status: 429 }
        );
      }
    }

    const name =
      clientName ||
      ((profile as { full_name?: string | null }).full_name?.trim() || "друг");
    const variants = MESSAGES(name);
    const text = variants[Math.floor(Math.random() * variants.length)];

    const tgRes = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Открыть план тренировок",
                  web_app: {
                    url: `${WEBAPP_BASE_URL}/client/${clientId}`,
                  },
                },
              ],
            ],
          },
        }),
      }
    );

    if (!tgRes.ok) {
      const errText = await tgRes.text();
      console.error("Telegram sendMessage error:", errText);
      return NextResponse.json(
        { error: "Не удалось отправить сообщение в Telegram" },
        { status: 502 }
      );
    }

    await supabaseAdmin
      .from("profiles")
      // @ts-ignore - last_reminder_at exists on profiles; generated types omit it
      .update({ last_reminder_at: new Date().toISOString() })
      .eq("id", clientId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("send-reminder error:", err);
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
