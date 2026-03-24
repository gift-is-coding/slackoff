import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Lang } from "@/lib/i18n/dict";
import {
  readPendingNotifications,
  readProcessedNotifications,
} from "@/lib/openclaw/notification-inbox";
import { mapNotificationsToWorkItems } from "@/lib/slackoff/work-item-mapper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const tab = request.nextUrl.searchParams.get("tab");
    const lang = (request.nextUrl.searchParams.get("lang") ?? "zh") as Lang;
    const notifications =
      tab === "processed"
        ? await readProcessedNotifications()
        : await readPendingNotifications();
    const items = mapNotificationsToWorkItems(notifications, lang);

    return NextResponse.json({
      items,
      fetchedAt: new Date().toISOString(),
      count: items.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        items: [],
        fetchedAt: new Date().toISOString(),
        count: 0,
        errorMessage:
          error instanceof Error ? error.message : "Failed to read notification inbox",
      },
      { status: 500 },
    );
  }
}
