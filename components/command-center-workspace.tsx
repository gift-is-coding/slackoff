import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import type {
  ItemStepState,
  OpenClawBridgeStatus,
  WorkItem,
} from "@/lib/slackoff/types";

type DebugEntry = { role: "user" | "openclaw" | "error"; text: string };

type CommandCenterWorkspaceProps = {
  bridge: OpenClawBridgeStatus | null;
  selectedItem: WorkItem | null;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  isReadOnly: boolean;
  currentStep: ItemStepState | null;
  showShortcutHelp: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  isDebugOpen: boolean;
  debugInput: string;
  debugHistory: DebugEntry[];
  isDebugSending: boolean;
  onApprovePlan: () => void;
  onIgnore: () => void;
  onConfirmExecute: () => void;
  onCommandDraftChange: (value: string) => void;
  onToggleShortcutHelp: () => void;
  onCloseShortcutHelp: () => void;
  onToggleDebug: () => void;
  onDebugInputChange: (value: string) => void;
  onDebugSend: (message: string) => void;
};

const keyboardShortcuts = [
  { key: "W / ↑", description: "上移" },
  { key: "S / ↓", description: "下移" },
  { key: "Y / Enter", description: "确认" },
  { key: "I", description: "忽略" },
  { key: "/ :", description: "AI指示/直接回复" },
  { key: "F", description: "焦点" },
  { key: "?", description: "帮助" },
  { key: "Esc", description: "退出" },
];

function StepIndicator({ step }: { step: "step1" | "step2" | "step3" }) {
  return (
    <div className="step-indicator" aria-label="Step indicator">
      <div className={`step-tab ${step === "step1" ? "active" : ""}`}>
        {step === "step1" ? "▸ " : "  "}1:plan
      </div>
      <div className={`step-tab ${step === "step2" ? "active" : ""}`}>
        {step === "step2" ? "▸ " : "  "}2:exec
      </div>
      <div className={`step-tab ${step === "step3" ? "active" : ""}`}>
        {step === "step3" ? "▸ " : "  "}3:done
      </div>
    </div>
  );
}

function slashModeLabel(draft: string) {
  const isColon = draft.startsWith(":");
  const isSlash = draft.startsWith("/");
  const slashPart = isSlash ? "[/] AI指示" : "/ AI指示";
  const colonPart = isColon ? "[:] 直接回复" : ": 直接回复";
  return `> ${slashPart}   ${colonPart}`;
}

