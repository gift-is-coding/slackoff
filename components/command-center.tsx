"use client";

import Image from "next/image";
import { AppLogo } from "@/components/app-logo";
import {
  useDeferredValue,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { CommandCenterWorkspace } from "@/components/command-center-workspace";
import { useTranslation } from "@/lib/i18n/context";
import {
  filterWorkItems,
  getAdjacentItemId,
} from "@/lib/slackoff/command-center";
import type {
  DashboardSnapshot,
  InboxTab,
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

function isGatewayHealthPayload(
  value: unknown,
): value is OpenClawGatewayHealth {
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
  return (
    isRecord(value) && Array.isArray((value as Record<string, unknown>).items)
  );
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
  const { t, toggleLang } = useTranslation();
  const [activeTab, setActiveTab] = useState<InboxTab>("pending");
  const [items, setItems] = useState<WorkItem[]>(snapshot.items);
  const [processedItems, setProcessedItems] = useState<WorkItem[]>([]);
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
  const DEFAULT_DRAFT = t("defaultDraft");
  const [commandDrafts, setCommandDrafts] = useState<Map<string, string>>(
    () => new Map(),
  );

  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugInput, setDebugInput] = useState("");
  const [debugHistory, setDebugHistory] = useState<
    Array<{ role: "user" | "openclaw" | "error"; text: string }>
  >([]);
  const [isDebugSending, setIsDebugSending] = useState(false);

  const [, setGateway] = useState<OpenClawGatewayHealth>(
    snapshot.integration.gateway,
  );
  const [bridge, setBridge] = useState<OpenClawBridgeStatus | null>(null);
  const [bridgeNotice, setBridgeNotice] = useState(
    t("bridgeNoDecision"),
  );
  const [decisionReply, setDecisionReply] = useState<string | null>(null);
  const [isBridgeSubmitting, setIsBridgeSubmitting] = useState(false);

  // Undo window: 5-second countdown after approve_plan / confirm_execute
  const [undoWindow, setUndoWindow] = useState<{ itemId: string; targetStep: ItemStep } | null>(null);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);

  // High-risk ignore: requires a second I press to confirm
  const [highRiskIgnorePending, setHighRiskIgnorePending] = useState(false);

  // Snooze: client-side set; snoozed items are sorted to the bottom of the queue
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(() => new Set());

  const slashInputRef = useRef<HTMLInputElement>(null);
  const queueListRef = useRef<HTMLUListElement>(null);
  const deferredQuery = useDeferredValue(query);
  const sourceItems = activeTab === "pending" ? items : processedItems;
  const filteredItems = filterWorkItems(sourceItems, deferredQuery, showFocusOnly);
  // Snoozed items are sorted to the bottom so normal items always get first attention
  const visibleItems = [...filteredItems].sort(
    (a, b) => Number(snoozedIds.has(a.id)) - Number(snoozedIds.has(b.id)),
  );
  const selectedItem =
    visibleItems.find((item) => item.id === selectedItemId) ??
    visibleItems[0] ??
    null;
  const commandDraft = selectedItem
    ? (commandDrafts.get(selectedItem.id) ?? DEFAULT_DRAFT)
    : DEFAULT_DRAFT;
  const isProcessedTab = activeTab === "processed";

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

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setItemSteps((current) =>
      setItemStepImmutable(current, itemId, { hasNotification: false }),
    );
    setBridgeNotice(t("bridgeNoDecision"));
    setDecisionReply(null);

    // Auto-scroll the selected card into view
    requestAnimationFrame(() => {
      const card = document.querySelector(
        `[data-testid="queue-card-${itemId}"]`,
      );
      card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [t]);

  useEffect(() => {
    if (selectedItemId) {
      setItemSteps((current) =>
        setItemStepImmutable(current, selectedItemId, {
          hasNotification: false,
        }),
      );
    }
    // Cancel any pending high-risk ignore when selection changes
    setHighRiskIgnorePending(false);
  }, [selectedItemId]);

  // Count down the undo window; advance step when it reaches zero
  useEffect(() => {
    if (!undoWindow) return;

    if (undoSecondsLeft <= 0) {
      advanceStep(undoWindow.itemId, undoWindow.targetStep);
      setUndoWindow(null);
      return;
    }

    const timerId = window.setTimeout(() => {
      setUndoSecondsLeft((s) => s - 1);
    }, 1000);

    return () => window.clearTimeout(timerId);
    // advanceStep reads selectedItemId via closure — stable across re-renders for our purposes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoWindow, undoSecondsLeft]);

  const switchTab = useCallback(
    (tab: InboxTab) => {
      if (tab === activeTab) return;
      setActiveTab(tab);
      setSelectedItemId(null);
      setQuery("");
      setBridgeNotice(t("bridgeNoDecision"));
      setDecisionReply(null);
    },
    [activeTab, t],
  );

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
        const [pendingRes, processedRes] = await Promise.all([
          fetch("/api/openclaw/items", {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch("/api/openclaw/items?tab=processed", {
            cache: "no-store",
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) return;

        const pendingPayload = await readJsonPayload(pendingRes);
        const processedPayload = await readJsonPayload(processedRes);

        if (isItemsPayload(pendingPayload)) {
          setItems(pendingPayload.items);
        }
        if (isItemsPayload(processedPayload)) {
          setProcessedItems(processedPayload.items);
        }
      } catch (err) {
        // Non-blocking — the next poll will retry automatically.
        console.error("[CommandCenter] Failed to load items:", err);
      } finally {
        setItemsLoading(false);
      }
    }

    void loadItems();
    const intervalId = window.setInterval(
      () => void loadItems(),
      ITEMS_POLL_MS,
    );

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  async function refreshItems() {
    try {
      const [pendingRes, processedRes] = await Promise.all([
        fetch("/api/openclaw/items", { cache: "no-store" }),
        fetch("/api/openclaw/items?tab=processed", { cache: "no-store" }),
      ]);

      const pendingPayload = await readJsonPayload(pendingRes);
      const processedPayload = await readJsonPayload(processedRes);

      if (isItemsPayload(pendingPayload)) {
        setItems(pendingPayload.items);
      }
      if (isItemsPayload(processedPayload)) {
        setProcessedItems(processedPayload.items);
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

  function handleCommandDraftChange(value: string) {
    if (!selectedItem) return;
    setCommandDrafts((prev) => {
      const next = new Map(prev);
      next.set(selectedItem.id, value);
      return next;
    });
  }

  async function handleDebugSend(message: string) {
    const trimmed = message.trim();
    if (!trimmed || isDebugSending) return;

    setDebugHistory((prev) => [...prev, { role: "user", text: trimmed }]);
    setDebugInput("");
    setIsDebugSending(true);

    try {
      const response = await fetch("/api/openclaw/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        replyText?: string | null;
        errorMessage?: string;
      };

      if (!response.ok || data.ok === false) {
        setDebugHistory((prev) => [
          ...prev,
          {
            role: "error",
            text: data.errorMessage || `HTTP ${response.status}`,
          },
        ]);
      } else {
        setDebugHistory((prev) => [
          ...prev,
          { role: "openclaw", text: data.replyText || "(no reply)" },
        ]);
      }
    } catch (error) {
      setDebugHistory((prev) => [
        ...prev,
        {
          role: "error",
          text: error instanceof Error ? error.message : "Unknown error",
        },
      ]);
    } finally {
      setIsDebugSending(false);
    }
  }

  async function submitDecision(params: {
    action: OpenClawDecisionAction;
    successLabel: string;
  }) {
    if (!selectedItem) {
      return false;
    }

    setIsBridgeSubmitting(true);
    setBridgeNotice(t("bridgeSyncing"));
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
        setBridgeNotice(
          `${params.successLabel} ${t("bridgeWritten")} ${payload.bridge.filePath}`,
        );
      } else {
        setBridgeNotice(
          `${params.successLabel} ${t("bridgeFail")}${
            payload.bridge.errorMessage || "unknown bridge error"
          }`,
        );
      }

      if (payload.channel.ok) {
        setDecisionReply(
          payload.channel.replyText || t("channelConfirmed"),
        );
      } else {
        setDecisionReply(
          payload.channel.errorMessage || t("channelNoConfirm"),
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
        error instanceof Error ? error.message : t("bridgeSyncFail"),
      );
      setDecisionReply(null);
      return false;
    } finally {
      setIsBridgeSubmitting(false);
    }
  }

  async function handleApprovePlan() {
    const targetItem = selectedItem;
    const succeeded = await submitDecision({
      action: "approve_plan",
      successLabel: t("bridgePlanLabel"),
    });

    if (succeeded && targetItem) {
      setUndoWindow({ itemId: targetItem.id, targetStep: "step2" });
      setUndoSecondsLeft(5);
    }
  }

  async function handleUndo() {
    if (!undoWindow || !selectedItem) return;

    const itemId = undoWindow.itemId;
    setUndoWindow(null);
    setUndoSecondsLeft(0);

    // Revert status server-side
    fetch("/api/openclaw/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "cancel",
        itemId,
        source: selectedItem.source,
        summary: selectedItem.summary,
      }),
    })
      .then(() => refreshItems())
      .catch((err: unknown) => {
        console.error("[CommandCenter] Undo cancel request failed:", err);
      });

    setBridgeNotice(t("undoCancelled"));
    setDecisionReply(null);
  }

  async function handleIgnore() {
    if (!selectedItem) return;

    // High-risk guard: require a second I press to confirm
    if (selectedItem.risk === "high" && !highRiskIgnorePending) {
      setHighRiskIgnorePending(true);
      return;
    }
    setHighRiskIgnorePending(false);

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
    setBridgeNotice(t("bridgeNoDecision"));
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
      .catch((err: unknown) => {
        // Item is already removed optimistically from the UI; log for debuggability.
        console.error("[CommandCenter] Background ignore decision failed:", err);
      });
  }

  function handleSnooze() {
    if (!selectedItem) return;
    const id = selectedItem.id;
    setSnoozedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id); // un-snooze
      } else {
        next.add(id);
        // Move selection to next non-snoozed item
        const nextId = visibleItems.find((item) => item.id !== id && !next.has(item.id))?.id;
        if (nextId) setSelectedItemId(nextId);
      }
      return next;
    });
  }

  async function handleConfirmExecute() {
    const targetItem = selectedItem;
    const succeeded = await submitDecision({
      action: "confirm_execute",
      successLabel: t("bridgeExecLabel"),
    });

    if (succeeded && targetItem) {
      setUndoWindow({ itemId: targetItem.id, targetStep: "step3" });
      setUndoSecondsLeft(5);
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

      if (highRiskIgnorePending) {
        event.preventDefault();
        setHighRiskIgnorePending(false);
        return;
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

    if (!typing && (event.key === "/" || event.key === ":")) {
      event.preventDefault();
      const prefix = event.key === ":" ? ":" : "/";
      if (selectedItemId) {
        setCommandDrafts((prev) => {
          const next = new Map(prev);
          next.set(selectedItemId, prefix);
          return next;
        });
        requestAnimationFrame(() => {
          const input = slashInputRef.current;
          if (input) {
            input.focus();
            input.setSelectionRange(1, 1);
          }
        });
      } else {
        slashInputRef.current?.focus();
      }
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "1") {
      event.preventDefault();
      switchTab("pending");
      return;
    }

    if ((event.metaKey || event.ctrlKey) && event.key === "2") {
      event.preventDefault();
      switchTab("processed");
      return;
    }

    if (typing) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      switchTab("pending");
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      switchTab("processed");
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

    if (isBridgeSubmitting || !selectedItem || isProcessedTab) {
      return;
    }

    if (event.key.toLowerCase() === "z" && undoWindow) {
      event.preventDefault();
      void handleUndo();
      return;
    }

    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      handleSnooze();
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
              <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <Image src="/logo.svg" alt="logo" width={16} height={16} />
                slackoff
              </span>
              <h1 className="pane-title">
                <span className="title-cursor">▌</span>{t("inbox")}
              </h1>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="filter-pill" onClick={toggleLang} type="button">[{t("switchLang")}]</button>
              <button
              className={`filter-pill ${showFocusOnly ? "active" : ""}`}
              onClick={() => setShowFocusOnly((current) => !current)}
              type="button"
            >
              {showFocusOnly ? "[P0/P1]" : "[ALL]"}
            </button>
            </div>
          </header>

          <div className="status-chips" aria-label="Status summary">
            <span className="status-chip">{items.length} {t("statusPending")}</span>
            <span className="status-chip chip-focus">
              {items.filter((i) => i.priority === "P0" || i.priority === "P1").length} {t("statusFocus")}
            </span>
            <span className="status-chip chip-done">{processedItems.length} {t("statusProcessed")}</span>
          </div>

          <div className="inbox-tabs" role="tablist" aria-label="Inbox tabs">
            <button
              aria-selected={activeTab === "pending"}
              className={`inbox-tab ${activeTab === "pending" ? "active" : ""}`}
              onClick={() => switchTab("pending")}
              role="tab"
              type="button"
            >
              <span className="tab-key">1</span>
              {t("pending")}
              {items.length > 0 && (
                <span className="tab-count">{items.length}</span>
              )}
            </button>
            <button
              aria-selected={activeTab === "processed"}
              className={`inbox-tab ${activeTab === "processed" ? "active" : ""}`}
              onClick={() => switchTab("processed")}
              role="tab"
              type="button"
            >
              <span className="tab-key">2</span>
              {t("processed")}
              {processedItems.length > 0 && (
                <span className="tab-count">{processedItems.length}</span>
              )}
            </button>
          </div>

          <div className="search-box">
            <span className="prompt-char">&gt;</span>
            <input
              aria-label="Search queue"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("filterPlaceholder")}
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
                      className={`queue-card ${item.id === selectedItem?.id ? "active" : ""} ${snoozedIds.has(item.id) ? "snoozed" : ""}`}
                      data-testid={`queue-card-${item.id}`}
                      onClick={() => handleSelectItem(item.id)}
                      type="button"
                    >
                      <div className="queue-topline">
                        <span
                          className={`priority-tag ${priorityClass(item.priority)}`}
                        >
                          {item.priority}
                        </span>
                        <span className="queue-source">
                          {stepState.hasNotification && (
                            <span
                              className="notification-dot"
                              data-testid={`notif-dot-${item.id}`}
                            />
                          )}
                          {snoozedIds.has(item.id) && (
                            <span className="snooze-badge" title={t("snoozed")}>⏸ </span>
                          )}
                          {item.channel}
                        </span>
                      </div>
                      <p className="queue-title">{item.summary}</p>
                      <div className="queue-meta">
                        <span style={{ display: "inline-flex", alignItems: "center" }}>
                          <AppLogo source={item.source} /> {item.source}
                        </span>
                        <span>{item.deadline}</span>
                        <span className={`risk-${item.risk}`}>
                          {item.riskLabel}
                        </span>
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
          ) : sourceItems.length === 0 ? (
            <div className="queue-empty">
              <strong>
                {isProcessedTab ? "no processed items" : "no pending items"}
              </strong>
              <p>
                {isProcessedTab
                  ? "处理过的消息会出现在这里。"
                  : "waiting for openclaw to sync new notifications."}
              </p>
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
            debugHistory={debugHistory}
            debugInput={debugInput}
            decisionReply={decisionReply}
            highRiskIgnorePending={highRiskIgnorePending}
            isBridgeSubmitting={isBridgeSubmitting}
            isDebugOpen={isDebugOpen}
            isDebugSending={isDebugSending}
            isReadOnly={isProcessedTab}
            isSnoozed={selectedItem ? snoozedIds.has(selectedItem.id) : false}
            onApprovePlan={() => void handleApprovePlan()}
            onCommandDraftChange={handleCommandDraftChange}
            onConfirmExecute={() => void handleConfirmExecute()}
            onDebugInputChange={setDebugInput}
            onDebugSend={(msg) => void handleDebugSend(msg)}
            onIgnore={() => void handleIgnore()}
            onSnooze={handleSnooze}
            onToggleDebug={() => setIsDebugOpen((prev) => !prev)}
            onUndo={() => void handleUndo()}
            selectedItem={selectedItem}
            showShortcutHelp={showShortcutHelp}
            slashInputRef={slashInputRef}
            undoSecondsLeft={undoWindow ? undoSecondsLeft : null}
            onToggleShortcutHelp={() =>
              setShowShortcutHelp((current) => !current)
            }
            onCloseShortcutHelp={() => setShowShortcutHelp(false)}
          />
        </section>
      </div>
    </main>
  );
}
