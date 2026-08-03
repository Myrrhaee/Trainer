import { NextResponse } from "next/server";

import { deploymentReadiness } from "@/lib/server/runtime/deployment-readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const report = await deploymentReadiness();
  if (!report.ready) {
    console.error("[readiness] unavailable", { issues: report.issues });
  }
  return NextResponse.json(
    { status: report.ready ? "ready" : "unavailable" },
    {
      status: report.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
