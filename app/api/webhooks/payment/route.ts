import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PAYMENT_SECRET_KEY = process.env.PAYMENT_SECRET_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBAPP_BASE_URL =
  process.env.NEXT_PUBLIC_WEBAPP_BASE_URL ??
  "https://trainer-two-iota.vercel.app";

/**
 * Достаёт clientId из тела запроса.
 * Универсально для Prodamus (metadata), ЮKassa (metadata), Stripe (metadata.client_id / metadata.clientId).
 */
function extractClientId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const metadata = o.metadata ?? o.custom_metadata;
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    const raw = m.client_id ?? m.clientId;
    if (raw != null) {
      const id = typeof raw === "string" ? raw.trim() : String(raw).trim();
      if (id.length > 0) return id;
    }
  }

  const orderId = o.order_id ?? o.orderId ?? o.payment_id ?? o.paymentId;
  if (orderId != null) {
    const s = String(orderId).trim();
    if (s.length > 0) return s;
  }

  const clientId = o.client_id ?? o.clientId;
  if (clientId != null && typeof clientId === "string") {
    return clientId.trim() || null;
  }

  return null;
}

/**
 * Достаёт programId из тела запроса (metadata.program_id / programId).
 * Используется для покупки программы: при наличии создаём запись в client_programs.
 */
function extractProgramId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;

  const metadata = o.metadata ?? o.custom_metadata;
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    const raw = m.program_id ?? m.programId;
    if (raw != null) {
      const id = typeof raw === "string" ? raw.trim() : String(raw).trim();
      if (id.length > 0) return id;
    }
  }

  const programId = o.program_id ?? o.programId;
  if (programId != null && typeof programId === "string") {
    return programId.trim() || null;
  }

  return null;
}

/**
 * Проверяет секрет из заголовка или тела.
 * Ожидаем: заголовок X-Payment-Secret или Authorization: Bearer <secret>, либо body.secret / body.webhook_secret.
 */
function validateSecret(req: Request, body: Record<string, unknown>): boolean {
  if (!PAYMENT_SECRET_KEY || PAYMENT_SECRET_KEY.length === 0) return false;

  const headerSecret =
    req.headers.get("x-payment-secret") ??
    req.headers.get("x-webhook-secret");
  if (headerSecret && headerSecret === PAYMENT_SECRET_KEY) return true;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && auth.slice(7) === PAYMENT_SECRET_KEY)
    return true;

  const bodySecret = body.secret ?? body.webhook_secret ?? body.auth_key;
  if (bodySecret === PAYMENT_SECRET_KEY) return true;

  return false;
}

export async function POST(req: Request) {
  try {
    if (!PAYMENT_SECRET_KEY) {
      console.error("webhooks/payment: PAYMENT_SECRET_KEY is not set");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    if (!validateSecret(req, body)) {
      return NextResponse.json({ error: "Invalid or missing secret" }, { status: 401 });
    }

    const clientId = extractClientId(body);
    if (!clientId) {
      return NextResponse.json(
        { error: "clientId not found in payload (metadata.clientId / order_id)" },
        { status: 400 }
      );
    }

    const programId = extractProgramId(body);
    const supabaseAdmin = getSupabaseAdmin();

    if (programId) {
      // Покупка программы: открываем доступ в client_programs
      const { error: insertError } = await supabaseAdmin
        .from("client_programs")
        // @ts-ignore - client_programs row type may be missing in generated schema
        .upsert(
          {
            client_id: clientId,
            template_id: programId,
            status: "active",
          },
          { onConflict: ["client_id", "template_id"] }
        );

      if (insertError) {
        console.error("webhooks/payment: client_programs insert error", insertError);
        return NextResponse.json(
          { error: "Failed to grant program access" },
          { status: 500 }
        );
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", clientId)
        .single();

      const telegramId = (profile as { telegram_id?: string | null } | null)?.telegram_id;
      if (TELEGRAM_BOT_TOKEN && telegramId) {
        const text =
          "Оплата прошла успешно! 🎉 Программа тренировок доступна. Погнали заниматься!";
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
                      text: "Открыть программу",
                      web_app: {
                        url: `${WEBAPP_BASE_URL}/client/${clientId}?program=${programId}`,
                      },
                    },
                  ],
                ],
              },
            }),
          }
        );
        if (!tgRes.ok) {
          console.error("webhooks/payment: Telegram sendMessage error", await tgRes.text());
        }
      }

      return new Response(null, { status: 200 });
    }

    // Подписка (без programId): обновляем profiles is_paid
    const subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: profile, error: updateError } = await supabaseAdmin
      .from("profiles")
      // @ts-ignore - profiles columns may be missing in generated schema
      .update({
        is_paid: true,
        subscription_ends_at: subscriptionEndsAt,
      })
      .eq("id", clientId)
      .select("telegram_id, full_name")
      .single();

    if (updateError || !profile) {
      console.error("webhooks/payment: profiles update error", updateError);
      return NextResponse.json(
        { error: "Failed to update profile or profile not found" },
        { status: profile ? 500 : 404 }
      );
    }

    const telegramId = (profile as { telegram_id?: string | null })?.telegram_id;
    if (TELEGRAM_BOT_TOKEN && telegramId) {
      const text =
        "Оплата прошла успешно! 🎉 Твой план тренировок теперь полностью доступен. Погнали заниматься!";
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
                    web_app: { url: `${WEBAPP_BASE_URL}/client/${clientId}` },
                  },
                ],
              ],
            },
          }),
        }
      );
      if (!tgRes.ok) {
        console.error("webhooks/payment: Telegram sendMessage error", await tgRes.text());
      }
    }

    return new Response(null, { status: 200 });
  } catch (err) {
    console.error("webhooks/payment error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
