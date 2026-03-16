import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    botTokenSet: !!process.env.TELEGRAM_BOT_TOKEN,
    supabaseUrlSet: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
}

