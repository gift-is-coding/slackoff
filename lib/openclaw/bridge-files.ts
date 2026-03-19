import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type BridgeEnvelope = {
  id: string;
  createdAt: string;
  source: "slackoff-web";
  type: string;
  payload: Record<string, unknown>;
};

function resolveBridgeRoot() {
  return path.join(os.homedir(), ".openclaw", "workspace", "slackoff", "bridge");
}

function resolveInboxDir() {
  return path.join(resolveBridgeRoot(), "inbox");
}

function resolveOutboxDir() {
  return path.join(resolveBridgeRoot(), "outbox");
}

async function ensureBridgeDirectories() {
  await Promise.all([
    mkdir(resolveInboxDir(), { recursive: true }),
    mkdir(resolveOutboxDir(), { recursive: true }),
  ]);
}

export function getBridgePaths() {
  return {
    root: resolveBridgeRoot(),
    inbox: resolveInboxDir(),
    outbox: resolveOutboxDir(),
  };
}

export async function enqueueBridgeEnvelope(params: {
  type: string;
  payload: Record<string, unknown>;
}) {
  await ensureBridgeDirectories();

  const envelope: BridgeEnvelope = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: "slackoff-web",
    type: params.type,
    payload: params.payload,
  };

  const filePath = path.join(resolveInboxDir(), `${Date.now()}-${envelope.id}.json`);
  await writeFile(filePath, JSON.stringify(envelope, null, 2), "utf8");

  return {
    filePath,
    envelope,
  };
}

export async function readLatestOutboxEnvelope() {
  await ensureBridgeDirectories();
  const files = (await readdir(resolveOutboxDir()))
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(resolveOutboxDir(), file));

  if (files.length === 0) {
    return null;
  }

  const ranked = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      mtimeMs: (await stat(filePath)).mtimeMs,
    })),
  );
  const latest = ranked.sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
  const content = await readFile(latest.filePath, "utf8");

  return {
    filePath: latest.filePath,
    payload: JSON.parse(content) as Record<string, unknown>,
  };
}
