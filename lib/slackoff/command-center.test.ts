import { describe, expect, it } from "vitest";
import {
  filterWorkItems,
  getAdjacentItemId,
  matchesCommandQuery,
} from "@/lib/slackoff/command-center";
import type { WorkItem } from "@/lib/slackoff/types";

function makeItem(overrides: Partial<WorkItem> & { id: string }): WorkItem {
  return {
    priority: "P2",
    channel: "test / channel",
    source: "Test",
    owner: "test",
    summary: "test item",
    deadline: "--",
    risk: "low",
    riskLabel: "低",
    recommendedAction: "",
    explanation: "",
    sourceMessage: "",
    aiDraft: "",
    finalRecipients: "",
    previewDraft: "",
    previewNote: "",
    screenshotCaption: "",
    ...overrides,
  };
}

const testItems: WorkItem[] = [
  makeItem({ id: "a", priority: "P0", risk: "high", riskLabel: "高", source: "Slack", channel: "slack / #ops" }),
  makeItem({ id: "b", priority: "P1", risk: "medium", riskLabel: "中", source: "Email", owner: "PM" }),
  makeItem({ id: "c", priority: "P2", risk: "low", riskLabel: "低", source: "Teams", owner: "财务" }),
  makeItem({ id: "d", priority: "P0", risk: "high", riskLabel: "高", source: "Email", channel: "email / support" }),
];

describe("matchesCommandQuery", () => {
  it("supports scoped command tokens", () => {
    expect(matchesCommandQuery(testItems[0], "p0 risk:high from:slack")).toBe(true);
    expect(matchesCommandQuery(testItems[1], "owner:财务")).toBe(false);
  });
});

describe("filterWorkItems", () => {
  it("keeps only P0/P1 items in focus mode", () => {
    const items = filterWorkItems(testItems, "", true);

    expect(items.map((item) => item.id)).toEqual(["a", "b", "d"]);
  });

  it("filters by free text and scoped tokens", () => {
    const items = filterWorkItems(testItems, "from:email risk:high", false);

    expect(items.map((item) => item.id)).toEqual(["d"]);
  });
});

describe("getAdjacentItemId", () => {
  it("moves forward and backward within bounds", () => {
    expect(getAdjacentItemId(testItems, "b", 1)).toBe("c");
    expect(getAdjacentItemId(testItems, "a", -1)).toBe("a");
  });

  it("returns null for empty lists", () => {
    expect(getAdjacentItemId([], null, 1)).toBeNull();
  });
});
