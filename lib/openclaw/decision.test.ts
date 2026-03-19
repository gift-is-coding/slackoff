import { describe, expect, it } from "vitest";
import {
  buildDecisionChannelMessage,
  normalizeDecisionRequestBody,
} from "@/lib/openclaw/decision";

describe("normalizeDecisionRequestBody", () => {
  it("accepts a valid approve_plan payload", () => {
    expect(
      normalizeDecisionRequestBody({
        action: "approve_plan",
        itemId: "item-1",
        source: "Slack",
        summary: "Need a response",
        slashCommand: "/rewrite 更简洁",
      }),
    ).toEqual({
      action: "approve_plan",
      itemId: "item-1",
      source: "Slack",
      summary: "Need a response",
      slashCommand: "/rewrite 更简洁",
      finalRecipients: undefined,
      previewDraft: undefined,
    });
  });

  it("rejects unsupported actions", () => {
    expect(() =>
      normalizeDecisionRequestBody({
        action: "ship_it",
        itemId: "item-1",
        source: "Slack",
        summary: "Need a response",
      }),
    ).toThrow(/unsupported decision action/i);
  });
});

describe("buildDecisionChannelMessage", () => {
  it("includes the bridge file path and envelope payload", () => {
    const message = buildDecisionChannelMessage({
      bridgeType: "decision.plan_approved",
      bridgeFilePath: "/tmp/slackoff/inbox/decision.json",
      payload: {
        itemId: "item-1",
        decision: "approve_plan",
      },
    });

    expect(message).toContain("Bridge inbox file: /tmp/slackoff/inbox/decision.json");
    expect(message).toContain('"bridgeType": "decision.plan_approved"');
    expect(message).toContain('"decision": "approve_plan"');
    expect(message).toContain("ACK:");
    expect(message).toContain("NEXT:");
  });
});
