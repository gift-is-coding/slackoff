import { dict, type Lang } from "@/lib/i18n/dict";
import type { NotificationItem } from "@/lib/openclaw/notification-inbox";
import type { Priority, Risk, WorkItem } from "@/lib/slackoff/types";

const VALID_PRIORITIES = new Set<string>(["P0", "P1", "P2", "P3"]);
const VALID_RISKS = new Set<string>(["low", "medium", "high"]);

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

function getRiskLabels(lang: Lang): Record<Risk, string> {
  return {
    low: dict[lang].riskLow,
    medium: dict[lang].riskMedium,
    high: dict[lang].riskHigh,
  };
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

export function formatTimeLabel(time: string, lang: Lang = "zh"): string {
  if (!time) {
    return "--";
  }

  try {
    const date = new Date(time.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) {
      return time;
    }
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const d = dict[lang];

    if (diffMs < 60_000) {
      return d.timeJustNow;
    }
    if (diffMs < 3_600_000) {
      return d.timeMinutesAgo.replace("{n}", String(Math.round(diffMs / 60_000)));
    }
    if (diffMs < 86_400_000) {
      return d.timeHoursAgo.replace("{n}", String(Math.round(diffMs / 3_600_000)));
    }

    return d.timeDaysAgo.replace("{n}", String(Math.round(diffMs / 86_400_000)));
  } catch {
    return time;
  }
}

export function mapNotificationToWorkItem(item: NotificationItem, lang: Lang = "zh"): WorkItem {
  const sourceLabel = extractSourceLabel(item.app);
  const priority: Priority = VALID_PRIORITIES.has(item.priority ?? "")
    ? (item.priority as Priority)
    : inferPriority(item);
  const risk: Risk = VALID_RISKS.has(item.risk ?? "")
    ? (item.risk as Risk)
    : inferRisk(item);
  const d = dict[lang];

  return {
    id: item.id,
    priority,
    channel: extractChannel(item.source, item.app),
    source: sourceLabel,
    owner: item.owner?.trim() || sourceLabel,
    summary: truncate(item.content, 80),
    deadline: formatTimeLabel(item.time, lang),
    risk,
    riskLabel: getRiskLabels(lang)[risk],
    recommendedAction: item.recommended_action?.trim() || d.pendingConfirm,
    explanation: item.explanation?.trim() ?? "",
    sourceMessage: item.content,
    aiDraft: item.ai_reply?.trim() ?? "",
    finalRecipients: item.final_recipients?.trim() || `${d.sourcePrefix}${sourceLabel}`,
    previewDraft: item.execution_plan ?? "",
    previewNote: item.preview_note?.trim() ?? "",
    screenshotCaption: item.screenshot_url ? d.screenshotCaption : "",
    screenshotUrl: item.screenshot_url,
  };
}

export function mapNotificationsToWorkItems(items: NotificationItem[], lang: Lang = "zh"): WorkItem[] {
  return items.map((item) => mapNotificationToWorkItem(item, lang));
}
