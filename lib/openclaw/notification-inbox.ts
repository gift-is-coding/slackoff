import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type NotificationStatus =
  | "pending"
  | "dismissed"
  | "ignored"
  | "approved"
  | "executed"
  | string;

export type NotificationItem = {
  id: string;
  fingerprint: string;
  source: string;
  app: string;
  time: string;
  content: string;
  status: NotificationStatus;
  created_at: string;
  updated_at: string;
  notes: string;
  // Fields written by OpenClaw's AI analysis
  ai_reply?: string;
  execution_plan?: string;
  screenshot_url?: string;
  // Optional enrichment fields — when present, used directly instead of being inferred
  priority?: string;           // "P0" | "P1" | "P2" | "P3"
  risk?: string;               // "low" | "medium" | "high"
  explanation?: string;        // why this item matters / reasoning
  recommended_action?: string; // what the user should do
  final_recipients?: string;   // who the reply should go to
  preview_note?: string;       // extra context shown in the exec preview
  owner?: string;              // the contact/person involved
};

type NotificationInbox = {
  items: NotificationItem[];
  metadata: {
    created_at: string;
    last_sync: string;
  };
};

const PROCESSED_STATUSES = new Set<string>([
  "dismissed",
  "ignored",
  "approved",
  "executed",
]);

function resolveInboxPath(): string {
  const envPath = process.env.OPENCLAW_NOTIFICATION_INBOX_PATH?.trim();

  if (envPath) {
    return envPath;
  }

  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");

  return path.join(stateDir, "workspace", "memory", "notification-inbox.json");
}

export async function readNotificationInbox(): Promise<NotificationInbox> {
  const filePath = resolveInboxPath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as NotificationInbox;

    if (!Array.isArray(parsed.items)) {
      return { items: [], metadata: { created_at: "", last_sync: "" } };
    }

    return parsed;
  } catch {
    return { items: [], metadata: { created_at: "", last_sync: "" } };
  }
}

export async function readPendingNotifications(): Promise<NotificationItem[]> {
  const inbox = await readNotificationInbox();

  return inbox.items.filter((item) => !PROCESSED_STATUSES.has(item.status));
}

export async function readProcessedNotifications(): Promise<NotificationItem[]> {
  const inbox = await readNotificationInbox();

  return inbox.items
    .filter((item) => PROCESSED_STATUSES.has(item.status))
    .sort((a, b) => {
      const ta = new Date(a.updated_at).getTime() || 0;
      const tb = new Date(b.updated_at).getTime() || 0;
      return tb - ta;
    });
}

/**
 * Update the status of a notification item in the inbox JSON file.
 * Returns true if the item was found and updated.
 */
export async function writeNotificationStatus(
  itemId: string,
  newStatus: NotificationStatus,
): Promise<boolean> {
  const filePath = resolveInboxPath();

  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as NotificationInbox;

    if (!Array.isArray(parsed.items)) {
      return false;
    }

    const target = parsed.items.find((item) => item.id === itemId);

    if (!target) {
      return false;
    }

    target.status = newStatus;
    target.updated_at = new Date().toISOString();

    await writeFile(filePath, JSON.stringify(parsed, null, 2), "utf8");

    return true;
  } catch {
    return false;
  }
}
