import type { RefObject } from "react";
import type {
  ItemStepState,
  OpenClawBridgeStatus,
  WorkItem,
} from "@/lib/slackoff/types";

type CommandCenterWorkspaceProps = {
  bridge: OpenClawBridgeStatus | null;
  selectedItem: WorkItem | null;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  currentStep: ItemStepState | null;
  showShortcutHelp: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  onApprovePlan: () => void;
  onIgnore: () => void;
  onConfirmExecute: () => void;
  onCommandDraftChange: (value: string) => void;
  onToggleShortcutHelp: () => void;
  onCloseShortcutHelp: () => void;
};

const keyboardShortcuts = [
  { key: "W / ↑", description: "上移" },
  { key: "S / ↓", description: "下移" },
  { key: "Y / Enter", description: "确认" },
  { key: "I", description: "忽略" },
  { key: "/", description: "指令" },
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
  return (
    <div className="step-content">
      <article className="card">
        <h3>// 原始消息</h3>
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
        <h3>// AI 建议</h3>
        <p className="draft-text">{selectedItem.aiDraft || "（无AI草稿）"}</p>
        <div className="slash-box">
          <label htmlFor="slash-command">&gt; slash_cmd</label>
          <input
            id="slash-command"
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
            onClick={onApprovePlan}
            type="button"
          >
            [Y] 确认方案
          </button>
          <button
            aria-keyshortcuts="I"
            className="action-button secondary"
            disabled={isBridgeSubmitting}
            onClick={onIgnore}
            type="button"
          >
            [I] 忽略
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
        <h3>// 执行预览</h3>
        <div className="preview-frame">
          <div className="preview-window">
            <div className="window-bar">
              <span className="window-dots">● ● ●</span>
              <span className="window-target">{selectedItem.finalRecipients}</span>
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
          <label htmlFor="slash-command-step2">&gt; slash_cmd</label>
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
            className="action-button secondary"
            disabled={isBridgeSubmitting}
            onClick={onIgnore}
            type="button"
          >
            [I] 取消
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
  selectedItem,
  bridgeNotice,
  decisionReply,
}: {
  selectedItem: WorkItem;
  bridgeNotice: string;
  decisionReply: string | null;
}) {
  return (
    <div className="step-content">
      <article className="card">
        <h3>// 执行结果</h3>
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

export function CommandCenterWorkspace({
  bridge,
  selectedItem,
  commandDraft,
  bridgeNotice,
  decisionReply,
  isBridgeSubmitting,
  currentStep,
  showShortcutHelp,
  slashInputRef,
  onApprovePlan,
  onIgnore,
  onConfirmExecute,
  onCommandDraftChange,
  onToggleShortcutHelp,
  onCloseShortcutHelp,
}: CommandCenterWorkspaceProps) {
  const step = currentStep?.step ?? "step1";

  return (
    <>
      {selectedItem ? (
        <div className="detail-pane">
          <StepIndicator step={step} />

          <div className="detail-content">
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
                selectedItem={selectedItem}
              />
            )}
          </div>

          <div className="shortcut-bar">
            {keyboardShortcuts.slice(0, 5).map((s) => (
              <span className="shortcut-hint" key={s.key}>
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
            <aside aria-label="Keyboard shortcuts" className="shortcut-overlay" role="dialog">
              <div className="shortcut-header">
                <h3>// shortcuts</h3>
                <button className="command-help" onClick={onCloseShortcutHelp} type="button">
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
