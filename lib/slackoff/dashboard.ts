import { getAllowedOpenClawRpcMethods, SLACKOFF_SESSION_KEY } from "@/lib/openclaw/rpc";
import type { DashboardSnapshot } from "@/lib/slackoff/types";

const integrationBoundaries = [
  {
    title: "Slackoff owns",
    description:
      "Command Center UI, queue visualization, keyboard rhythm, plan confirmation, execution confirmation.",
  },
  {
    title: "OpenClaw owns",
    description:
      "Message ingestion, notification reading, AI drafting, screenshot capture, tool execution, audit trail.",
  },
];

function createInitialGatewayState() {
  return {
    ok: false,
    url: process.env.OPENCLAW_GATEWAY_URL?.trim() || "ws://127.0.0.1:18789",
    bindLabel: "loopback",
    defaultAgentId: "main",
    sessionCount: 0,
    configuredChannelCount: 0,
    activeChannelCount: 0,
    channels: [
      {
        id: "gateway",
        label: "Gateway",
        state: "configured" as const,
        detail: "probing local OpenClaw gateway...",
      },
    ],
    recentSessions: [],
  };
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const generatedAtLabel = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return {
    generatedAtLabel,
    modeLabel: "Local OpenClaw Gateway",
    selectedItemId: null,
    items: [],
    integration: {
      modeLabel: "Frontend shell + local gateway adapter",
      slackoffSessionKey: SLACKOFF_SESSION_KEY,
      supportedRpcMethods: getAllowedOpenClawRpcMethods(),
      gateway: createInitialGatewayState(),
      boundaries: integrationBoundaries,
    },
  };
}
