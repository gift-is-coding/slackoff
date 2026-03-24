import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Lang } from "@/lib/i18n/dict";
import { getOpenClawHealth } from "@/lib/openclaw/gateway-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const lang = (request.nextUrl.searchParams.get("lang") ?? "zh") as Lang;
  const health = await getOpenClawHealth(lang);

  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
  });
}
