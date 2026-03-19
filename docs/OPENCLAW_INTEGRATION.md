# Slackoff <-> OpenClaw Integration

## Boundary

`Slackoff` is the frontend shell.

- queue UI
- single-item decision area
- Gate A / Gate B confirmation rhythm
- local keyboard-first workflow

`OpenClaw` is the runtime system.

- notification and message ingestion
- reading and context gathering
- AI drafting and prioritization
- execution-preview screenshot capture
- real external execution and audit

## Implemented In This Repo

The app currently talks to local OpenClaw in three ways:

1. `channel`: run `openclaw agent --local --session-id ... --json` on the host
2. `gateway`: read health and limited RPC data over the local WebSocket gateway
3. `bridge`: exchange file-based envelopes under the local OpenClaw workspace

Routes:

- `GET /api/openclaw/channel`
- `POST /api/openclaw/channel`
- `POST /api/openclaw/decision`
- `GET /api/openclaw/health`
- `GET /api/openclaw/rpc`
- `POST /api/openclaw/rpc`
- `GET /api/openclaw/bridge`
- `POST /api/openclaw/bridge`

Allowed RPC methods:

- `health`
- `sessions.list`
- `chat.history`
- `chat.send`
- `chat.abort`

## How Slackoff Gets OpenClaw Output

Current output surfaces:

- `channel`: transcript for the manual local channel session
- `health`: gateway readiness, channel summary, recent session metadata
- `sessions.list`: existing OpenClaw session list
- `chat.history`: transcript of a dedicated Slackoff session
- `bridge/outbox`: aggregated results if OpenClaw writes them there

This means the frontend can already read both direct local-agent output and gateway/runtime state.

## How Slackoff Sends Input Back To OpenClaw

Primary local input surface:

- `POST /api/openclaw/channel`
- internally runs `openclaw agent --local --session-id slackoff_web_channel --json`

Secondary local input surface:

- `bridge/inbox/*.json` in the OpenClaw workspace

Unified approval loop:

- `POST /api/openclaw/decision`
- writes a compact bridge envelope for OpenClaw to consume
- sends the same decision to a dedicated local decision session
- returns the OpenClaw acknowledgement and updated decision transcript to the UI

Gateway write surface wired but not primary:

- `chat.send`

Default behavior in this repo:

- the manual channel uses a stable shared session id
- the approval loop uses a separate stable decision session id
- replies are read back from the persisted session transcript
- bridge is still used for compact human decisions that should stay outside the chat loop

That keeps the app safe by default:

- Slackoff sends instruction and confirmation intent
- OpenClaw thinks, drafts, captures context, and prepares execution
- real send/publish/delete stays on the OpenClaw side

If `chat.send` is blocked by local operator auth, Slackoff can still queue decisions into:

- `~/.openclaw/workspace/slackoff/bridge/inbox`

and OpenClaw can emit aggregated results into:

- `~/.openclaw/workspace/slackoff/bridge/outbox`

In the current UI:

- the OpenClaw Channel card sends direct local messages through `/api/openclaw/channel`
- the main approval buttons call `/api/openclaw/decision`, so the decision pane has its own OpenClaw acknowledgement loop
- these actions still write compact decisions to `bridge/inbox`:

- `Y 同意`
- `I 忽略`
- `E 编辑`
- `确认执行`

So Slackoff now has both:

- a conversational local input/output loop via the channel session
- a compact decision handoff path via the file bridge

## Recommended Next Contract

When you finish the reader/notification side in OpenClaw, expose a dedicated payload like:

```json
{
  "items": [
    {
      "id": "msg-123",
      "priority": "p0",
      "risk": "high",
      "source": "slack/#ops-alerts",
      "summary": "系统警报：数据库连接失败",
      "sourceMessage": "原始消息正文",
      "aiDraft": "建议回复正文",
      "executionPreview": {
        "recipient": "#ops-alerts",
        "finalMessage": "最终文案",
        "screenshotPath": "/absolute/path/to/screenshot.png"
      }
    }
  ]
}
```

Slackoff should only send back compact human decisions:

```json
{
  "itemId": "msg-123",
  "decision": "approve_plan",
  "instruction": "/rewrite 更简洁",
  "confirmedBy": "local-user"
}
```
