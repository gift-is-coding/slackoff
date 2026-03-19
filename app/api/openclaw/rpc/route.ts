import { NextResponse } from "next/server";
import {
  forwardOpenClawRpc,
  getAllowedOpenClawRpcMethods,
  normalizeOpenClawRpcBody,
  SLACKOFF_SESSION_KEY,
} from "@/lib/openclaw/rpc";
import {
  listSessionStoreEntries,
  readSessionTranscript,
} from "@/lib/openclaw/session-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    methods: getAllowedOpenClawRpcMethods(),
    slackoffSessionKey: SLACKOFF_SESSION_KEY,
    notes: [
      "chat.send is forced to deliver=false",
      "chat.history and chat.abort default to the Slackoff session key",
      "sessions.list and chat.history can bootstrap from local OpenClaw session storage",
      "reading/notification logic should stay in OpenClaw, not in this app",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const normalized = normalizeOpenClawRpcBody(body);

    let payload: unknown;

    if (normalized.method === "sessions.list") {
      const limit =
        typeof normalized.params?.limit === "number" ? normalized.params.limit : 20;
      payload = {
        sessions: await listSessionStoreEntries(limit),
      };
    } else if (normalized.method === "chat.history") {
      const limit =
        typeof normalized.params?.limit === "number" ? normalized.params.limit : 20;
      payload = await readSessionTranscript({
        sessionKey: String(normalized.params?.sessionKey || SLACKOFF_SESSION_KEY),
        limit,
      });
    } else {
      payload = await forwardOpenClawRpc(normalized);
    }

    return NextResponse.json({
      ok: true,
      payload,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "OpenClaw RPC request failed",
      },
      {
        status: 400,
      },
    );
  }
}
