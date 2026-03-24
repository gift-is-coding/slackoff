import { sendChannelMessage } from "@/lib/openclaw/channel";
import { enqueueBridgeEnvelope } from "@/lib/openclaw/bridge-files";
import { DEFAULT_OPENCLAW_DECISION_SESSION_ID } from "@/lib/openclaw/constants";
import { writeNotificationStatus } from "@/lib/openclaw/notification-inbox";
import type { NotificationStatus } from "@/lib/openclaw/notification-inbox";
import type {
  OpenClawDecisionAction,
  OpenClawDecisionSubmissionResult,
} from "@/lib/slackoff/types";

const ACTION_TO_STATUS: Record<OpenClawDecisionAction, NotificationStatus> = {
  approve_plan: "approved",
  ignore: "ignored",
  request_edit: "pending",
  confirm_execute: "executed",
  cancel: "pending",
};

const MAX_TEXT_FIELD_CHARS = 2_000;
const SLACKOFF_DECISION_SESSION_ID =
  process.env.OPENCLAW_SLACKOFF_DECISION_SESSION_ID?.trim() ||
  DEFAULT_OPENCLAW_DECISION_SESSION_ID;

type SubmitDecisionParams = {
  action: OpenClawDecisionAction;
  itemId: string;
  source: string;
  summary: string;
  slashCommand?: string;
  finalRecipients?: string;
  previewDraft?: string;
};

type DecisionBridgeEnvelope = {
  type: string;
  payload: Record<string, unknown>;
};

