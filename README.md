# Slackoff

Slackoff 是一个前端优先的 Command Center，用来承接消息分诊、AI 草稿确认和最终执行确认。

当前仓库已经初始化为 `Next.js + React + TypeScript` 工程，并且明确把系统边界拆成两层：

- `Slackoff`：只负责前端交互、状态可视化、双阶段确认节奏。
- `OpenClaw`：负责本地消息/notification 采集、AI 生成、执行前截图、真实执行与审计。

## 运行

```bash
npm install
npm run dev
```

默认地址：

- App: `http://localhost:3000`
- Local health route: `http://localhost:3000/api/openclaw/health`
- Local channel route: `http://localhost:3000/api/openclaw/channel`
- Local decision route: `http://localhost:3000/api/openclaw/decision`
- Local rpc route: `http://localhost:3000/api/openclaw/rpc`
- File bridge route: `http://localhost:3000/api/openclaw/bridge`

## 本地 OpenClaw 连接

应用服务端会优先读取本机 `~/.openclaw/openclaw.json`，自动连接本地 OpenClaw gateway。

可选覆盖：

- `OPENCLAW_CONFIG_PATH`
- `OPENCLAW_GATEWAY_URL`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_GATEWAY_PASSWORD`
- `OPENCLAW_SLACKOFF_SESSION_KEY`

注意：

- token 只在服务端读取和使用，不会暴露到浏览器端。
- 这里做的是本地 OpenClaw 适配，不会在 Slackoff 里复写 OpenClaw 的业务能力。
- 当前主交互链路是 `/api/openclaw/channel`，它通过 `openclaw agent --local --session-id ... --json` 与本地 OpenClaw 直接对话，再从本地 session transcript 回读结果。
- 审批按钮现在走 `/api/openclaw/decision`：同一次动作里会把 machine-readable decision 写入 `bridge/inbox`，并把 human-readable confirmation 发到独立的 decision session。
- `chat.send` 在当前桥接里默认会被强制成 `deliver: false`。
- gateway 目前主要用于 `health` 和受控读操作；`chat.send` 仍可能受 `operator.write` 限制。
- 如果你暂时不想处理 gateway operator auth，Slackoff 也保留了 OpenClaw workspace 下的 `bridge/inbox` 和 `bridge/outbox` 文件桥。
- 首页里的 `Y 同意 / I 忽略 / E 编辑 / 确认执行` 按钮现在会真实写入 `bridge/inbox/*.json`，用于把人工决策交回 OpenClaw。

## 目录

```text
slackoff/
├── app/                              # Next.js app router
│   ├── api/openclaw/channel/route.ts # 本地 OpenClaw channel（CLI + transcript）
│   ├── api/openclaw/decision/route.ts# 审批动作 -> bridge + channel 的闭环
│   ├── api/openclaw/health/route.ts  # 本地 gateway 健康检查代理
│   ├── api/openclaw/bridge/route.ts  # OpenClaw workspace 文件桥
│   ├── api/openclaw/rpc/route.ts     # 受控 RPC 桥接
│   ├── globals.css                   # Command Center 视觉系统
│   ├── layout.tsx
│   └── page.tsx                      # 首页 Command Center
├── components/
│   └── command-center.tsx            # 前端主界面
├── lib/
│   ├── openclaw/                     # 本地 OpenClaw 配置与 WS 调用
│   └── slackoff/                     # 前端领域模型与 mock 数据
└── docs/                             # 设计与规范文档
    ├── OPENCLAW_INTEGRATION.md
    ├── PRODUCT_DESIGN.md
    ├── UI_PRD.md
    └── UI_SKETCH_command_center.md
```

## 设计与代码的关系

当前首页落实的是文档里已经收敛的方向：

- 左侧高密度消息队列
- 右侧单条决策区
- 两阶段确认
- 执行前只看一张完整截图

其中消息读取、notification 列表、AI 草稿生成、最终发送都不在这个仓库里实现，而是通过本地 OpenClaw 提供。

当前已经跑通的本地 I/O 关系是：

- 主输入/输出：`/api/openclaw/channel`
  - 输入：Slackoff 服务端调用 `openclaw agent --local --session-id ... --json`
  - 输出：从 `~/.openclaw/agents/main/sessions/<session>.jsonl` 回读 transcript
- 审批闭环：`/api/openclaw/decision`
  - 输入：UI 的 `Y / I / E / 确认执行`
  - 输出：OpenClaw 的确认回复会直接回显到主工作流，同时 transcript 会进入独立的 decision session
- 辅助输出：`/api/openclaw/health`、`/api/openclaw/rpc` 里的 `sessions.list` / `chat.history`
- 辅助输入：前端按钮把人工决策写进 `~/.openclaw/workspace/slackoff/bridge/inbox`
- 限制：gateway 的 `chat.send` 写路径当前仍受 `operator.write` 限制，所以实时对话主链路落在 local channel，而不是 gateway chat.send

## 后续接入建议

下一步应该在 OpenClaw 里补一个 Slackoff 专用的聚合接口或 skill，然后让这里的 mock queue 切到真实数据源。这样职责不会混乱：

- OpenClaw 输出 `triage items / draft / screenshot / execution status`
- Slackoff 只消费这些结果并承载人工确认

更细的边界和 I/O 约定见 [OPENCLAW_INTEGRATION.md](/Users/wutianfu/Documents/code/slackoff/docs/OPENCLAW_INTEGRATION.md)。
