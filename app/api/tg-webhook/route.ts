import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase-client";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const WEBAPP_BASE_URL =
  process.env.NEXT_PUBLIC_WEBAPP_BASE_URL ??
  "https://trainer-two-iota.vercel.app";

export async function POST(request: Request) {
  let update: any;

  try {
    update = await request.json();
    console.log("WEBHOOK RECEIVED:", update);
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    return NextResponse.json({ ok: true });
  }

  try {
    // ensure env is used from process.env
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.error("WEBHOOK ERROR:", new Error("TELEGRAM_BOT_TOKEN is not set"));
      return NextResponse.json({ ok: true });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const supabase = getSupabaseClient();

    // Handle /start command
    const message = update?.message;
    if (message && typeof message.text === "string") {
      const text: string = message.text;
      const chatId: number = message.chat.id;
      const from = message.from;

      if (text.startsWith("/start") && from?.id) {
        const telegramId = String(from.id);

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("telegram_id", telegramId)
          .maybeSingle();

        if (!profile) {
          await sendTelegramMessage(
            botToken,
            chatId,
            "Я не нашёл вас в базе клиентов. Пожалуйста, свяжитесь с вашим тренером, чтобы он подключил ваш Telegram."
          );
          return NextResponse.json({ ok: true });
        }

        const clientUrl = `${WEBAPP_BASE_URL}/client/${profile.id}`;
        const name = profile.full_name || "атлет";

        await sendTelegramMessage(botToken, chatId, `Привет, ${name}!`, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Начать тренировку",
                  web_app: { url: clientUrl },
                },
              ],
            ],
          },
        });

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);
    return NextResponse.json({ ok: true });
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number | string,
  text: string,
  extra?: any
) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: "HTML" as const,
    ...extra,
  };

  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("Telegram sendMessage error:", errText);
  }
}

