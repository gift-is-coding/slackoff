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
  it("instruction mode includes the operator instruction", () => {
    const message = buildDecisionChannelMessage({
      action: "approve_plan",
      slashCommand: "rewrite 更简洁",
      slashCommandMode: "instruction",
      source: "Slack",
      summary: "Need a response",
      bridgeFilePath: "/tmp/slackoff/inbox/decision.json",
    });

    expect(message).toContain("Bridge file: /tmp/slackoff/inbox/decision.json");
    expect(message).toContain("action=approve_plan");
    expect(message).toContain("Operator instruction: rewrite 更简洁");
  });

  it("direct_reply mode asks openclaw to send exact content", () => {
    const message = buildDecisionChannelMessage({
      action: "approve_plan",
      slashCommand: "好的，我周末有空",
      slashCommandMode: "direct_reply",
      source: "Email",
      summary: "Weekend plans",
    });

    expect(message).toContain("reply with EXACTLY the following content");
    expect(message).toContain("好的，我周末有空");
  });
});
