import type { NotificationItem } from "@/lib/openclaw/notification-inbox";
import type { Priority, Risk, WorkItem } from "@/lib/slackoff/types";

function extractSourceLabel(app: string): string {
  const lower = app.toLowerCase();

  if (lower.includes("teams")) {
    return "Teams";
  }
  if (lower.includes("outlook")) {
    return "Email";
  }
  if (lower.includes("wechat")) {
    return "WeChat";
  }
  if (lower.includes("slack")) {
    return "Slack";
  }

  return app.split("[")[0].trim() || "Unknown";
}

function extractChannel(source: string, app: string): string {
  const label = extractSourceLabel(app);
  const bracket = source.match(/\[(.+)\]/)?.[1] || "";
  const suffix = bracket ? ` / ${bracket}` : "";

  return `${label.toLowerCase()}${suffix}`;
}

function inferPriority(item: NotificationItem): Priority {
  const content = item.content.toLowerCase();

  if (content.includes("urgent") || content.includes("紧急") || content.includes("blocked")) {
    return "P0";
  }

  if (content.includes("@mentioned you") || content.includes("@")) {
    return "P1";
  }

  return "P2";
}

function inferRisk(_item: NotificationItem): Risk {
  return "low";
}

const RISK_LABELS: Record<Risk, string> = {
  low: "低",
  medium: "中",
  high: "高",
};

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function formatTimeLabel(time: string): string {
  if (!time) {
    return "--";
  }

  try {
    const date = new Date(time.replace(" ", "T"));
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 60_000) {
      return "刚刚";
    }
    if (diffMs < 3_600_000) {
      return `${Math.round(diffMs / 60_000)} 分钟前`;
    }
    if (diffMs < 86_400_000) {
      return `${Math.round(diffMs / 3_600_000)} 小时前`;
    }

    return `${Math.round(diffMs / 86_400_000)} 天前`;
  } catch {
    return time;
  }
}

export function mapNotificationToWorkItem(item: NotificationItem): WorkItem {
  const sourceLabel = extractSourceLabel(item.app);
  const priority = inferPriority(item);
  const risk = inferRisk(item);

  return {
    id: item.id,
    priority,
    channel: extractChannel(item.source, item.app),
    source: sourceLabel,
    owner: sourceLabel,
    summary: truncate(item.content, 80),
    deadline: formatTimeLabel(item.time),
    risk,
    riskLabel: RISK_LABELS[risk],
    recommendedAction: "待确认",
    explanation: "",
    sourceMessage: item.content,
    aiDraft: item.ai_reply?.trim() ?? "",
    finalRecipients: `来源: ${sourceLabel}`,
    previewDraft: item.execution_plan ?? "",
    previewNote: "",
    screenshotCaption: item.screenshot_url ? "预执行画面 (Screenshot ahead of execution)" : "",
    screenshotUrl: item.screenshot_url,
  };
}

export function mapNotificationsToWorkItems(items: NotificationItem[]): WorkItem[] {
  return items.map(mapNotificationToWorkItem);
}