function requireText(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new Error(`${field} is required`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${field} is required`);
  }

  if (trimmed.length > MAX_TEXT_FIELD_CHARS) {
    throw new Error(`${field} cannot exceed ${MAX_TEXT_FIELD_CHARS} characters`);
  }

  return trimmed;
}

function optionalText(value: unknown, field: string) {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > MAX_TEXT_FIELD_CHARS) {
    throw new Error(`${field} cannot exceed ${MAX_TEXT_FIELD_CHARS} characters`);
  }

  return trimmed;
}

function isDecisionAction(value: unknown): value is OpenClawDecisionAction {
  return (
    value === "approve_plan" ||
    value === "ignore" ||
    value === "request_edit" ||
    value === "confirm_execute" ||
    value === "cancel"
  );
}

export function normalizeDecisionRequestBody(body: unknown): SubmitDecisionParams {
  if (!body || typeof body !== "object") {
    throw new Error("Decision body must be an object");
  }

  const raw = body as Record<string, unknown>;

  if (!isDecisionAction(raw.action)) {
    throw new Error("Unsupported decision action");
  }

  return {
    action: raw.action,
    itemId: requireText(raw.itemId, "itemId"),
    source: requireText(raw.source, "source"),
    summary: requireText(raw.summary, "summary"),
    slashCommand: optionalText(raw.slashCommand, "slashCommand"),
    finalRecipients: optionalText(raw.finalRecipients, "finalRecipients"),
    previewDraft: optionalText(raw.previewDraft, "previewDraft"),
  };
}

/**
 * When slashCommand starts with ":", mode is "direct_reply" — the text after
 * ":" is the exact message content to send. When it starts with "/", mode is
 * "instruction" — the text is an agent instruction (e.g. /rewrite 更简洁).
 */
function resolveSlashCommandMode(slashCommand?: string): {
  mode: "direct_reply" | "instruction";
  content: string;
} {
  if (slashCommand?.startsWith(":")) {
    return { mode: "direct_reply", content: slashCommand.slice(1).trim() };
  }
  return { mode: "instruction", content: slashCommand || "" };
}

function buildDecisionBridgeEnvelope(
  params: SubmitDecisionParams,
): DecisionBridgeEnvelope {
  switch (params.action) {
    case "approve_plan": {
      const sc = resolveSlashCommandMode(params.slashCommand);
      return {
        type: "decision.plan_approved",
        payload: {
          itemId: params.itemId,
          decision: "approve_plan",
          slashCommand: sc.content,
          slashCommandMode: sc.mode,
          source: params.source,
          summary: params.summary,
        },
      };
    }
    case "ignore":
      return {
        type: "decision.ignored",
        payload: {
          itemId: params.itemId,
          decision: "ignore",
          source: params.source,
          summary: params.summary,
        },
      };
    case "request_edit": {
      const sc = resolveSlashCommandMode(params.slashCommand);
      return {
        type: "decision.edit_requested",
        payload: {
          itemId: params.itemId,
          decision: "request_edit",
          slashCommand: sc.content,
          slashCommandMode: sc.mode,
          source: params.source,
          summary: params.summary,
        },
      };
    }
    case "confirm_execute":
      return {
        type: "decision.execute_confirmed",
        payload: {
          itemId: params.itemId,
          decision: "confirm_execute",
          finalRecipients: params.finalRecipients || "",
          previewDraft: params.previewDraft || "",
          source: params.source,
          summary: params.summary,
        },
      };
    case "cancel":
      return {
        type: "decision.cancelled",
        payload: {
          itemId: params.itemId,
          decision: "cancel",
          source: params.source,
          summary: params.summary,
        },
      };
  }
}

export function buildDecisionChannelMessage(params: {
  action: OpenClawDecisionAction;
  slashCommand: string;
  slashCommandMode: "instruction" | "direct_reply";
  source: string;
  summary: string;
  finalRecipients?: string;
  previewDraft?: string;
  bridgeFilePath?: string;
}) {
  const bridgeLine = params.bridgeFilePath
    ? `Bridge file: ${params.bridgeFilePath}`
    : "Bridge file: unavailable";

  if (params.slashCommandMode === "direct_reply" && params.slashCommand) {
    return [
      `[Slackoff decision] action=${params.action} source=${params.source}`,
      `Summary: ${params.summary}`,
      `Operator instruction: reply with EXACTLY the following content, do not modify or paraphrase it:`,
      `---`,
      params.slashCommand,
      `---`,
      bridgeLine,
    ].join("\n");
  }

  const lines = [
    `[Slackoff decision] action=${params.action} source=${params.source}`,
    `Summary: ${params.summary}`,
  ];

  if (params.slashCommand) {
    lines.push(`Operator instruction: ${params.slashCommand}`);
  }

  if (params.finalRecipients) {
    lines.push(`Recipients: ${params.finalRecipients}`);
  }

  if (params.previewDraft) {
    lines.push(`Draft preview: ${params.previewDraft}`);
  }

  lines.push(bridgeLine);

  return lines.join("\n");
}

export async function submitDecisionToOpenClaw(
  params: SubmitDecisionParams,
): Promise<OpenClawDecisionSubmissionResult> {
  const bridgeEnvelope = buildDecisionBridgeEnvelope(params);
  let bridgeFilePath: string | null = null;
  let bridgeErrorMessage: string | undefined;

  const newStatus = ACTION_TO_STATUS[params.action];
  await writeNotificationStatus(params.itemId, newStatus);

  try {
    const queued = await enqueueBridgeEnvelope(bridgeEnvelope);
    bridgeFilePath = queued.filePath;
  } catch (error) {
    bridgeErrorMessage =
      error instanceof Error ? error.message : "Failed to queue bridge envelope";
  }

  const sc = resolveSlashCommandMode(params.slashCommand);
  const channelMessage = buildDecisionChannelMessage({
    action: params.action,
    slashCommand: sc.content,
    slashCommandMode: sc.mode,
    source: params.source,
    summary: params.summary,
    finalRecipients: params.finalRecipients,
    previewDraft: params.previewDraft,
    bridgeFilePath: bridgeFilePath ?? undefined,
  });

  // Fire channel message in the background — OpenClaw can take up to 180s to
  // ACK. We don't block the HTTP response on it; the bridge file write above
  // is the durable record that the decision was received.
  sendChannelMessage({
    message: channelMessage,
    sessionId: SLACKOFF_DECISION_SESSION_ID,
  }).catch(() => {
    // Errors are non-fatal: the bridge file already recorded the decision.
  });

  return {
    ok: true,
    action: params.action,
    fullySynced: Boolean(bridgeFilePath),
    bridge: {
      ok: Boolean(bridgeFilePath),
      type: bridgeEnvelope.type,
      filePath: bridgeFilePath,
      errorMessage: bridgeErrorMessage,
    },
    channel: {
      ok: false,
      pending: true,
      replyText: null,
      sessionId: SLACKOFF_DECISION_SESSION_ID,
      durationMs: null,
      state: null,
      errorMessage: undefined,
    },
  };
}
