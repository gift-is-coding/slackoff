import { NextResponse } from "next/server";
import { getOpenClawHealth } from "@/lib/openclaw/gateway-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const health = await getOpenClawHealth();

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
  });
}
