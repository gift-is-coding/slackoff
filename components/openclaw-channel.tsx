"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { DEFAULT_OPENCLAW_CHANNEL_SESSION_ID } from "@/lib/openclaw/constants";
import type { OpenClawChannelState, OpenClawChannelTurnResult } from "@/lib/slackoff/types";

const CHANNEL_LIMIT = 24;
const POLL_MS = 4_000;

const emptyChannelState: OpenClawChannelState = {
  mode: "local-cli",
  sessionId: DEFAULT_OPENCLAW_CHANNEL_SESSION_ID,
  sessionFile: null,
  exists: false,
  messages: [],
};

function formatChannelTimestamp(timestamp: string) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpenClawChannel() {
  const [channelState, setChannelState] =
    useState<OpenClawChannelState>(emptyChannelState);
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("正在连接 OpenClaw channel ...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const loadChannelState = useEffectEvent(async () => {
    try {
      const response = await fetch(`/api/openclaw/channel?limit=${CHANNEL_LIMIT}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | OpenClawChannelState
        | {
            ok?: false;
            errorMessage?: string;
          };

      if (!response.ok || ("ok" in payload && payload.ok === false)) {
        throw new Error(
          "errorMessage" in payload && payload.errorMessage
            ? payload.errorMessage
            : "Unable to load OpenClaw channel",
        );
      }

      startTransition(() => {
        setChannelState(payload as OpenClawChannelState);
        setStatusMessage(
          (payload as OpenClawChannelState).exists
            ? "Channel connected to local OpenClaw session"
            : "Channel ready, waiting for the first message",
        );
      });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load OpenClaw channel",
      );
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    void loadChannelState();
    const intervalId = window.setInterval(() => {
      void loadChannelState();
    }, POLL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const node = transcriptRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [channelState.messages.length]);

  async function handleSend() {
    const message = draft.trim();

    if (!message || isSending) {
      return;
    }

    setIsSending(true);
    setErrorMessage(null);
    setStatusMessage("正在等待 OpenClaw 回复 ...");
    setDraft("");

    try {
      const response = await fetch("/api/openclaw/channel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          limit: CHANNEL_LIMIT,
        }),
      });
      const payload = (await response.json()) as
        | OpenClawChannelTurnResult
        | {
            ok?: false;
            errorMessage?: string;
          };

      if (!response.ok || ("ok" in payload && payload.ok === false)) {
        throw new Error(
          "errorMessage" in payload && payload.errorMessage
            ? payload.errorMessage
            : "OpenClaw channel send failed",
        );
      }

      const result = payload as OpenClawChannelTurnResult;
      startTransition(() => {
        setChannelState(result.state);
        setStatusMessage(
          result.meta.durationMs
            ? `OpenClaw replied in ${result.meta.durationMs} ms`
            : "OpenClaw replied",
        );
      });
    } catch (error) {
      setDraft(message);
      setErrorMessage(
        error instanceof Error ? error.message : "OpenClaw channel send failed",
      );
      setStatusMessage("发送失败");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <article className="card channel-card">
      <div className="channel-header">
        <div>
          <p className="eyebrow">OpenClaw Channel</p>
          <h3>像一个 channel 一样直接对话</h3>
          <p className="subtle">
            这里走的是本机 `openclaw agent --local --session-id ... --json`，不是受限的
            gateway `chat.send`。
          </p>
        </div>
        <div className="channel-session-meta">
          <span className="channel-session-pill">{channelState.sessionId}</span>
          <span className="channel-session-pill">{channelState.mode}</span>
        </div>
      </div>

      <div className="channel-status-row">
        <span className="channel-status">{statusMessage}</span>
        {channelState.sessionFile ? (
          <span className="channel-status mono">{channelState.sessionFile}</span>
        ) : null}
      </div>

      <div className="channel-transcript" ref={transcriptRef}>
        {channelState.messages.length > 0 ? (
          channelState.messages.map((message) => (
            <div className={`channel-message ${message.role}`} key={message.id}>
              <div className="channel-message-header">
                <strong>{message.role}</strong>
                <span>{formatChannelTimestamp(message.timestamp)}</span>
              </div>
              <p>{message.text}</p>
            </div>
          ))
        ) : (
          <div className="channel-empty">
            <strong>{isLoading ? "正在读取 channel ..." : "Channel 还没有消息"}</strong>
            <p>发第一条消息后，这里会持续显示本地 session transcript。</p>
          </div>
        )}
      </div>

      <div className="channel-composer">
        <textarea
          className="channel-textarea"
          disabled={isSending}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="向 OpenClaw 发送消息..."
          value={draft}
        />
        <div className="channel-actions">
          <div>
            <p className="channel-hint">`Cmd/Ctrl + Enter` 发送，页面会每 4 秒轮询 transcript。</p>
            {errorMessage ? <p className="channel-error">{errorMessage}</p> : null}
          </div>
          <button
            className="footer-button primary"
            disabled={isSending || draft.trim().length === 0}
            onClick={() => void handleSend()}
            type="button"
          >
            {isSending ? "发送中..." : "发送到 OpenClaw"}
          </button>
        </div>
      </div>
    </article>
  );
}
