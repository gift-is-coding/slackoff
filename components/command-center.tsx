"use client";

import {
  useDeferredValue,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { CommandCenterWorkspace } from "@/components/command-center-workspace";
import {
  FOCUS_PRIORITIES,
  filterWorkItems,
  getAdjacentItemId,
} from "@/lib/slackoff/command-center";
import type {
  DashboardSnapshot,
  ItemStep,
  ItemStepState,
  OpenClawBridgeStatus,
  OpenClawDecisionAction,
  OpenClawDecisionSubmissionResult,
  OpenClawGatewayHealth,
  WorkItem,
} from "@/lib/slackoff/types";

type CommandCenterProps = {
  snapshot: DashboardSnapshot;
};

function priorityClass(priority: WorkItem["priority"]) {
  return priority.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isGatewayHealthPayload(value: unknown): value is OpenClawGatewayHealth {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.url === "string" &&
    typeof value.bindLabel === "string" &&
    typeof value.defaultAgentId === "string" &&
    typeof value.sessionCount === "number" &&
    typeof value.configuredChannelCount === "number" &&
    typeof value.activeChannelCount === "number" &&
    Array.isArray(value.channels) &&
    Array.isArray(value.recentSessions)
  );
}

function isBridgeStatusPayload(value: unknown): value is OpenClawBridgeStatus {
  return (
    isRecord(value) &&
    isRecord(value.paths) &&
    typeof value.paths.root === "string" &&
    typeof value.paths.inbox === "string" &&
    typeof value.paths.outbox === "string" &&
    Array.isArray(value.notes)
  );
}

function getApiErrorMessage(value: unknown, fallback: string) {
  if (isRecord(value) && typeof value.errorMessage === "string") {
    return value.errorMessage;
  }

  return fallback;
}

async function readJsonPayload(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

const ITEMS_POLL_MS = 8_000;

function isItemsPayload(value: unknown): value is { items: WorkItem[] } {
  return isRecord(value) && Array.isArray((value as Record<string, unknown>).items);
}

function getItemStep(
  itemSteps: Map<string, ItemStepState>,
  itemId: string,
): ItemStepState {
  return itemSteps.get(itemId) ?? { step: "step1", hasNotification: false };
}

function setItemStepImmutable(
  itemSteps: Map<string, ItemStepState>,
  itemId: string,
  update: Partial<ItemStepState>,
): Map<string, ItemStepState> {
  const next = new Map(itemSteps);
  const current = getItemStep(itemSteps, itemId);
  next.set(itemId, { ...current, ...update });
  return next;
}

export function CommandCenter({ snapshot }: CommandCenterProps) {
  const [items, setItems] = useState<WorkItem[]>(snapshot.items);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    snapshot.selectedItemId,
  );
  const [query, setQuery] = useState("");
  const [showFocusOnly, setShowFocusOnly] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [itemSteps, setItemSteps] = useState<Map<string, ItemStepState>>(
    () => new Map(),
  );
  const [commandDraft, setCommandDraft] = useState(
    "/rewrite 更简洁，先确认对方可接受截止时间",
  );
  const [gateway, setGateway] = useState<OpenClawGatewayHealth>(
    snapshot.integration.gateway,
  );
  const [bridge, setBridge] = useState<OpenClawBridgeStatus | null>(null);
  const [bridgeNotice, setBridgeNotice] = useState(
    "尚未向 OpenClaw bridge/inbox 写入人工决策。",
  );
  const [decisionReply, setDecisionReply] = useState<string | null>(null);
  const [isBridgeSubmitting, setIsBridgeSubmitting] = useState(false);

  const slashInputRef = useRef<HTMLInputElement>(null);
  const queueListRef = useRef<HTMLUListElement>(null);
  const deferredQuery = useDeferredValue(query);
  const visibleItems = filterWorkItems(
    items,
    deferredQuery,
    showFocusOnly,
  );
  const selectedItem =
    visibleItems.find((item) => item.id === selectedItemId) ?? visibleItems[0] ?? null;

  const currentStep = selectedItem
    ? getItemStep(itemSteps, selectedItem.id)
    : null;

  useEffect(() => {
    if (items.length > 0 && selectedItemId === null) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if (visibleItems.length === 0) {
      return;
    }

    if (!visibleItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(visibleItems[0].id);
    }
  }, [selectedItemId, visibleItems]);

  const handleSelectItem = useCallback(
    (itemId: string) => {
      setSelectedItemId(itemId);
      setItemSteps((current) =>
        setItemStepImmutable(current, itemId, { hasNotification: false }),
      );
      setBridgeNotice("尚未向 OpenClaw bridge/inbox 写入人工决策。");
      setDecisionReply(null);

      // Auto-scroll the selected card into view
      requestAnimationFrame(() => {
        const card = document.querySelector(
          `[data-testid="queue-card-${itemId}"]`,
        );
        card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
    },
    [],
  );

  useEffect(() => {
    if (selectedItemId) {
      setItemSteps((current) =>
        setItemStepImmutable(current, selectedItemId, { hasNotification: false }),
      );
    }
  }, [selectedItemId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadIntegrationState() {
      const [healthResult, bridgeResult] = await Promise.allSettled([
        fetch("/api/openclaw/health", {
          cache: "no-store",
          signal: controller.signal,
        }),
        fetch("/api/openclaw/bridge", {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      if (healthResult.status === "fulfilled") {
        const healthPayload = await readJsonPayload(healthResult.value);

        if (isGatewayHealthPayload(healthPayload)) {
          setGateway(healthPayload);
        } else {
          setGateway((current) => ({
            ...current,
            ok: false,
            errorMessage: getApiErrorMessage(
              healthPayload,
              "unable to decode local gateway health",
            ),
          }));
        }
      } else {
        setGateway((current) => ({
          ...current,
          ok: false,
          errorMessage:
            healthResult.reason instanceof Error
              ? healthResult.reason.message
              : "unable to probe local gateway",
        }));
      }

      if (bridgeResult.status === "fulfilled") {
        const bridgePayload = await readJsonPayload(bridgeResult.value);

        if (isBridgeStatusPayload(bridgePayload)) {
          setBridge(bridgePayload);
        } else {
          setBridge(null);
        }
      } else {
        setBridge(null);
      }
    }

    void loadIntegrationState();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadItems() {
      try {
        const response = await fetch("/api/openclaw/items", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await readJsonPayload(response);

        if (controller.signal.aborted) {
          return;
        }

        if (isItemsPayload(payload)) {
          setItems(payload.items);
        }
      } catch {
        // Silently fail — the next poll will retry.
      } finally {
        setItemsLoading(false);
      }
    }

    void loadItems();
    const intervalId = window.setInterval(() => void loadItems(), ITEMS_POLL_MS);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  async function refreshItems() {
    try {
      const response = await fetch("/api/openclaw/items", { cache: "no-store" });
      const payload = await readJsonPayload(response);

      if (isItemsPayload(payload)) {
        setItems(payload.items);
      }
    } catch {
      // Silently fail — the poll will catch up.
    }
  }

  async function refreshBridgeState() {
    const bridgeResponse = await fetch("/api/openclaw/bridge", {
      cache: "no-store",
    });
    const bridgePayload = await readJsonPayload(bridgeResponse);

    if (!bridgeResponse.ok || !isBridgeStatusPayload(bridgePayload)) {
      throw new Error(
        getApiErrorMessage(bridgePayload, "Unable to refresh bridge state"),
      );
    }

    setBridge(bridgePayload);
  }

  function advanceStep(itemId: string, nextStep: ItemStep) {
    setItemSteps((current) => {
      const isViewingThisItem = selectedItemId === itemId;
      return setItemStepImmutable(current, itemId, {
        step: nextStep,
        hasNotification: !isViewingThisItem,
      });
    });
  }

  async function submitDecision(params: {
    action: OpenClawDecisionAction;
    successLabel: string;
  }) {
    if (!selectedItem) {
      return false;
    }

    setIsBridgeSubmitting(true);
    setBridgeNotice("正在把审批动作同步到 OpenClaw ...");
    setDecisionReply(null);

    try {
      const response = await fetch("/api/openclaw/decision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: params.action,
          itemId: selectedItem.id,
          source: selectedItem.source,
          summary: selectedItem.summary,
          slashCommand: commandDraft,
          finalRecipients: selectedItem.finalRecipients,
          previewDraft: selectedItem.previewDraft,
        }),
      });
      const result = (await response.json()) as
        | OpenClawDecisionSubmissionResult
        | {
          ok?: false;
          errorMessage?: string;
        };

      if (!response.ok || ("ok" in result && result.ok === false)) {
        throw new Error(
          "errorMessage" in result && result.errorMessage
            ? result.errorMessage
            : "OpenClaw decision submission failed",
        );
      }

      const payload = result as OpenClawDecisionSubmissionResult;

      if (payload.bridge.ok && payload.bridge.filePath) {
        setBridgeNotice(`${params.successLabel} 已写入 ${payload.bridge.filePath}`);
      } else {
        setBridgeNotice(
          `${params.successLabel} 已发给 OpenClaw，但 bridge 写入失败：${payload.bridge.errorMessage || "unknown bridge error"
          }`,
        );
      }

      if (payload.channel.ok) {
        setDecisionReply(payload.channel.replyText || "OpenClaw 已确认该审批动作。");
      } else {
        setDecisionReply(
          payload.channel.errorMessage || "OpenClaw channel 未返回确认消息。",
        );
      }

      try {
        await Promise.all([refreshBridgeState(), refreshItems()]);
      } catch {
        // Keep the returned decision state even if the refresh fails.
      }

      return payload.fullySynced;
    } catch (error) {
      setBridgeNotice(
        error instanceof Error ? error.message : "OpenClaw 审批动作同步失败",
      );
      setDecisionReply(null);
      return false;
    } finally {
      setIsBridgeSubmitting(false);
    }
  }

  async function handleApprovePlan() {
    const succeeded = await submitDecision({
      action: "approve_plan",
      successLabel: "方案确认",
    });

    if (succeeded && selectedItem) {
      advanceStep(selectedItem.id, "step2");
    }
  }

  async function handleIgnore() {
    if (!selectedItem) return;

    const ignoredItem = selectedItem;

    // Find the next item BEFORE removing
    const nextId = getAdjacentItemId(visibleItems, selectedItemId, 1);

    // Optimistically remove the item from the local state immediately
    setItems((current) => current.filter((item) => item.id !== ignoredItem.id));

    // Move to next item
    if (nextId && nextId !== ignoredItem.id) {
      setSelectedItemId(nextId);
    }

    // Reset UI state for the new selection
    setBridgeNotice("尚未向 OpenClaw bridge/inbox 写入人工决策。");
    setDecisionReply(null);

    // Fire the backend call in the background — do NOT use submitDecision()
    // because it sets isBridgeSubmitting=true which blocks all further actions.
    fetch("/api/openclaw/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ignore",
        itemId: ignoredItem.id,
        source: ignoredItem.source,
        summary: ignoredItem.summary,
        slashCommand: commandDraft,
      }),
    })
      .then(() => refreshItems())
      .catch(() => {
        // Silently fail — the item is already removed optimistically,
        // and the server-side status was already written by the API.
      });
  }

  async function handleConfirmExecute() {
    const succeeded = await submitDecision({
      action: "confirm_execute",
      successLabel: "执行确认",
    });

    if (succeeded && selectedItem) {
      advanceStep(selectedItem.id, "step3");
    }
  }

  function handleConfirmCurrentStep() {
    if (!selectedItem || !currentStep || isBridgeSubmitting) {
      return;
    }

    if (currentStep.step === "step1") {
      void handleApprovePlan();
    } else if (currentStep.step === "step2") {
      void handleConfirmExecute();
    }
  }

  const handleGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (showShortcutHelp) {
        event.preventDefault();
        setShowShortcutHelp(false);
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      return;
    }

    const typing = isTypingTarget(event.target);

    if (!typing && event.key === "?") {
      event.preventDefault();
      setShowShortcutHelp((current) => !current);
      return;
    }

    if (!typing && event.key === "/") {
      event.preventDefault();
      slashInputRef.current?.focus();
      slashInputRef.current?.select();
      return;
    }

    if (typing) {
      return;
    }

    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      setShowFocusOnly((current) => !current);
      return;
    }

    if (event.key.toLowerCase() === "w" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextId = getAdjacentItemId(visibleItems, selectedItemId, -1);
      if (nextId) {
        handleSelectItem(nextId);
      }
      return;
    }

    if (event.key.toLowerCase() === "s" || event.key === "ArrowDown") {
      event.preventDefault();
      const nextId = getAdjacentItemId(visibleItems, selectedItemId, 1);
      if (nextId) {
        handleSelectItem(nextId);
      }
      return;
    }

    if (isBridgeSubmitting || !selectedItem) {
      return;
    }

    if (event.key === "Enter" || event.key.toLowerCase() === "y") {
      event.preventDefault();
      handleConfirmCurrentStep();
      return;
    }

    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      void handleIgnore();
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleGlobalKeyDown(event);
    window.addEventListener("keydown", listener);

    return () => window.removeEventListener("keydown", listener);
  }, []);

  return (
    <main className="command-center">
      <div className="shell">
        <section className="inbox-pane">
          <header className="pane-header">
            <div className="pane-header-copy">
              <span className="eyebrow">slackoff</span>
              <h1 className="pane-title">
                <span className="title-cursor">▌</span>inbox
              </h1>
            </div>
            <button
              className={`filter-pill ${showFocusOnly ? "active" : ""}`}
              onClick={() => setShowFocusOnly((current) => !current)}
              type="button"
            >
              {showFocusOnly ? "[P0/P1]" : "[ALL]"}
            </button>
          </header>

          <div className="search-box">
            <span className="prompt-char">&gt;</span>
            <input
              aria-label="Search queue"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="filter ..."
              value={query}
            />
          </div>

          {visibleItems.length > 0 ? (
            <ul className="queue-list" ref={queueListRef}>
              {visibleItems.map((item) => {
                const stepState = getItemStep(itemSteps, item.id);
                return (
                  <li key={item.id}>
                    <button
                      aria-pressed={item.id === selectedItem?.id}
                      className={`queue-card ${item.id === selectedItem?.id ? "active" : ""}`}
                      data-testid={`queue-card-${item.id}`}
                      onClick={() => handleSelectItem(item.id)}
                      type="button"
                    >
                      <div className="queue-topline">
                        <span className={`priority-tag ${priorityClass(item.priority)}`}>
                          {item.priority}
                        </span>
                        <span className="queue-source">
                          {stepState.hasNotification && (
                            <span className="notification-dot" data-testid={`notif-dot-${item.id}`} />
                          )}
                          {item.channel}
                        </span>
                      </div>
                      <p className="queue-title">{item.summary}</p>
                      <div className="queue-meta">
                        <span>{item.source}</span>
                        <span>{item.deadline}</span>
                        <span className={`risk-${item.risk}`}>{item.riskLabel}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : itemsLoading ? (
            <div className="queue-empty">
              <strong>loading notifications ...</strong>
            </div>
          ) : items.length === 0 ? (
            <div className="queue-empty">
              <strong>no pending items</strong>
              <p>waiting for openclaw to sync new notifications.</p>
            </div>
          ) : (
            <div className="queue-empty">
              <strong>no matches</strong>
              <p>clear filter to see all items.</p>
              <button
                className="footer-button"
                onClick={() => {
                  setQuery("");
                  setShowFocusOnly(false);
                }}
                type="button"
              >
                [clear]
              </button>
            </div>
          )}
        </section>

        <section className="decision-pane">
          <CommandCenterWorkspace
            bridge={bridge}
            bridgeNotice={bridgeNotice}
            commandDraft={commandDraft}
            currentStep={currentStep}
            decisionReply={decisionReply}
            isBridgeSubmitting={isBridgeSubmitting}
            onApprovePlan={() => void handleApprovePlan()}
            onCommandDraftChange={setCommandDraft}
            onConfirmExecute={() => void handleConfirmExecute()}
            onIgnore={() => void handleIgnore()}
            selectedItem={selectedItem}
            showShortcutHelp={showShortcutHelp}
            slashInputRef={slashInputRef}
            onToggleShortcutHelp={() => setShowShortcutHelp((current) => !current)}
            onCloseShortcutHelp={() => setShowShortcutHelp(false)}
          />
        </section>
      </div>
    </main>
  );
}
