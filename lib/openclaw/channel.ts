import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DEFAULT_OPENCLAW_CHANNEL_SESSION_ID } from "@/lib/openclaw/constants";
import type {
  OpenClawChannelMessage,
  OpenClawChannelState,
  OpenClawChannelTurnResult,
} from "@/lib/slackoff/types";

const execFileAsync = promisify(execFile);
const DEFAULT_LIMIT = 24;
const DEFAULT_TIMEOUT_SECONDS = 180;
const MAX_TRANSCRIPT_LIMIT = 100;
const MAX_SESSION_ID_CHARS = 80;
const MAX_MESSAGE_CHARS = 8_000;
const CHANNEL_SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

type TranscriptLine = {
  type?: string;
  id?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  };
};

type OpenClawAgentPayload = {
  payloads?: Array<{
    text?: string | null;
    mediaUrl?: string | null;
  }>;
  meta?: {
    durationMs?: number;
    agentMeta?: {
      sessionId?: string;
      provider?: string;
      model?: string;
    };
  };
};

export const SLACKOFF_CHANNEL_SESSION_ID =
  process.env.OPENCLAW_SLACKOFF_CHANNEL_SESSION_ID?.trim() ||
  DEFAULT_OPENCLAW_CHANNEL_SESSION_ID;

function resolveStateRoot() {
  return process.env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw");
}

function resolveAgentId() {
  return process.env.OPENCLAW_AGENT_ID?.trim() || "main";
}

function resolveCliAgentId() {
  return process.env.OPENCLAW_CHANNEL_AGENT_ID?.trim();
}

function resolveStateAgentId() {
  return resolveCliAgentId() || resolveAgentId();
}

function resolveOpenClawBin() {
  return process.env.OPENCLAW_BIN?.trim() || "openclaw";
}

export function resolveChannelSessionId(sessionId?: string) {
  const trimmed = sessionId?.trim();

  if (!trimmed) {
    return SLACKOFF_CHANNEL_SESSION_ID;
  }

  if (
    trimmed.length > MAX_SESSION_ID_CHARS ||
    !CHANNEL_SESSION_ID_PATTERN.test(trimmed)
  ) {
    throw new Error(
      "sessionId must use only letters, numbers, hyphens, or underscores",
    );
  }

  return trimmed;
}

export function resolveChannelLimit(limit?: number) {
  if (limit == null) {
    return DEFAULT_LIMIT;
  }

  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("limit must be a positive number");
  }

  return Math.min(Math.round(limit), MAX_TRANSCRIPT_LIMIT);
}

export function resolveChannelSessionFile(sessionId?: string) {
  return path.join(
    resolveStateRoot(),
    "agents",
    resolveStateAgentId(),
    "sessions",
    `${resolveChannelSessionId(sessionId)}.jsonl`,
  );
}

function extractMessageText(line: TranscriptLine) {
  const content = Array.isArray(line.message?.content) ? line.message.content : [];
  return content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function parseChannelTranscript(content: string, limit = DEFAULT_LIMIT) {
  const messages: OpenClawChannelMessage[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    let parsed: TranscriptLine;

    try {
      parsed = JSON.parse(line) as TranscriptLine;
    } catch {
      continue;
    }

    if (parsed.type !== "message") {
      continue;
    }

    const text = extractMessageText(parsed);

    if (!text) {
      continue;
    }

    messages.push({
      id: parsed.id || `${parsed.timestamp || "message"}-${messages.length}`,
      role:
        parsed.message?.role === "user" ||
        parsed.message?.role === "assistant" ||
        parsed.message?.role === "system" ||
        parsed.message?.role === "tool"
          ? parsed.message.role
          : "unknown",
      text,
      timestamp: parsed.timestamp || "",
    });
  }

  return messages.slice(-limit);
}

function isLegacyDecisionProtocolPrompt(message: OpenClawChannelMessage) {
  return (
    message.role === "user" &&
    message.text.startsWith("You are the local OpenClaw runtime connected to Slackoff.") &&
    message.text.includes("A human operator just made an internal decision in Slackoff.")
  );
}

function isLegacyDecisionProtocolAck(message: OpenClawChannelMessage) {
  return (
    message.role === "assistant" &&
    message.text.startsWith("ACK:") &&
    message.text.includes("NEXT:")
  );
}

export function filterChannelMessages(
  messages: OpenClawChannelMessage[],
  sessionId: string,
) {
  if (sessionId !== DEFAULT_OPENCLAW_CHANNEL_SESSION_ID) {
    return messages;
  }

  const filtered: OpenClawChannelMessage[] = [];
  let skipNextLegacyAck = false;

  for (const message of messages) {
    if (isLegacyDecisionProtocolPrompt(message)) {
      skipNextLegacyAck = true;
      continue;
    }

    if (skipNextLegacyAck) {
      skipNextLegacyAck = false;
      if (isLegacyDecisionProtocolAck(message)) {
        continue;
      }
    }

    filtered.push(message);
  }

  return filtered;
}

export function extractAgentJsonPayload(stdout: string) {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error("OpenClaw CLI returned empty stdout");
  }

  try {
    return JSON.parse(trimmed) as OpenClawAgentPayload;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Unable to parse OpenClaw CLI JSON output");
    }

    return JSON.parse(trimmed.slice(start, end + 1)) as OpenClawAgentPayload;
  }
}

