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
