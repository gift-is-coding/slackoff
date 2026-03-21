export type Lang = "zh" | "en";

export const dict = {
  zh: {
    pending: "待处理",
    processed: "已处理",
    filterPlaceholder: "filter ...",
    inbox: "inbox",
    noItemsTitle: "> 未选择任何条目",
    noItemsDesc: "清空过滤条件或等待新消息。",

    defaultDraft: "/",

    scUp: "上移",
    scDown: "下移",
    scConfirm: "确认",
    scIgnore: "忽略",
    scCommand: "指令",
    scFocus: "焦点",
    scHelp: "帮助",
    scEsc: "退出",

    srcOriginalMessage: "原始消息",
    srcAiSuggestion: "AI 建议",
    srcNoAiDraft: "（无AI草稿）",
    srcExecPreview: "执行预览",
    srcExecResult: "执行结果",
    srcProcessed: "已处理",

    slashDirectReply: "直接回复",
    slashAiInstruction: "AI 指令",
    slashHint: "> 按 / 给AI指示，按 : 直接写回复内容",

    btnApprovePlan: "[Y] 确认方案",
    btnConfirmExec: "[Y] 确认执行",
    btnIgnore: "忽略",
    btnCancel: "取消",
    riskLowHint: "▸ 风险低 — 按",
    riskLowKeyI: "I",
    riskLowKeyOr: "或",
    riskLowKeyEnter: "回车",
    riskLowSuffix: "可直接忽略",

    doneTitle: "✓ done",
    doneDesc: "该条目已处理完毕。",

    debugEmpty: "直接发消息给 openclaw CLI",
    debugPlaceholder: "发消息给 openclaw ...",

    bridgeNoDecision: "尚未向 OpenClaw bridge/inbox 写入人工决策。",
    bridgeSyncing: "正在把审批动作同步到 OpenClaw ...",
    bridgePlanLabel: "方案确认",
    bridgeExecLabel: "执行确认",
    bridgeWritten: "已写入",
    bridgeFail: "已发给 OpenClaw，但 bridge 写入失败：",
    bridgeSyncFail: "OpenClaw 审批动作同步失败",
    channelConfirmed: "OpenClaw 已确认该审批动作。",
    channelNoConfirm: "OpenClaw channel 未返回确认消息。",

    undoCountdown: "秒后继续，按 [Z] 撤销",
    undoBtn: "[Z] 撤销",
    undoCancelled: "已撤销，该条目已还原为待处理。",

    highRiskIgnoreWarning: "⚠ 风险较高 — 再按一次 [I] 确认忽略，或按 [Esc] 取消",

    snoozeBtn: "[N] 稍后",
    snoozed: "已缓",
    scSnooze: "缓处理",
    scUndo: "撤销",
    statusPending: "待处理",
    statusFocus: "P0/P1",
    statusProcessed: "已处理",

    switchLang: "English",
  },
  en: {
    pending: "Pending",
    processed: "Processed",
    filterPlaceholder: "filter ...",
    inbox: "inbox",
    noItemsTitle: "> no items selected",
    noItemsDesc: "Clear filters or wait for new messages.",

    defaultDraft: "/",

    scUp: "Up",
    scDown: "Down",
    scConfirm: "Confirm",
    scIgnore: "Ignore",
    scCommand: "Command",
    scFocus: "Focus",
    scHelp: "Help",
    scEsc: "Esc",

    srcOriginalMessage: "Original Message",
    srcAiSuggestion: "AI Suggestion",
    srcNoAiDraft: "(No AI Draft)",
    srcExecPreview: "Execution Preview",
    srcExecResult: "Execution Result",
    srcProcessed: "Processed",

    slashDirectReply: "Direct reply",
    slashAiInstruction: "AI Command",
    slashHint: "> Press / for AI instruction, press : for direct reply",

    btnApprovePlan: "[Y] Approve Plan",
    btnConfirmExec: "[Y] Confirm Exec",
    btnIgnore: "Ignore",
    btnCancel: "Cancel",
    riskLowHint: "▸ Low Risk — press",
    riskLowKeyI: "I",
    riskLowKeyOr: "or",
    riskLowKeyEnter: "Enter",
    riskLowSuffix: "to ignore directly",

    doneTitle: "✓ done",
    doneDesc: "This item has been processed.",

    debugEmpty: "Send message to openclaw CLI directly",
    debugPlaceholder: "Message to openclaw ...",

    bridgeNoDecision: "No human decision written to OpenClaw bridge/inbox yet.",
    bridgeSyncing: "Syncing decision to OpenClaw ...",
    bridgePlanLabel: "Plan Approval",
    bridgeExecLabel: "Execution Confirmation",
    bridgeWritten: "written to",
    bridgeFail: "Sent to OpenClaw, but bridge write failed: ",
    bridgeSyncFail: "Failed to sync decision to OpenClaw",
    channelConfirmed: "OpenClaw confirmed the decision.",
    channelNoConfirm: "OpenClaw channel did not return a confirmation.",

    undoCountdown: "s to proceed — press [Z] to undo",
    undoBtn: "[Z] Undo",
    undoCancelled: "Cancelled — item restored to pending.",

    highRiskIgnoreWarning: "⚠ High risk — press [I] again to confirm ignore, or [Esc] to cancel",

    snoozeBtn: "[N] Snooze",
    snoozed: "snoozed",
    scSnooze: "Snooze",
    scUndo: "Undo",
    statusPending: "pending",
    statusFocus: "P0/P1",
    statusProcessed: "processed",

    switchLang: "中文",
  },
};
