"use client";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandCenter } from "@/components/command-center";
import {
  DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
  DEFAULT_OPENCLAW_DECISION_SESSION_ID,
} from "@/lib/openclaw/constants";
import { getDashboardSnapshot } from "@/lib/slackoff/dashboard";

import type { WorkItem } from "@/lib/slackoff/types";

function makeTestItem(overrides: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    priority: "P2",
    channel: "test / channel",
    source: "Test",
    owner: "test",
    summary: "test item",
    deadline: "--",
    risk: "low",
    riskLabel: "低",
    recommendedAction: "",
    explanation: "",
    sourceMessage: "",
    aiDraft: "",
    finalRecipients: "",
    previewDraft: "",
    previewNote: "",
    screenshotCaption: "",
    ...overrides,
  };
}

const testWorkItems: WorkItem[] = [
  makeTestItem({ id: "contract-clause", priority: "P0", risk: "high", riskLabel: "高", source: "Slack", channel: "slack / #engineering-incidents", owner: "客户 A", summary: "系统警报：数据库连接失败，影响支付服务。", deadline: "今日 14:00", sourceMessage: "Hi, we are blocked", aiDraft: "收到。建议先按两步处理", finalRecipients: "收件人: #ops-alerts", previewDraft: "根据历史上下文", previewNote: "发送区域", screenshotCaption: "执行前整图核对" }),
  makeTestItem({ id: "review-owner", priority: "P1", risk: "medium", riskLabel: "中", source: "Email", channel: "email / product-review", owner: "PM", summary: "明早评审资料 owner 未确认", deadline: "今日 18:00" }),
  makeTestItem({ id: "budget-reminder", priority: "P2", risk: "low", riskLabel: "低", source: "Teams", channel: "teams / finance", owner: "财务", summary: "预算审批提醒", deadline: "明日 10:00" }),
  makeTestItem({ id: "customer-login", priority: "P0", risk: "high", riskLabel: "高", source: "Email", channel: "email / customer-support", owner: "客户工单", summary: "用户报告无法登录", deadline: "今日 15:30" }),
];

const mockFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method || "GET";

  if (url.includes("/api/openclaw/items")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        items: testWorkItems,
        fetchedAt: new Date().toISOString(),
        count: testWorkItems.length,
      }),
    });
  }

  if (url.includes("/api/openclaw/health")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        ok: true,
        url: "ws://127.0.0.1:18789",
        bindLabel: "loopback",
        defaultAgentId: "main",
        sessionCount: 2,
        configuredChannelCount: 3,
        activeChannelCount: 1,
        channels: [
          {
            id: "gateway",
            label: "Gateway",
            state: "online",
            detail: "Connected",
          },
        ],
        recentSessions: [
          {
            key: "slackoff-main",
            ageLabel: "2m ago",
          },
        ],
      }),
    });
  }

  if (url.includes("/api/openclaw/channel")) {
    if (method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ok: true,
          replyText: "ACK: 已收到 Slackoff 的方案确认\nNEXT: OpenClaw 将继续处理。",
          meta: {
            durationMs: 128,
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
                id: "assistant-ack",
                role: "assistant",
                text: "ACK: 已收到 Slackoff 的方案确认\nNEXT: OpenClaw 将继续处理。",
                timestamp: "2026-03-15T06:00:00.000Z",
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
  }

  if (url.includes("/api/openclaw/decision")) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        ok: true,
        action: "approve_plan",
        fullySynced: true,
        bridge: {
          ok: true,
          type: "decision.plan_approved",
          filePath: "/tmp/slackoff/inbox/decision.json",
        },
        channel: {
          ok: true,
          replyText: "ACK: 已收到 Slackoff 的方案确认\nNEXT: OpenClaw 将继续处理。",
          sessionId: DEFAULT_OPENCLAW_DECISION_SESSION_ID,
          durationMs: 128,
          state: {
            mode: "local-cli",
            sessionId: DEFAULT_OPENCLAW_DECISION_SESSION_ID,
            sessionFile: `/tmp/${DEFAULT_OPENCLAW_DECISION_SESSION_ID}.jsonl`,
            exists: true,
            messages: [
              {
                id: "assistant-ack",
                role: "assistant",
                text: "ACK: 已收到 Slackoff 的方案确认\nNEXT: OpenClaw 将继续处理。",
                timestamp: "2026-03-15T06:00:00.000Z",
              },
            ],
          },
        },
      }),
    });
  }

  return Promise.resolve({
    ok: true,
    json: async () => ({
      paths: {
        root: "/tmp/slackoff",
        inbox: "/tmp/slackoff/inbox",
        outbox: "/tmp/slackoff/outbox",
      },
      latestOutbox: {
        filePath: "/tmp/slackoff/outbox/latest.json",
        payload: {},
      },
      notes: ["bridge ready"],
    }),
  });
});