export function buildAgentCommandArgs(params: {
  sessionId: string;
  message: string;
  timeoutSeconds?: number;
  agentId?: string;
}) {
  const args = ["agent", "--local", "--json"];

  if (params.agentId) {
    args.push("--agent", params.agentId);
  }

  args.push(
    "--session-id",
    params.sessionId,
    "--timeout",
    String(params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS),
    "--message",
    params.message,
  );

  return args;
}

export async function readChannelState(params?: {
  sessionId?: string;
  limit?: number;
}): Promise<OpenClawChannelState> {
  const sessionId = resolveChannelSessionId(params?.sessionId);
  const sessionFile = resolveChannelSessionFile(sessionId);
  const limit = resolveChannelLimit(params?.limit);

  try {
    await stat(sessionFile);
  } catch {
    return {
      mode: "local-cli",
      sessionId,
      sessionFile: null,
      exists: false,
      messages: [],
    };
  }

  const content = await readFile(sessionFile, "utf8");
  const messages = filterChannelMessages(parseChannelTranscript(content, limit), sessionId);

  return {
    mode: "local-cli",
    sessionId,
    sessionFile,
    exists: true,
    messages,
  };
}

export async function sendChannelMessage(params: {
  message: string;
  sessionId?: string;
  limit?: number;
  timeoutSeconds?: number;
}): Promise<OpenClawChannelTurnResult> {
  const message = params.message.trim();

  if (!message) {
    throw new Error("Channel message cannot be empty");
  }

  if (message.length > MAX_MESSAGE_CHARS) {
    throw new Error(`Channel message cannot exceed ${MAX_MESSAGE_CHARS} characters`);
  }

  const sessionId = resolveChannelSessionId(params.sessionId);
  const limit = resolveChannelLimit(params.limit);

  try {
    const result = await execFileAsync(
      resolveOpenClawBin(),
      buildAgentCommandArgs({
        agentId: resolveCliAgentId(),
        sessionId,
        message,
        timeoutSeconds: params.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
      }),
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          NO_COLOR: "1",
        },
      },
    );
    const payload = extractAgentJsonPayload(result.stdout);
    const state = await readChannelState({
      sessionId,
      limit,
    });

    if (!state.exists || !state.sessionFile) {
      throw new Error(
        `OpenClaw replied but did not persist a transcript for session ${sessionId}`,
      );
    }

    const replyText =
      payload.payloads
        ?.map((entry) => entry.text?.trim())
        .filter((entry): entry is string => Boolean(entry))
        .join("\n\n") || null;

    return {
      ok: true,
      replyText,
      meta: {
        durationMs: payload.meta?.durationMs ?? null,
        sessionId: payload.meta?.agentMeta?.sessionId || sessionId,
        mode: "local-cli",
        provider: payload.meta?.agentMeta?.provider,
        model: payload.meta?.agentMeta?.model,
      },
      state,
    };
  } catch (error) {
    const failure = error as Error & {
      stdout?: string;
      stderr?: string;
    };

    throw new Error(
      failure.stderr?.trim() ||
        failure.stdout?.trim() ||
        failure.message ||
        "OpenClaw channel send failed",
    );
  }
}
