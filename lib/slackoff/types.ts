export type Priority = "P0" | "P1" | "P2" | "P3";
export type Risk = "low" | "medium" | "high";

export type InboxTab = "pending" | "processed";

export type ItemStep = "step1" | "step2" | "step3";

export type ItemStepState = {
  step: ItemStep;
  hasNotification: boolean;
};

export type WorkItem = {
  id: string;
  priority: Priority;
  channel: string;
  source: string;
  owner: string;
  summary: string;
  deadline: string;
  risk: Risk;
  riskLabel: string;
  recommendedAction: string;
  explanation: string;
  sourceMessage: string;
  aiDraft: string;
  finalRecipients: string;
  previewDraft: string;
  previewNote: string;
  screenshotCaption: string;
};

export type IntegrationBoundary = {
  title: string;
  description: string;
};

export type GatewayRecentSession = {
  key: string;
  ageLabel: string;
};

export type AllowedOpenClawRpcMethod =
  | "health"
  | "sessions.list"
  | "chat.history"
  | "chat.send"
  | "chat.abort";

export type GatewayChannelBrief = {
  id: string;
  label: string;
  state: "online" | "configured" | "offline";
  detail: string;
};

export type OpenClawGatewayHealth = {
  ok: boolean;
  url: string;
  bindLabel: string;
  defaultAgentId: string;
  sessionCount: number;
  configuredChannelCount: number;
  activeChannelCount: number;
  channels: GatewayChannelBrief[];
  recentSessions: GatewayRecentSession[];
  errorMessage?: string;
};

export type OpenClawBridgeStatus = {
  paths: {
    root: string;
    inbox: string;
    outbox: string;
  };
  latestOutbox: {
    filePath: string;
    payload: Record<string, unknown>;
  } | null;
  notes: string[];
};

export type OpenClawChannelRole =
  | "user"
  | "assistant"
  | "system"
  | "tool"
  | "unknown";

export type OpenClawChannelMessage = {
  id: string;
  role: OpenClawChannelRole;
  text: string;
  timestamp: string;
};

export type OpenClawChannelState = {
  mode: "local-cli";
  sessionId: string;
  sessionFile: string | null;
  exists: boolean;
  messages: OpenClawChannelMessage[];
};

export type OpenClawChannelTurnResult = {
  ok: true;
  replyText: string | null;
  meta: {
    durationMs: number | null;
    sessionId: string;
    mode: "local-cli";
    provider?: string;
    model?: string;
  };
  state: OpenClawChannelState;
};

export type OpenClawDecisionAction =
  | "approve_plan"
  | "ignore"
  | "request_edit"
  | "confirm_execute";

export type OpenClawDecisionBridgeResult = {
  ok: boolean;
  type: string;
  filePath: string | null;
  errorMessage?: string;
};

export type OpenClawDecisionChannelResult = {
  ok: boolean;
  replyText: string | null;
  sessionId: string;
  durationMs: number | null;
  state: OpenClawChannelState | null;
  errorMessage?: string;
};

export type OpenClawDecisionSubmissionResult = {
  ok: true;
  action: OpenClawDecisionAction;
  fullySynced: boolean;
  bridge: OpenClawDecisionBridgeResult;
  channel: OpenClawDecisionChannelResult;
};

export type DashboardSnapshot = {
  generatedAtLabel: string;
  modeLabel: string;
  selectedItemId: string | null;
  items: WorkItem[];
  integration: {
    modeLabel: string;
    slackoffSessionKey: string;
    supportedRpcMethods: AllowedOpenClawRpcMethod[];
    gateway: OpenClawGatewayHealth;
    boundaries: IntegrationBoundary[];
  };
};
