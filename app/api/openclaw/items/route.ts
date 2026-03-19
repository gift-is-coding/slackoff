import { NextResponse } from "next/server";
import { readPendingNotifications } from "@/lib/openclaw/notification-inbox";
import { mapNotificationsToWorkItems } from "@/lib/slackoff/work-item-mapper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const notifications = await readPendingNotifications();
    const items = mapNotificationsToWorkItems(notifications);

    return NextResponse.json({
      items,
      fetchedAt: new Date().toISOString(),
      count: items.length,
    });
  } catch (error) {
    return NextResponse.json({
      items: [],
      fetchedAt: new Date().toISOString(),
      count: 0,
      errorMessage:
        error instanceof Error ? error.message : "Failed to read notification inbox",
    });
  }
}
