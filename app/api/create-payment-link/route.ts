import { NextResponse } from "next/server";

/**
 * Создаёт ссылку на оплату программы для клиента.
 * В metadata платежа должны передаваться clientId и programId,
 * чтобы вебхук api/webhooks/payment мог выдать доступ (client_programs).
 *
 * База URL: NEXT_PUBLIC_PROGRAM_PAYMENT_URL (чекхаут Prodamus / ЮKassa / Stripe).
 * Параметры: client_id, program_id — передайте их в metadata при создании платежа на стороне кассы.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const clientId = body?.clientId ?? body?.client_id;
    const programId = body?.programId ?? body?.program_id;

    if (!clientId || !programId || typeof clientId !== "string" || typeof programId !== "string") {
      return NextResponse.json(
        { error: "clientId and programId are required" },
        { status: 400 }
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_PROGRAM_PAYMENT_URL ??
      process.env.NEXT_PUBLIC_PAYMENT_CHECKOUT_URL ?? "";

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Payment URL not configured (NEXT_PUBLIC_PROGRAM_PAYMENT_URL)" },
        { status: 500 }
      );
    }

    const url = new URL(baseUrl);
    url.searchParams.set("client_id", clientId.trim());
    url.searchParams.set("program_id", programId.trim());
    url.searchParams.set("metadata_clientId", clientId.trim());
    url.searchParams.set("metadata_programId", programId.trim());

    return NextResponse.json({ url: url.toString() });
  } catch (err) {
    console.error("create-payment-link error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
