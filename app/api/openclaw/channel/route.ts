import { NextResponse } from "next/server";
import { readChannelState, sendChannelMessage } from "@/lib/openclaw/channel";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LIMIT = 100;

function parseLimit(raw: string | null) {
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || value < 1) {
    throw new Error("limit must be a positive number");
  }

  return Math.min(Math.round(value), MAX_LIMIT);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const state = await readChannelState({
      sessionId: url.searchParams.get("sessionId")?.trim(),
      limit: parseLimit(url.searchParams.get("limit")),
    });

    return NextResponse.json(state);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        errorMessage:
          error instanceof Error ? error.message : "Failed to read OpenClaw channel",
      },
      {
        status: 400,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      sessionId?: string;
      limit?: number;
    };
    const message = body.message?.trim();

    if (!message) {
      throw new Error("message is required");
    }

    const result = await sendChannelMessage({
      message,
      sessionId: body.sessionId,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send OpenClaw channel message";
    const status = /required|empty|exceed|limit|sessionid/i.test(errorMessage) ? 400 : 500;

    return NextResponse.json(
      {
        ok: false,
        errorMessage,
      },
      {
        status,
      },
    );
  }
}
