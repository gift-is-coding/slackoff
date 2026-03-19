import { NextResponse } from "next/server";
import {
  normalizeDecisionRequestBody,
  submitDecisionToOpenClaw,
} from "@/lib/openclaw/decision";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const params = normalizeDecisionRequestBody(body);
    const result = await submitDecisionToOpenClaw(params);

    if (!result.bridge.ok && !result.channel.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorMessage:
            result.bridge.errorMessage ||
            result.channel.errorMessage ||
            "OpenClaw decision submission failed",
        },
        {
          status: 502,
        },
      );
    }

    return NextResponse.json(result, {
      status: result.fullySynced ? 200 : 207,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Failed to submit Slackoff decision to OpenClaw";
    const status = /required|cannot exceed|unsupported|object/i.test(errorMessage)
      ? 400
      : 500;

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
