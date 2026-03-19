"use client";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenClawChannel } from "@/components/openclaw-channel";
import { DEFAULT_OPENCLAW_CHANNEL_SESSION_ID } from "@/lib/openclaw/constants";

const mockFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method || "GET";

  if (!url.includes("/api/openclaw/channel")) {
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }

  if (method === "POST") {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        ok: true,
        replyText: "OpenClaw reply",
        meta: {
          durationMs: 42,
          sessionId: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
          mode: "local-cli",
        },
        state: {
          mode: "local-cli",
          sessionId: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
          sessionFile: `/tmp/${DEFAULT_OPENCLAW_CHANNEL_SESSION_ID}.jsonl`,
          exists: true,
          messages: [
            {
              id: "user-1",
              role: "user",
              text: "Hello",
              timestamp: "2026-03-15T06:00:00.000Z",
            },
            {
              id: "assistant-1",
              role: "assistant",
              text: "OpenClaw reply",
              timestamp: "2026-03-15T06:00:01.000Z",
            },
          ],
        },
      }),
    });
  }

  return Promise.resolve({
    ok: true,
    json: async () => ({
      mode: "local-cli",
      sessionId: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
      sessionFile: `/tmp/${DEFAULT_OPENCLAW_CHANNEL_SESSION_ID}.jsonl`,
      exists: true,
      messages: [
        {
          id: "assistant-0",
          role: "assistant",
          text: "Ready",
          timestamp: "2026-03-15T05:59:00.000Z",
        },
      ],
    }),
  });
});

describe("OpenClawChannel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads channel history", async () => {
    render(<OpenClawChannel />);

    expect(await screen.findByText("Ready")).toBeInTheDocument();
    expect(screen.getAllByText(DEFAULT_OPENCLAW_CHANNEL_SESSION_ID).length).toBeGreaterThan(
      0,
    );
  });

  it("sends a message and renders the reply", async () => {
    const user = userEvent.setup();

    render(<OpenClawChannel />);

    const input = await screen.findByPlaceholderText("向 OpenClaw 发送消息...");
    await user.type(input, "Hello");
    await user.click(screen.getByRole("button", { name: /发送到 openclaw/i }));

    await waitFor(() => {
      expect(screen.getByText("OpenClaw reply")).toBeInTheDocument();
    });
  });
});
