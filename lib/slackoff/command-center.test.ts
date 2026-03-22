import { describe, expect, it } from "vitest";
import {
  filterWorkItems,
  getAdjacentItemId,
  groupByChannel,
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

describe("groupByChannel", () => {
  it("returns groupCount 1 when all items have different channels", () => {
    const uniqueChannelItems = [
      makeItem({ id: "a", channel: "ch-a" }),
      makeItem({ id: "b", channel: "ch-b" }),
      makeItem({ id: "c", channel: "ch-c" }),
    ];
    const result = groupByChannel(uniqueChannelItems);
    expect(result.every((item) => item.groupCount === 1)).toBe(true);
  });

  it("collapses same-channel items, keeping the first as representative", () => {
    const items = [
      makeItem({ id: "x1", channel: "slack / #ops" }),
      makeItem({ id: "x2", channel: "slack / #ops" }),
      makeItem({ id: "x3", channel: "slack / #ops" }),
      makeItem({ id: "y1", channel: "email / support" }),
    ];
    const result = groupByChannel(items);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("x1");
    expect(result[0].groupCount).toBe(3);
    expect(result[1].id).toBe("y1");
    expect(result[1].groupCount).toBe(1);
  });

  it("preserves first-seen order across channels", () => {
    const items = [
      makeItem({ id: "a1", channel: "ch-a" }),
      makeItem({ id: "b1", channel: "ch-b" }),
      makeItem({ id: "a2", channel: "ch-a" }),
    ];
    const result = groupByChannel(items);
    expect(result.map((i) => i.id)).toEqual(["a1", "b1"]);
    expect(result[0].groupCount).toBe(2);
  });

  it("returns empty array for empty input", () => {
    expect(groupByChannel([])).toEqual([]);
  });

  it("does not mutate source items", () => {
    const items = [
      makeItem({ id: "m1", channel: "ch" }),
      makeItem({ id: "m2", channel: "ch" }),
    ];
    const origRef = items[0];
    groupByChannel(items);
    expect(origRef).not.toHaveProperty("groupCount");
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
