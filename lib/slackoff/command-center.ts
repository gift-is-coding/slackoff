import type { Priority, WorkItem } from "@/lib/slackoff/types";

export const FOCUS_PRIORITIES: Priority[] = ["P0", "P1"];

const priorityLookup = new Set<Priority>(FOCUS_PRIORITIES);

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}

function matchesScopedToken(item: WorkItem, token: string) {
  if (token === "p0" || token === "p1" || token === "p2" || token === "p3") {
    return item.priority.toLowerCase() === token;
  }

  if (token.startsWith("from:")) {
    const source = token.slice(5);
    return (
      item.source.toLowerCase().includes(source) ||
      item.channel.toLowerCase().includes(source)
    );
  }

  if (token.startsWith("risk:")) {
    return item.risk.toLowerCase() === token.slice(5);
  }

  if (token.startsWith("owner:")) {
    return item.owner.toLowerCase().includes(token.slice(6));
  }

  return null;
}

export function matchesCommandQuery(item: WorkItem, query: string) {
  const normalizedQuery = normalizeToken(query);

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    item.summary,
    item.source,
    item.channel,
    item.owner,
    item.deadline,
    item.explanation,
    item.recommendedAction,
    item.risk,
    item.riskLabel,
    item.priority,
  ]
    .join(" ")
    .toLowerCase();

  return normalizedQuery.split(/\s+/).every((token) => {
    if (!token) {
      return true;
    }

    const scopedMatch = matchesScopedToken(item, token);

    if (scopedMatch !== null) {
      return scopedMatch;
    }

    return haystack.includes(token);
  });
}

export function filterWorkItems(
  items: WorkItem[],
  query: string,
  focusOnly: boolean,
) {
  return items.filter((item) => {
    if (focusOnly && !priorityLookup.has(item.priority)) {
      return false;
    }

    return matchesCommandQuery(item, query);
  });
}

export function getAdjacentItemId(
  items: WorkItem[],
  selectedItemId: string | null,
  direction: -1 | 1,
) {
  if (items.length === 0) {
    return null;
  }

  const currentIndex = items.findIndex((item) => item.id === selectedItemId);
  const baseIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = Math.min(
    Math.max(baseIndex + direction, 0),
    items.length - 1,
  );

  return items[nextIndex]?.id ?? items[0].id;
}