function StepOnePlan({
  selectedItem,
  commandDraft,
  bridgeNotice,
  decisionReply,
  isBridgeSubmitting,
  slashInputRef,
  onApprovePlan,
  onIgnore,
  onCommandDraftChange,
}: {
  selectedItem: WorkItem;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  onApprovePlan: () => void;
  onIgnore: () => void;
  onCommandDraftChange: (value: string) => void;
}) {
  const isLowRisk = selectedItem.risk === "low";
  return (
    <div className="step-content">
      <article className="card">
        <h3>{"// 原始消息"}</h3>
        <div className="source-grid">
          <div className="source-chip-row">
            <span className="chip">src:{selectedItem.source}</span>
            <span className="chip">to:{selectedItem.owner}</span>
            <span className="chip">act:{selectedItem.recommendedAction}</span>
          </div>
          <p className="source-message">{selectedItem.sourceMessage}</p>
        </div>
      </article>

      <article className="card">
        <h3>{"// AI 建议"}</h3>
        <p className="draft-text">{selectedItem.aiDraft || "（无AI草稿）"}</p>
        <div className="slash-box">
          <label htmlFor="slash-command">{slashModeLabel(commandDraft)}</label>
          <input
            id="slash-command"
            onChange={(event) => onCommandDraftChange(event.target.value)}
            ref={slashInputRef}
            value={commandDraft}
          />
        </div>
        {isLowRisk && (
          <p className="ignore-hint" aria-live="polite">
            ▸ 风险低 — 按 <strong>I</strong> 或 <strong>回车</strong> 可直接忽略
          </p>
        )}
        <div className="action-strip">
          <button
            aria-keyshortcuts="Y"
            className="action-button primary"
            disabled={isBridgeSubmitting}
            onClick={onApprovePlan}
            type="button"
          >
            [Y] 确认方案
          </button>
          <button
            aria-keyshortcuts="I"
            className={`action-button ${isLowRisk ? "ignore-highlight" : "ignore"}`}
            disabled={isBridgeSubmitting}
            onClick={onIgnore}
            type="button"
          >
            [<span className={isLowRisk ? "key-highlight" : undefined}>I</span>] 忽略
          </button>
        </div>
        <p aria-live="polite" className="bridge-notice">
          {bridgeNotice}
        </p>
        {decisionReply ? (
          <p aria-live="polite" className="decision-reply">
            &gt; openclaw: {decisionReply}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function StepTwoExecute({
  selectedItem,
  commandDraft,
  bridgeNotice,
  decisionReply,
  isBridgeSubmitting,
  slashInputRef,
  onConfirmExecute,
  onIgnore,
  onCommandDraftChange,
}: {
  selectedItem: WorkItem;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  onConfirmExecute: () => void;
  onIgnore: () => void;
  onCommandDraftChange: (value: string) => void;
}) {
  return (
    <div className="step-content">
      <article className="card">
        <h3>{"// 执行预览"}</h3>
        <div className="preview-frame">
          <div className="preview-window">
            <div className="window-bar">
              <span className="window-dots">● ● ●</span>
              <span className="window-target">
                {selectedItem.finalRecipients}
              </span>
            </div>
            <div className="window-message">
              <div className="message-body">
                <p>{selectedItem.previewDraft}</p>
                <p>{selectedItem.previewNote}</p>
              </div>
            </div>
          </div>
        </div>
        <p className="preview-caption">{selectedItem.screenshotCaption}</p>
      </article>

      <article className="card">
        <div className="slash-box">
          <label htmlFor="slash-command-step2">
            {slashModeLabel(commandDraft)}
          </label>
          <input
            id="slash-command-step2"
            onChange={(event) => onCommandDraftChange(event.target.value)}
            ref={slashInputRef}
            value={commandDraft}
          />
        </div>
        <div className="action-strip">
          <button
            aria-keyshortcuts="Y"
            className="action-button primary"
            disabled={isBridgeSubmitting}
            onClick={onConfirmExecute}
            type="button"
          >
            [Y] 确认执行
          </button>
          <button
            aria-keyshortcuts="I"
            className="action-button ignore"
            disabled={isBridgeSubmitting}
            onClick={onIgnore}
            type="button"
          >
            [<span className="key-highlight">I</span>] 取消
          </button>
        </div>
        <p aria-live="polite" className="bridge-notice">
          {bridgeNotice}
        </p>
        {decisionReply ? (
          <p aria-live="polite" className="decision-reply">
            &gt; openclaw: {decisionReply}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function StepThreeResults({
  bridgeNotice,
  decisionReply,
}: {
  bridgeNotice: string;
  decisionReply: string | null;
}) {
  return (
    <div className="step-content">
      <article className="card">
        <h3>{"// 执行结果"}</h3>
        <div className="result-status success">
          <strong>✓ done</strong>
          <p>该条目已处理完毕。</p>
        </div>
        <p aria-live="polite" className="bridge-notice">
          {bridgeNotice}
        </p>
        {decisionReply ? (
          <p aria-live="polite" className="decision-reply">
            &gt; openclaw: {decisionReply}
          </p>
        ) : null}
      </article>
    </div>
  );
}

function ProcessedItemSummary({ selectedItem }: { selectedItem: WorkItem }) {
  return (
    <div className="step-content">
      <article className="card">
        <h3>{"// 已处理"}</h3>
        <div className="source-grid">
          <div className="source-chip-row">
            <span className="chip">src:{selectedItem.source}</span>
            <span className="chip">to:{selectedItem.owner}</span>
          </div>
          <p className="source-message">{selectedItem.sourceMessage}</p>
        </div>
      </article>

      {selectedItem.aiDraft ? (
        <article className="card">
          <h3>{"// AI 建议"}</h3>
          <p className="draft-text">{selectedItem.aiDraft}</p>
        </article>
      ) : null}
    </div>
  );
}

function DebugConsole({
  isOpen,
  input,
  history,
  isSending,
  onInputChange,
  onSend,
  onToggle,
}: {
  isOpen: boolean;
  input: string;
  history: DebugEntry[];
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSend: (message: string) => void;
  onToggle: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [history, isOpen]);

  return (
    <div className={`debug-console ${isOpen ? "open" : ""}`}>
      <button
        className="debug-toggle"
        onClick={onToggle}
        type="button"
        title="OpenClaw 调试控制台"
      >
        {isOpen ? "[×] openclaw" : "[>_] openclaw"}
      </button>

      {isOpen && (
        <div className="debug-panel">
          <div className="debug-log" ref={logRef}>
            {history.length === 0 ? (
              <div className="debug-empty">直接发消息给 openclaw CLI</div>
            ) : (
              history.map((entry, i) => (
                <div key={i} className={`debug-entry debug-${entry.role}`}>
                  <span className="debug-role">
                    {entry.role === "user"
                      ? "> you"
                      : entry.role === "openclaw"
                        ? "< openclaw"
                        : "! error"}
                  </span>
                  <span className="debug-text">{entry.text}</span>
                </div>
              ))
            )}
            {isSending && (
              <div className="debug-entry debug-sending">
                <span className="debug-role">{"< openclaw"}</span>
                <span className="debug-text">{"..."}</span>
              </div>
            )}
          </div>
          <div className="debug-input-row">
            <span className="prompt-char">&gt;</span>
            <input
              className="debug-input"
              disabled={isSending}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend(input);
                }
              }}
              placeholder="发消息给 openclaw ..."
              value={input}
            />
            <button
              className="debug-send"
              disabled={isSending || !input.trim()}
              onClick={() => onSend(input)}
              type="button"
            >
              {isSending ? "..." : "[↵]"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommandCenterWorkspace({
  bridge,
  selectedItem,
  commandDraft,
  bridgeNotice,
  decisionReply,
  isBridgeSubmitting,
  isReadOnly,
  currentStep,
  showShortcutHelp,
  slashInputRef,
  isDebugOpen,
  debugInput,
  debugHistory,
  isDebugSending,
  onApprovePlan,
  onIgnore,
  onConfirmExecute,
  onCommandDraftChange,
  onToggleShortcutHelp,
  onCloseShortcutHelp,
  onToggleDebug,
  onDebugInputChange,
  onDebugSend,
}: CommandCenterWorkspaceProps) {
  const step = currentStep?.step ?? "step1";

  return (
    <>
      <DebugConsole
        history={debugHistory}
        input={debugInput}
        isOpen={isDebugOpen}
        isSending={isDebugSending}
        onInputChange={onDebugInputChange}
        onSend={onDebugSend}
        onToggle={onToggleDebug}
      />

      {selectedItem ? (
        <div className="detail-pane">
          {!isReadOnly && <StepIndicator step={step} />}

          <div className="detail-content">
            {isReadOnly ? (
              <ProcessedItemSummary selectedItem={selectedItem} />
            ) : (
              <>
                {step === "step1" && (
                  <StepOnePlan
                    bridgeNotice={bridgeNotice}
                    commandDraft={commandDraft}
                    decisionReply={decisionReply}
                    isBridgeSubmitting={isBridgeSubmitting}
                    onApprovePlan={onApprovePlan}
                    onCommandDraftChange={onCommandDraftChange}
                    onIgnore={onIgnore}
                    selectedItem={selectedItem}
                    slashInputRef={slashInputRef}
                  />
                )}

                {step === "step2" && (
                  <StepTwoExecute
                    bridgeNotice={bridgeNotice}
                    commandDraft={commandDraft}
                    decisionReply={decisionReply}
                    isBridgeSubmitting={isBridgeSubmitting}
                    onCommandDraftChange={onCommandDraftChange}
                    onConfirmExecute={onConfirmExecute}
                    onIgnore={onIgnore}
                    selectedItem={selectedItem}
                    slashInputRef={slashInputRef}
                  />
                )}

                {step === "step3" && (
                  <StepThreeResults
                    bridgeNotice={bridgeNotice}
                    decisionReply={decisionReply}
                  />
                )}
              </>
            )}
          </div>

          <div className="shortcut-bar">
            {keyboardShortcuts.slice(0, 5).map((s) => (
              <span
                className={`shortcut-hint${s.key === "I" ? " shortcut-hint-ignore" : ""}`}
                key={s.key}
              >
                {s.key}:{s.description}
              </span>
            ))}
            <button
              className="shortcut-hint shortcut-help-toggle"
              onClick={onToggleShortcutHelp}
              type="button"
            >
              [?]
            </button>
          </div>

          {showShortcutHelp ? (
            <aside
              aria-label="Keyboard shortcuts"
              className="shortcut-overlay"
              role="dialog"
            >
              <div className="shortcut-header">
                <h3>{"// shortcuts"}</h3>
                <button
                  className="command-help"
                  onClick={onCloseShortcutHelp}
                  type="button"
                >
                  [esc]
                </button>
              </div>
              <div className="shortcut-grid">
                {keyboardShortcuts.map((shortcut) => (
                  <div className="shortcut-item" key={shortcut.key}>
                    <strong>{shortcut.key}</strong>
                    <span>{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </aside>
          ) : null}
        </div>
      ) : (
        <div className="empty-workspace">
          <strong>&gt; no items selected</strong>
          <p>清空过滤条件或等待新消息。</p>
        </div>
      )}
    </>
  );
}
