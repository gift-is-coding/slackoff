# Slackoff <-> OpenClaw Integration

> 最后更新：2026-03-20

## Boundary

`Slackoff` is the frontend shell.

- queue UI（左侧队列）
- single-item decision area（右侧决策面板）
- Gate A / Gate B confirmation rhythm
- local keyboard-first workflow

`OpenClaw` is the runtime system.

- notification and message ingestion
- reading and context gathering
- AI drafting, prioritization, and `ai_reply` generation
- execution-preview screenshot capture
- real external execution and audit

---

## Notification Data Contract

Slackoff reads from `~/.openclaw/workspace/memory/notification-inbox.json`.

**Notification item fields** (all fields OpenClaw writes, Slackoff reads):

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique item ID |
| `source` | string | e.g. `xinwechat [reply_message]` |
| `app` | string | App identifier |
| `time` | string | Message timestamp |
| `content` | string | Raw notification text |
| `status` | string | `pending` / `approved` / `ignored` / `executed` / `dismissed` |
| `ai_reply` | string (optional) | **AI suggested reply — written by OpenClaw, displayed in "AI 建议"** |
| `execution_plan` | string (optional) | Execution preview draft (displayed in Step 2 preview window) |
| `screenshot_url` | string (optional) | Pre-execution screenshot path (shown in Step 2 caption) |
| `notes` | string | Free-form notes |
| `created_at` | ISO string | |
| `updated_at` | ISO string | Updated by Slackoff on each decision |

**`ai_reply` is the primary AI content surface.** OpenClaw generates and writes it; Slackoff only reads and displays it. No AI generation happens inside Slackoff.

---

## Routes Implemented

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/openclaw/items` | Read pending notifications as WorkItems |
| `GET` | `/api/openclaw/items?tab=processed` | Read processed notifications |
| `POST` | `/api/openclaw/decision` | Submit a human decision (approve / ignore / confirm_execute) |
| `GET` | `/api/openclaw/channel` | Read channel session transcript |
| `POST` | `/api/openclaw/channel` | Send message to openclaw CLI (debug console) |
| `GET` | `/api/openclaw/health` | Gateway health check |
| `GET` | `/api/openclaw/rpc` | List allowed RPC methods |
| `POST` | `/api/openclaw/rpc` | Forward RPC call to gateway |
| `GET` | `/api/openclaw/bridge` | Read bridge status + latest outbox |
| `POST` | `/api/openclaw/bridge` | Write bridge envelope |

---

## How Slackoff Connects to OpenClaw

### 1. File Bridge (primary, for decisions)

`POST /api/openclaw/decision` does:

1. Updates item `status` in `notification-inbox.json`
2. Writes a **bridge envelope** to `~/.openclaw/workspace/slackoff/bridge/inbox/`
3. Calls openclaw CLI (`openclaw agent --local --json --session-id slackoff_decision_loop`) with the decision context

Bridge envelope shape for `approve_plan`:

```json
{
  "type": "decision.plan_approved",
  "payload": {
    "itemId": "...",
    "decision": "approve_plan",
    "slashCommand": "<content after prefix>",
    "slashCommandMode": "instruction | direct_reply",
    "source": "WeChat",
    "summary": "..."
  }
}
```

**`slashCommandMode`** is set by the user's input prefix:
- `/...` → `"instruction"` — OpenClaw treats the text as an agent instruction (e.g. `/rewrite 更简洁`)
- `:...` → `"direct_reply"` — OpenClaw sends exactly the text after `:`, no modification

### 2. CLI Channel (debug + decisions)

`POST /api/openclaw/channel` runs:

```
openclaw agent --local --json --session-id slackoff_web_channel --message "<text>"
```

Used by:
- **Debug console** (top-right floating panel) for direct free-form chat with openclaw
- `POST /api/openclaw/decision` also sends the decision message to session `slackoff_decision_loop`

### 3. WebSocket Gateway (health / RPC)

`GET /api/openclaw/health` connects to `ws://127.0.0.1:18789` and calls `health` method.

---

## Session IDs

| Session | Use |
|---|---|
| `slackoff_web_channel` | Debug console chat (persistent) |
| `slackoff_decision_loop` | Decision confirmations (persistent) |
| `slackoff_suggest` | (reserved, currently unused) |

Override via env vars:
- `OPENCLAW_SLACKOFF_CHANNEL_SESSION_ID`
- `OPENCLAW_SLACKOFF_DECISION_SESSION_ID`

---

## Decision Channel Message Format

When a decision is submitted, Slackoff sends openclaw a message in this format:

**Instruction mode (`/`):**
```
[Slackoff decision] action=approve_plan source=WeChat
Summary: 邹恬：怎么设置自动回复
Operator instruction: rewrite 更简洁
Bridge file: ~/.openclaw/.../inbox/xxx.json
```

**Direct reply mode (`:`):**
```
[Slackoff decision] action=approve_plan source=WeChat
Summary: 邹恬：怎么设置自动回复
Operator instruction: reply with EXACTLY the following content, do not modify or paraphrase it:
---
好的，我们暂时不支持API接入，但可以设置定时消息
---
Bridge file: ~/.openclaw/.../inbox/xxx.json
```

---

## Recommended Next Contract (OpenClaw → Slackoff)

When OpenClaw finishes triage and drafting, write to `notification-inbox.json`:

```json
{
  "id": "msg-123",
  "status": "pending",
  "content": "原始通知文本",
  "ai_reply": "建议回复：好的，没问题",
  "notes": ""
}
```

Slackoff reads `ai_reply` directly. No additional API needed.

For execution preview (Gate B), write:
```json
{
  "notes": "{\"previewDraft\":\"最终文案\",\"finalRecipients\":\"发给谁\"}"
}
```
(currently Slackoff uses `previewDraft`/`finalRecipients` from WorkItem mapping — this is an area for future alignment)
