import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type RawOpenClawConfig = {
  gateway?: {
    port?: number;
    bind?: string;
    auth?: {
      mode?: string;
      token?: string;
      password?: string;
    };
  };
};

export type LocalGatewayConfig = {
  url: string;
  bindLabel: string;
  authMode: string;
  token?: string;
  password?: string;
};

const DEFAULT_GATEWAY_PORT = 18789;

function getDefaultConfigPath() {
  return path.join(os.homedir(), ".openclaw", "openclaw.json");
}

function normalizeGatewayUrl(port: number) {
  return process.env.OPENCLAW_GATEWAY_URL?.trim() || `ws://127.0.0.1:${port}`;
}

export async function readLocalGatewayConfig(): Promise<LocalGatewayConfig> {
  const configPath = process.env.OPENCLAW_CONFIG_PATH?.trim() || getDefaultConfigPath();
  const file = await readFile(configPath, "utf8");
  const parsed = JSON.parse(file) as RawOpenClawConfig;
  const port = parsed.gateway?.port ?? DEFAULT_GATEWAY_PORT;
  const bindMode = parsed.gateway?.bind ?? "loopback";
  const authMode = parsed.gateway?.auth?.mode ?? "token";

  return {
    url: normalizeGatewayUrl(port),
    bindLabel: bindMode,
    authMode,
    token: process.env.OPENCLAW_GATEWAY_TOKEN?.trim() || parsed.gateway?.auth?.token,
    password:
      process.env.OPENCLAW_GATEWAY_PASSWORD?.trim() || parsed.gateway?.auth?.password,
  };
}
