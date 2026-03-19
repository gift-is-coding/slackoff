import { NextResponse } from "next/server";
import {
  enqueueBridgeEnvelope,
  getBridgePaths,
  readLatestOutboxEnvelope,
} from "@/lib/openclaw/bridge-files";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const latestOutbox = await readLatestOutboxEnvelope();

  return NextResponse.json({
    paths: getBridgePaths(),
    latestOutbox,
    notes: [
      "Slackoff writes human decisions into bridge/inbox",
      "OpenClaw can write aggregated triage output into bridge/outbox",
      "This file bridge avoids coupling the frontend to OpenClaw internal execution logic",
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type?: string;
      payload?: Record<string, unknown>;
    };
    const type = body.type?.trim();

    if (!type || !body.payload || typeof body.payload !== "object") {
      throw new Error("Bridge payload requires type and payload");
    }

    const queued = await enqueueBridgeEnvelope({
      type,
      payload: body.payload,
    });

    return NextResponse.json({
      ok: true,
      queued,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "Failed to enqueue bridge payload",
      },
      {
        status: 400,
      },
    );
  }
}
