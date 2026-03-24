import WebSocket from "ws";
import { readLocalGatewayConfig } from "@/lib/openclaw/config";
import type { Lang } from "@/lib/i18n/dict";
import { formatTimeLabel } from "@/lib/slackoff/work-item-mapper";
import type {
  AllowedOpenClawRpcMethod,
  GatewayChannelBrief,
  GatewayRecentSession,
  OpenClawGatewayHealth,
} from "@/lib/slackoff/types";

const PROTOCOL_VERSION = 3;
const REQUEST_TIMEOUT_MS = 5000;

type GatewayHealthPayload = {
  ok?: boolean;
  defaultAgentId?: string;
  channels?: Record<
    string,
    {
      configured?: boolean;
      running?: boolean;
      connected?: boolean;
      linked?: boolean;
      lastError?: string | null;
      lastProbeAt?: number | null;
    }
  >;
  channelLabels?: Record<string, string>;
  sessions?: {
    count?: number;
    recent?: Array<{
      key?: string;
      age?: number;
    }>;
  };
};

type ResponseFrame<TPayload> = {
  type: "res";
  id: string;
  ok: boolean;
  payload?: TPayload;
  error?: {
    message?: string;
  };
};

type GatewayCallOptions = {
  method: AllowedOpenClawRpcMethod;
  params?: unknown;
};

function resolveScopesForMethod(
  method: AllowedOpenClawRpcMethod,
): Array<"operator.read" | "operator.write"> {
  switch (method) {
    case "chat.send":
    case "chat.abort":
      return ["operator.write"];
    default:
      return ["operator.read"];
  }
}

function toRecentSessions(payload: GatewayHealthPayload, lang: Lang): GatewayRecentSession[] {
  return (payload.sessions?.recent ?? []).slice(0, 4).map((session) => ({
    key: session.key || "unknown",
    ageLabel: formatTimeLabel(new Date(Date.now() - (session.age ?? 0)).toISOString(), lang),
  }));
}

function toChannelState(channel: {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  linked?: boolean;
  lastError?: string | null;
}): GatewayChannelBrief["state"] {
  if (channel.running || channel.connected || channel.linked) {
    return "online";
  }
  if (channel.configured) {
    return "configured";
  }
  return "offline";
}

function buildChannelDetail(channel: {
  configured?: boolean;
  running?: boolean;
  connected?: boolean;
  linked?: boolean;
  lastError?: string | null;
  lastProbeAt?: number | null;
}) {
  if (channel.lastError) {
    return `last error: ${channel.lastError}`;
  }

  if (channel.running || channel.connected || channel.linked) {
    return "running locally";
  }

  if (channel.configured) {
    return channel.lastProbeAt ? "configured, waiting for workload" : "configured";
  }

  return "not configured";
}

export async function callGateway<TPayload>({
  method,
  params,
}: GatewayCallOptions): Promise<TPayload> {
  const gateway = await readLocalGatewayConfig();

  return await new Promise<TPayload>((resolve, reject) => {
    const connectId = "connect";
    const requestId = `req-${method}`;
    const ws = new WebSocket(gateway.url);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error(`OpenClaw gateway timeout while calling ${method}`));
    }, REQUEST_TIMEOUT_MS);

    const cleanup = () => clearTimeout(timer);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          type: "req",
          id: connectId,
          method: "connect",
          params: {
            minProtocol: PROTOCOL_VERSION,
            maxProtocol: PROTOCOL_VERSION,
            client: {
              id: "cli",
              displayName: "Slackoff",
              version: "0.1.0",
              platform: "nextjs",
              mode: "cli",
            },
            role: "operator",
            scopes: resolveScopesForMethod(method),
            auth:
              gateway.authMode === "token" && gateway.token
                ? { token: gateway.token }
                : gateway.authMode === "password" && gateway.password
                  ? { password: gateway.password }
                  : undefined,
          },
        }),
      );
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      let message: ResponseFrame<TPayload>;
      try {
        message = JSON.parse(String(raw)) as ResponseFrame<TPayload>;
      } catch {
        return;
      }

      if (message.type !== "res") {
        return;
      }

      if (message.id === connectId) {
        if (!message.ok) {
          cleanup();
          ws.close();
          reject(new Error(message.error?.message || "OpenClaw connect failed"));
          return;
        }

        ws.send(
          JSON.stringify({
            type: "req",
            id: requestId,
            method,
            params,
          }),
        );
        return;
      }

      if (message.id !== requestId) {
        return;
      }

      cleanup();
      ws.close();

      if (!message.ok) {
        reject(new Error(message.error?.message || `OpenClaw ${method} failed`));
        return;
      }

      resolve(message.payload as TPayload);
    });

    ws.on("error", (error: Error) => {
      cleanup();
      reject(error);
    });

    ws.on("close", () => {
      cleanup();
    });
  });
}

export async function getOpenClawHealth(lang: Lang = "zh"): Promise<OpenClawGatewayHealth> {
  try {
    const gateway = await readLocalGatewayConfig();
    const payload = await callGateway<GatewayHealthPayload>({ method: "health" });
    const channels = Object.entries(payload.channels ?? {})
      .slice(0, 6)
      .map(([id, channel]) => ({
        id,
        label: payload.channelLabels?.[id] || id,
        state: toChannelState(channel),
        detail: buildChannelDetail(channel),
      }));

    const configuredChannelCount = Object.values(payload.channels ?? {}).filter(
      (channel) => channel.configured,
    ).length;
    const activeChannelCount = Object.values(payload.channels ?? {}).filter(
      (channel) => channel.running || channel.connected || channel.linked,
    ).length;

    return {
      ok: Boolean(payload.ok),
      url: gateway.url,
      bindLabel: gateway.bindLabel,
      defaultAgentId: payload.defaultAgentId || "main",
      sessionCount: payload.sessions?.count ?? 0,
      configuredChannelCount,
      activeChannelCount,
      channels,
      recentSessions: toRecentSessions(payload, lang),
    };
  } catch (error) {
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
          state: "offline",
          detail: "failed to reach local OpenClaw gateway",
        },
      ],
      recentSessions: [],
      errorMessage: error instanceof Error ? error.message : "unknown gateway error",
    };
  }
}
