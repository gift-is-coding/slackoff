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
    value === "confirm_execute"
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

function buildDecisionBridgeEnvelope(
  params: SubmitDecisionParams,
): DecisionBridgeEnvelope {
  switch (params.action) {
    case "approve_plan":
      return {
        type: "decision.plan_approved",
        payload: {
          itemId: params.itemId,
          decision: "approve_plan",
          slashCommand: params.slashCommand || "",
          source: params.source,
          summary: params.summary,
        },
      };
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
    case "request_edit":
      return {
        type: "decision.edit_requested",
        payload: {
          itemId: params.itemId,
          decision: "request_edit",
          slashCommand: params.slashCommand || "",
          source: params.source,
          summary: params.summary,
        },
      };
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
  }
}

export function buildDecisionChannelMessage(params: {
  bridgeType: string;
  bridgeFilePath?: string;
  payload: Record<string, unknown>;
}) {
  const bridgePathLine = params.bridgeFilePath
    ? `Bridge inbox file: ${params.bridgeFilePath}`
    : "Bridge inbox file: unavailable";

  return [
    "You are the local OpenClaw runtime connected to Slackoff.",
    "A human operator just made an internal decision in Slackoff.",
    "This is not confirmation that any external message has already been sent.",
    "Acknowledge the decision in Chinese with exactly two short lines.",
    "Line 1 must start with ACK: and describe the accepted human decision.",
    "Line 2 must start with NEXT: and describe the next internal OpenClaw step.",
    bridgePathLine,
    "Decision envelope:",
    JSON.stringify(
      {
        bridgeType: params.bridgeType,
        payload: params.payload,
      },
      null,
      2,
    ),
  ].join("\n\n");
}

export async function submitDecisionToOpenClaw(
  params: SubmitDecisionParams,
): Promise<OpenClawDecisionSubmissionResult> {
  const bridgeEnvelope = buildDecisionBridgeEnvelope(params);
  let bridgeFilePath: string | null = null;
  let bridgeErrorMessage: string | undefined;

  // Persist the decision status to the notification inbox file
  const newStatus = ACTION_TO_STATUS[params.action];
  await writeNotificationStatus(params.itemId, newStatus);

  try {
    const queued = await enqueueBridgeEnvelope(bridgeEnvelope);
    bridgeFilePath = queued.filePath;
  } catch (error) {
    bridgeErrorMessage =
      error instanceof Error ? error.message : "Failed to queue bridge envelope";
  }

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
      ok: true, // Mock success since we bypass the CLI
      replyText: "操作已记录本地方案文件中，等待后台独立执行。",
      sessionId: SLACKOFF_DECISION_SESSION_ID,
      durationMs: 0,
      state: null,
    },
  };
}
