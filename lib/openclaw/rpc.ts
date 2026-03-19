import { randomUUID } from "node:crypto";
import { callGateway } from "@/lib/openclaw/gateway-client";
import type { AllowedOpenClawRpcMethod } from "@/lib/slackoff/types";

export const SLACKOFF_SESSION_KEY =
  process.env.OPENCLAW_SLACKOFF_SESSION_KEY?.trim() || "agent:main:slackoff";

const allowedMethods = new Set<AllowedOpenClawRpcMethod>([
  "health",
  "sessions.list",
  "chat.history",
  "chat.send",
  "chat.abort",
]);

type RawRpcBody = {
  method?: string;
  params?: Record<string, unknown>;
};

export function getAllowedOpenClawRpcMethods(): AllowedOpenClawRpcMethod[] {
  return [...allowedMethods];
}

export function isAllowedOpenClawRpcMethod(
  method: string,
): method is AllowedOpenClawRpcMethod {
  return allowedMethods.has(method as AllowedOpenClawRpcMethod);
}

export function normalizeOpenClawRpcBody(body: unknown): {
  method: AllowedOpenClawRpcMethod;
  params?: Record<string, unknown>;
} {
  if (!body || typeof body !== "object") {
    throw new Error("RPC body must be an object");
  }

  const raw = body as RawRpcBody;
  const method = raw.method?.trim();

  if (!method || !isAllowedOpenClawRpcMethod(method)) {
    throw new Error("Unsupported OpenClaw RPC method");
  }

  const params = raw.params ?? {};

  if (method === "chat.send") {
    const message = String(params.message ?? "").trim();

    if (!message) {
      throw new Error("chat.send requires a non-empty message");
    }

    return {
      method,
      params: {
        ...params,
        sessionKey:
          typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
            ? params.sessionKey
            : SLACKOFF_SESSION_KEY,
        message,
        deliver: false,
        timeoutMs: typeof params.timeoutMs === "number" ? params.timeoutMs : 15_000,
        idempotencyKey:
          typeof params.idempotencyKey === "string" && params.idempotencyKey.trim().length > 0
            ? params.idempotencyKey
            : randomUUID(),
      },
    };
  }

  if (method === "chat.history" || method === "chat.abort") {
    return {
      method,
      params: {
        ...params,
        sessionKey:
          typeof params.sessionKey === "string" && params.sessionKey.trim().length > 0
            ? params.sessionKey
            : SLACKOFF_SESSION_KEY,
      },
    };
  }

  return {
    method,
    params,
  };
}

export async function forwardOpenClawRpc(body: unknown) {
  const normalized = normalizeOpenClawRpcBody(body);
  return callGateway({
    method: normalized.method,
    params: normalized.params,
  });
}
