import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { AppLogo } from "@/components/app-logo";
import { useTranslation } from "@/lib/i18n/context";
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
  // Undo window: non-null means the countdown is active
  undoSecondsLeft: number | null;
  // High-risk ignore pending: requires second I press
  highRiskIgnorePending: boolean;
  // Snooze: item is deferred to bottom of queue
  isSnoozed: boolean;
  onApprovePlan: () => void;
  onIgnore: () => void;
  onSnooze: () => void;
  onConfirmExecute: () => void;
  onUndo: () => void;
  onCommandDraftChange: (value: string) => void;
  onToggleShortcutHelp: () => void;
  onCloseShortcutHelp: () => void;
  onToggleDebug: () => void;
  onDebugInputChange: (value: string) => void;
  onDebugSend: (message: string) => void;
};

const getKeyboardShortcuts = (t: (key: string) => string) => [
  { key: "W / ↑", description: t("scUp") },
  { key: "S / ↓", description: t("scDown") },
  { key: "Y / Enter", description: t("scConfirm") },
  { key: "I", description: t("scIgnore") },
  { key: "N", description: t("scSnooze") },
  { key: "Z", description: t("scUndo") },
  { key: "/ :", description: t("scCommand") },
  { key: "F", description: t("scFocus") },
  { key: "?", description: t("scHelp") },
  { key: "Esc", description: t("scEsc") },
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

function slashModeLabel(draft: string, t: (key: string) => string) {
  if (draft.startsWith(":")) return `> ${t("slashDirectReply")}`;
  if (draft.startsWith("/")) return `> ${t("slashAiInstruction")}`;
  return ">_";
}

function UndoBar({ secondsLeft, onUndo }: { secondsLeft: number; onUndo: () => void }) {
  const { t } = useTranslation();
  const pct = (secondsLeft / 5) * 100;
  return (
    <div className="undo-bar" aria-live="polite">
      <div className="undo-progress" style={{ width: `${pct}%` }} />
      <span className="undo-label">{secondsLeft}{t("undoCountdown")}</span>
      <button className="action-button ignore" onClick={onUndo} type="button">
        {t("undoBtn")}
      </button>
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
  undoSecondsLeft,
  highRiskIgnorePending,
  isSnoozed,
  onApprovePlan,
  onIgnore,
  onSnooze,
  onUndo,
  onCommandDraftChange,
}: {
  selectedItem: WorkItem;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  undoSecondsLeft: number | null;
  highRiskIgnorePending: boolean;
  isSnoozed: boolean;
  onApprovePlan: () => void;
  onIgnore: () => void;
  onSnooze: () => void;
  onUndo: () => void;
  onCommandDraftChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const isLowRisk = selectedItem.risk === "low";
  const isHighRisk = selectedItem.risk === "high";
  const isUndoActive = undoSecondsLeft !== null;
  const snoozeLabel = isSnoozed ? `⏸ ${t("snoozed")}` : t("snoozeBtn");
  return (
    <div className="step-content">
      <article className="card">
        <h3>{`// ${t("srcOriginalMessage")}`}</h3>
        <div className="source-grid">
          <div className="source-chip-row">
            <span className="chip" style={{ display: "inline-flex", alignItems: "center" }}><AppLogo source={selectedItem.source} /> src:{selectedItem.source}</span>
            <span className="chip">to:{selectedItem.owner}</span>
            <span className="chip">act:{selectedItem.recommendedAction}</span>
          </div>
          <p className="source-message">{selectedItem.sourceMessage}</p>
          {selectedItem.explanation ? (
            <p className="explanation-text">▸ {selectedItem.explanation}</p>
          ) : null}
        </div>
      </article>

      <article className="card">
        <h3>{`// ${t("srcAiSuggestion")}`}</h3>
        <p className="draft-text">{selectedItem.aiDraft || t("srcNoAiDraft")}</p>
        <div className="slash-box">
          <label htmlFor="slash-command">{slashModeLabel(commandDraft, t as unknown as (k: string) => string)}</label>
          <input
            id="slash-command"
            onChange={(event) => onCommandDraftChange(event.target.value)}
            ref={slashInputRef}
            value={commandDraft}
          />
        </div>
        {isLowRisk && !isUndoActive && (
          <p className="ignore-hint" aria-live="polite">
            {t("riskLowHint")} <strong>{t("riskLowKeyI")}</strong> {t("riskLowKeyOr")} <strong>{t("riskLowKeyEnter")}</strong> {t("riskLowSuffix")}
          </p>
        )}
        {highRiskIgnorePending && (
          <p className="high-risk-warning" aria-live="assertive">
            {t("highRiskIgnoreWarning")}
          </p>
        )}
        {isUndoActive ? (
          <UndoBar onUndo={onUndo} secondsLeft={undoSecondsLeft!} />
        ) : (
          <div className="action-strip">
            <button
              aria-keyshortcuts="Y"
              className="action-button primary"
              disabled={isBridgeSubmitting}
              onClick={onApprovePlan}
              type="button"
            >
              {t("btnApprovePlan")}
            </button>
            <button
              aria-keyshortcuts="I"
              className={`action-button ${isLowRisk ? "ignore-highlight" : isHighRisk ? "ignore-danger" : "ignore"}`}
              disabled={isBridgeSubmitting}
              onClick={onIgnore}
              type="button"
            >
              [<span className={isLowRisk ? "key-highlight" : undefined}>I</span>] {t("btnIgnore")}
            </button>
            <button
              aria-keyshortcuts="N"
              className={`action-button snooze${isSnoozed ? " snoozed" : ""}`}
              disabled={isBridgeSubmitting}
              onClick={onSnooze}
              type="button"
            >
              {snoozeLabel}
            </button>
          </div>
        )}
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
  undoSecondsLeft,
  onConfirmExecute,
  onIgnore,
  onUndo,
  onCommandDraftChange,
}: {
  selectedItem: WorkItem;
  commandDraft: string;
  bridgeNotice: string;
  decisionReply: string | null;
  isBridgeSubmitting: boolean;
  slashInputRef: RefObject<HTMLInputElement | null>;
  undoSecondsLeft: number | null;
  onConfirmExecute: () => void;
  onIgnore: () => void;
  onUndo: () => void;
  onCommandDraftChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const isUndoActive = undoSecondsLeft !== null;
  return (
    <div className="step-content">
      <article className="card">
        <h3>{`// ${t("srcExecPreview")}`}</h3>
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
                {selectedItem.previewNote ? <p>{selectedItem.previewNote}</p> : null}
              </div>
            </div>
          </div>
        </div>
        <p className="preview-caption">{selectedItem.screenshotCaption}</p>
      </article>

      <article className="card">
        <div className="slash-box">
          <label htmlFor="slash-command-step2">
            {slashModeLabel(commandDraft, t as unknown as (k: string) => string)}
          </label>
          <input
            id="slash-command-step2"
            onChange={(event) => onCommandDraftChange(event.target.value)}
            ref={slashInputRef}
            value={commandDraft}
          />
        </div>
        {isUndoActive ? (
          <UndoBar onUndo={onUndo} secondsLeft={undoSecondsLeft!} />
        ) : (
          <div className="action-strip">
            <button
              aria-keyshortcuts="Y"
              className="action-button primary"
              disabled={isBridgeSubmitting}
              onClick={onConfirmExecute}
              type="button"
            >
              {t("btnConfirmExec")}
            </button>
            <button
              aria-keyshortcuts="I"
              className="action-button ignore"
              disabled={isBridgeSubmitting}
              onClick={onIgnore}
              type="button"
            >
              [<span className="key-highlight">I</span>] {t("btnCancel")}
            </button>
          </div>
        )}
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
  const { t } = useTranslation();
  return (
    <div className="step-content">
      <article className="card">
        <h3>{`// ${t("srcExecResult")}`}</h3>
        <div className="result-status success">
          <strong>{t("doneTitle")}</strong>
          <p>{t("doneDesc")}</p>
        </div>
        {selectedItem.screenshotUrl && (
          <div style={{ marginTop: "16px" }}>
            <p className="preview-caption">{selectedItem.screenshotCaption}</p>
            <img
              src={selectedItem.screenshotUrl}
              alt="execution preview"
              style={{ width: "100%", height: "auto", display: "block", border: "1px solid var(--border)", borderRadius: "4px" }}
            />
          </div>
        )}
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
  const { t } = useTranslation();
  return (
    <div className="step-content">
      <article className="card">
        <h3>{`// ${t("srcProcessed")}`}</h3>
        <div className="source-grid">
          <div className="source-chip-row">
            <span className="chip" style={{ display: "inline-flex", alignItems: "center" }}><AppLogo source={selectedItem.source} /> src:{selectedItem.source}</span>
            <span className="chip">to:{selectedItem.owner}</span>
          </div>
          <p className="source-message">{selectedItem.sourceMessage}</p>
        </div>
      </article>

      {selectedItem.aiDraft ? (
        <article className="card">
          <h3>{`// ${t("srcAiSuggestion")}`}</h3>
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
  const { t } = useTranslation();
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
      >
        {isOpen ? "[×] openclaw" : "[>_] openclaw"}
      </button>

      {isOpen && (
        <div className="debug-panel">
          <div className="debug-log" ref={logRef}>
            {history.length === 0 ? (
              <div className="debug-empty">{t("debugEmpty")}</div>
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
              placeholder={t("debugPlaceholder")}
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
  undoSecondsLeft,
  highRiskIgnorePending,
  isSnoozed,
  onApprovePlan,
  onIgnore,
  onSnooze,
  onConfirmExecute,
  onUndo,
  onCommandDraftChange,
  onToggleShortcutHelp,
  onCloseShortcutHelp,
  onToggleDebug,
  onDebugInputChange,
  onDebugSend,
}: CommandCenterWorkspaceProps) {
  const { t } = useTranslation();
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
                    highRiskIgnorePending={highRiskIgnorePending}
                    isBridgeSubmitting={isBridgeSubmitting}
                    isSnoozed={isSnoozed}
                    onApprovePlan={onApprovePlan}
                    onCommandDraftChange={onCommandDraftChange}
                    onIgnore={onIgnore}
                    onSnooze={onSnooze}
                    onUndo={onUndo}
                    selectedItem={selectedItem}
                    slashInputRef={slashInputRef}
                    undoSecondsLeft={undoSecondsLeft}
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
                    onUndo={onUndo}
                    selectedItem={selectedItem}
                    slashInputRef={slashInputRef}
                    undoSecondsLeft={undoSecondsLeft}
                  />
                )}

                {step === "step3" && (
                  <StepThreeResults
            bridgeNotice={bridgeNotice}
            decisionReply={decisionReply}
            selectedItem={selectedItem}
          />
                )}
              </>
            )}
          </div>

          <div className="shortcut-bar">
            {getKeyboardShortcuts(t as unknown as (k: string) => string).slice(0, 5).map((s) => (
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
                {getKeyboardShortcuts(t as unknown as (k: string) => string).map((shortcut) => (
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
          <strong>{t("noItemsTitle")}</strong>
          <p>{t("noItemsDesc")}</p>
        </div>
      )}
    </>
  );
}