describe("CommandCenter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("filters queue cards from the search box", async () => {
    const user = userEvent.setup();

    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    const searchInput = screen.getByLabelText("Search queue");
    await user.type(searchInput, "from:email");

    expect(screen.getByTestId("queue-card-review-owner")).toBeInTheDocument();
    expect(screen.getByTestId("queue-card-customer-login")).toBeInTheDocument();
    expect(screen.queryByTestId("queue-card-contract-clause")).not.toBeInTheDocument();
  });

  it("supports keyboard shortcuts for focus and help", async () => {
    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    fireEvent.keyDown(window, { key: "?" });
    expect(
      screen.getByRole("dialog", { name: /keyboard rhythm/i }),
    ).toBeInTheDocument();
  });

  it("submits approval and advances to step 2", async () => {
    const user = userEvent.setup();

    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    expect(screen.getByText("1 Plan")).toHaveClass("active");

    await user.click(screen.getByRole("button", { name: /Y 确认方案/ }));

    await waitFor(() => {
      expect(
        screen.getByText(/方案确认 已写入 \/tmp\/slackoff\/inbox\/decision\.json/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("2 Execute")).toHaveClass("active");
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("Enter key triggers confirm on current step", async () => {
    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    expect(screen.getByText("1 Plan")).toHaveClass("active");

    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("2 Execute")).toHaveClass("active");
    });
  });

  it("shows notification dot when item advances while not selected", async () => {
    const user = userEvent.setup();

    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    await user.click(screen.getByRole("button", { name: /Y 确认方案/ }));

    await waitFor(() => {
      expect(screen.getByText("2 Execute")).toHaveClass("active");
    });

    fireEvent.keyDown(window, { key: "s" });

    await waitFor(() => {
      expect(screen.getByTestId("queue-card-review-owner")).toHaveAttribute("aria-pressed", "true");
    });

    expect(screen.queryByTestId("notif-dot-contract-clause")).not.toBeInTheDocument();
  });

  it("keeps rendering when the bridge status request fails", async () => {
    const bridgeFailureFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/openclaw/bridge") && !init?.method) {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            ok: false,
            errorMessage: "bridge unavailable",
          }),
        });
      }

      return mockFetch(input, init);
    });

    vi.stubGlobal("fetch", bridgeFailureFetch);

    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    expect(await screen.findByText("OpenClaw Channel")).toBeInTheDocument();
  });

  it("displays the step indicator with three steps", async () => {
    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    expect(screen.getByText("1 Plan")).toBeInTheDocument();
    expect(screen.getByText("2 Execute")).toBeInTheDocument();
    expect(screen.getByText("3 Results")).toBeInTheDocument();
  });

  it("shows shortcut bar with hints", async () => {
    render(<CommandCenter snapshot={getDashboardSnapshot()} />);

    await screen.findByTestId("queue-card-contract-clause");

    const shortcutBar = document.querySelector(".shortcut-bar")!;
    expect(shortcutBar).toBeInTheDocument();
    expect(shortcutBar.textContent).toContain("Y/Enter 确认");
    expect(shortcutBar.textContent).toContain("I 忽略");
    expect(shortcutBar.textContent).toContain("/ 指令");
    expect(shortcutBar.textContent).toContain("W/S 导航");
  });
});
