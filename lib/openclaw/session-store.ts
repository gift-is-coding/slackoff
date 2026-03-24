import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type SessionStoreEntry = {
  sessionId?: string;
  updatedAt?: number;
  sessionFile?: string;
  origin?: {
    label?: string;
    provider?: string;
    to?: string;
  };
  lastTo?: string;
};

type TranscriptMessageLine = {
  type?: string;
  timestamp?: string;
  message?: {
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
    errorMessage?: string;
    stopReason?: string;
  };
};

function resolveSessionsDirectory() {
  const agentId = process.env.OPENCLAW_AGENT_ID?.trim() || "main";
  return path.join(os.homedir(), ".openclaw", "agents", agentId, "sessions");
}

async function readSessionStore() {
  const sessionsPath = path.join(resolveSessionsDirectory(), "sessions.json");
  const raw = await readFile(sessionsPath, "utf8");
  return JSON.parse(raw) as Record<string, SessionStoreEntry>;
}

function extractMessageText(line: TranscriptMessageLine) {
  const content = Array.isArray(line.message?.content) ? line.message?.content : [];
  const text = content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text?.trim())
    .filter(Boolean)
    .join("\n\n");

  if (text) {
    return text;
  }

  return line.message?.errorMessage || line.message?.stopReason || "";
}

export async function listSessionStoreEntries(limit = 20) {
  const store = await readSessionStore();

  return Object.entries(store)
    .map(([key, entry]) => ({
      key,
      sessionId: entry.sessionId || "",
      updatedAt: entry.updatedAt || 0,
      sessionFile: entry.sessionFile || "",
      label: entry.origin?.label || entry.lastTo || entry.origin?.provider || "session",
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, limit);
}

export async function readSessionTranscript(params: {
  sessionKey: string;
  limit?: number;
}) {
  const store = await readSessionStore();
  const entry = store[params.sessionKey];

  if (!entry?.sessionFile) {
    throw new Error(`Session not found: ${params.sessionKey}`);
  }

  const transcript = await readFile(entry.sessionFile, "utf8");
  const lines = transcript
    .trim()
    .split("\n")
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as TranscriptMessageLine];
      } catch {
        return [];
      }
    })
    .filter((line) => line.type === "message")
    .map((line) => ({
      timestamp: line.timestamp || "",
      role: line.message?.role || "unknown",
      text: extractMessageText(line),
    }))
    .filter((line) => line.text.length > 0);

  return {
    sessionKey: params.sessionKey,
    sessionFile: entry.sessionFile,
    messages: lines.slice(-(params.limit || 20)),
  };
}
