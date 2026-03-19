import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
  DEFAULT_OPENCLAW_DECISION_SESSION_ID,
} from "@/lib/openclaw/constants";
import {
  buildAgentCommandArgs,
  extractAgentJsonPayload,
  filterChannelMessages,
  parseChannelTranscript,
  resolveChannelLimit,
  resolveChannelSessionId,
} from "@/lib/openclaw/channel";

describe("parseChannelTranscript", () => {
  it("extracts user and assistant text messages from session jsonl", () => {
    const transcript = [
      JSON.stringify({
        type: "session",
        id: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
      }),
      JSON.stringify({
        type: "message",
        id: "user-1",
        timestamp: "2026-03-15T06:00:00.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "hello openclaw" }],
        },
      }),
      JSON.stringify({
        type: "message",
        id: "assistant-1",
        timestamp: "2026-03-15T06:00:01.000Z",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal" },
            { type: "text", text: "hello slackoff" },
          ],
        },
      }),
    ].join("\n");

    expect(parseChannelTranscript(transcript, 20)).toEqual([
      {
        id: "user-1",
        role: "user",
        text: "hello openclaw",
        timestamp: "2026-03-15T06:00:00.000Z",
      },
      {
        id: "assistant-1",
        role: "assistant",
        text: "hello slackoff",
        timestamp: "2026-03-15T06:00:01.000Z",
      },
    ]);
  });

  it("skips malformed json lines so polling survives concurrent writes", () => {
    const transcript = [
      JSON.stringify({
        type: "message",
        id: "user-1",
        timestamp: "2026-03-15T06:00:00.000Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "hello openclaw" }],
        },
      }),
      '{"type":"message"',
      JSON.stringify({
        type: "message",
        id: "assistant-1",
        timestamp: "2026-03-15T06:00:01.000Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hello slackoff" }],
        },
      }),
    ].join("\n");

    expect(parseChannelTranscript(transcript, 20)).toEqual([
      {
        id: "user-1",
        role: "user",
        text: "hello openclaw",
        timestamp: "2026-03-15T06:00:00.000Z",
      },
      {
        id: "assistant-1",
        role: "assistant",
        text: "hello slackoff",
        timestamp: "2026-03-15T06:00:01.000Z",
      },
    ]);
  });
});

describe("extractAgentJsonPayload", () => {
  it("parses clean json output from the cli", () => {
    const payload = extractAgentJsonPayload(
      JSON.stringify({
        payloads: [{ text: "SLACKOFF_OK" }],
        meta: { durationMs: 12 },
      }),
    );

    expect(payload.payloads?.[0]?.text).toBe("SLACKOFF_OK");
    expect(payload.meta?.durationMs).toBe(12);
  });
});

describe("filterChannelMessages", () => {
  it("removes legacy decision prompts from the manual chat session", () => {
    expect(
      filterChannelMessages(
        [
          {
            id: "u1",
            role: "user",
            text:
              "You are the local OpenClaw runtime connected to Slackoff.\n\nA human operator just made an internal decision in Slackoff.",
            timestamp: "2026-03-16T03:23:01.959Z",
          },
          {
            id: "a1",
            role: "assistant",
            text: "ACK: 已接受人工决策。\nNEXT: OpenClaw 将继续处理。",
            timestamp: "2026-03-16T03:23:07.358Z",
          },
          {
            id: "u2",
            role: "user",
            text: "请只回复 FINAL_UI_OK",
            timestamp: "2026-03-16T03:23:08.000Z",
          },
          {
            id: "a2",
            role: "assistant",
            text: "FINAL_UI_OK",
            timestamp: "2026-03-16T03:23:09.000Z",
          },
        ],
        DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
      ),
    ).toEqual([
      {
        id: "u2",
        role: "user",
        text: "请只回复 FINAL_UI_OK",
        timestamp: "2026-03-16T03:23:08.000Z",
      },
      {
        id: "a2",
        role: "assistant",
        text: "FINAL_UI_OK",
        timestamp: "2026-03-16T03:23:09.000Z",
      },
    ]);
  });

  it("keeps decision-session acknowledgements intact", () => {
    const messages = [
      {
        id: "u1",
        role: "user" as const,
        text:
          "You are the local OpenClaw runtime connected to Slackoff.\n\nA human operator just made an internal decision in Slackoff.",
        timestamp: "2026-03-16T03:23:01.959Z",
      },
      {
        id: "a1",
        role: "assistant" as const,
        text: "ACK: 已接受人工决策。\nNEXT: OpenClaw 将继续处理。",
        timestamp: "2026-03-16T03:23:07.358Z",
      },
    ];

    expect(
      filterChannelMessages(messages, DEFAULT_OPENCLAW_DECISION_SESSION_ID),
    ).toEqual(messages);
  });
});

describe("buildAgentCommandArgs", () => {
  it("builds a stable local cli command for the channel session", () => {
    expect(
      buildAgentCommandArgs({
        agentId: "main",
        message: "Ping",
        sessionId: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
        timeoutSeconds: 90,
      }),
    ).toEqual([
      "agent",
      "--local",
      "--json",
      "--agent",
      "main",
      "--session-id",
      DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
      "--timeout",
      "90",
      "--message",
      "Ping",
    ]);
  });
});

describe("resolveChannelSessionId", () => {
  it("falls back to the shared default session id", () => {
    expect(resolveChannelSessionId()).toBe(DEFAULT_OPENCLAW_CHANNEL_SESSION_ID);
    expect(resolveChannelSessionId("   ")).toBe(DEFAULT_OPENCLAW_CHANNEL_SESSION_ID);
  });

  it("rejects unsafe session ids", () => {
    expect(() => resolveChannelSessionId("../escape")).toThrow(
      /letters, numbers, hyphens, or underscores/i,
    );
  });
});

describe("resolveChannelLimit", () => {
  it("normalizes valid transcript limits", () => {
    expect(resolveChannelLimit()).toBe(24);
    expect(resolveChannelLimit(3.8)).toBe(4);
    expect(resolveChannelLimit(500)).toBe(100);
  });

  it("rejects invalid transcript limits", () => {
    expect(() => resolveChannelLimit(0)).toThrow(/positive number/i);
    expect(() => resolveChannelLimit(Number.NaN)).toThrow(/positive number/i);
  });
});
