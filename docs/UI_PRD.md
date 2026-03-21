# Slackoff UI PRD（Command Center 版）

> 初版：2026-03-14 | 最后更新：2026-03-20（对齐当前实现）
> 关联文档：`./PRODUCT_DESIGN.md` · `./OPENCLAW_INTEGRATION.md` · `./UI_SKETCH_command_center.md`

---

## 1. 目标

把前端做成"快捷键驱动 + 单条专注处理"的操作台：

- 全部通知汇聚一处，优先级标签一目了然
- AI 建议直接来自 OpenClaw，无需前端调用 AI
- 所有有外部影响的动作必须经过两轮确认（Gate A → Gate B）
- 核心流程可纯键盘完成

---

## 2. 当前实现布局（2 栏）

### 左栏：队列（Inbox Pane）

- 标题 + `[ALL]` / `[P0/P1]` 过滤切换（`F` 键）
- 两个 Tab：**待处理** / **已处理**（`⌘1` / `⌘2` 或 `←/→`）
- 搜索框（`>` 提示符）
- 队列卡片列表：优先级标签、频道、摘要、时间、风险

### 右栏：决策面板（Decision Pane）

三阶段步骤条：`1:plan → 2:exec → 3:done`

**Step 1 — 方案确认**
- `// 原始消息`：src / to / act 标签 + 原文
- `// AI 建议`：`ai_reply` 字段内容（OpenClaw 生成，Slackoff 只读）
- Slash 输入框（`/` 或 `:` 触发）
- 操作按钮：`[Y] 确认方案` / `[I] 忽略`
- 风险低时高亮提示：`▸ 风险低 — 按 I 或 回车 可直接忽略`
- Bridge 状态通知 + OpenClaw 回复文本

**Step 2 — 执行确认**
- `// 执行预览`：收件人 + 最终文案（模拟发送窗口样式）
- Slash 输入框
- 操作按钮：`[Y] 确认执行` / `[I] 取消`
- OpenClaw 回复文本

**Step 3 — 完成**
- `// 执行结果`：✓ done + bridge 状态

**Debug Console（右上角悬浮）**
- `[>_] openclaw` 按钮展开/收起
- 直接与 openclaw CLI 对话（`POST /api/openclaw/channel`）
- 用于调试 openclaw 连通性和回复质量

---

## 3. 快捷键（当前实现）

| 键 | 功能 |
|---|---|
| `W` / `↑` | 列表上移 |
| `S` / `↓` | 列表下移 |
| `Y` / `Enter` | 确认当前步骤 |
| `I` | 忽略当前条目 |
| `/` | 激活 Slash 输入，AI指示 模式 |
| `:` | 激活 Slash 输入，直接回复 模式 |
| `F` | 切换 P0/P1 过滤 |
| `←` / `→` | 切换 待处理 / 已处理 tab |
| `⌘1` / `⌘2` | 同上 |
| `?` | 快捷键帮助面板 |
| `Esc` | 退出焦点 / 关闭帮助 |

---

## 4. Slash 输入双模式

输入框始终显示两种模式提示（当前激活的用 `[x]` 括起）：

```
> [/] AI指示   : 直接回复
```

### `/` 模式 — AI 指示

- 按 `/` 触发，草稿重置为 `/`，光标定位在后
- 用户输入指令，如 `/rewrite 更简洁，先确认截止时间`
- 确认后，openclaw 收到：`Operator instruction: rewrite 更简洁...`
- openclaw 自主决定如何处理和回复

### `:` 模式 — 直接回复

- 按 `:` 触发，草稿重置为 `:`，光标定位在后
- 用户直接输入回复内容，如 `:好的，我周末有空`
- 确认后，openclaw 收到：`reply with EXACTLY: 好的，我周末有空`
- openclaw 按原文执行，不做改写

### 区别体现在 Bridge 信封中

```json
{
  "slashCommandMode": "instruction | direct_reply",
  "slashCommand": "<内容（已去掉前缀）>"
}
```

---

## 5. AI 建议来源

`// AI 建议` 区域直接读取 `notification-inbox.json` 中每条通知的 `ai_reply` 字段。

- **写入方**：OpenClaw（在通知入库时生成）
- **读取方**：Slackoff（只读，不生成）
- 为空时显示 `（无AI草稿）`

---

## 6. 决策流程

```
用户按 Y
  ↓
POST /api/openclaw/decision
  ├── 更新 notification-inbox.json status
  ├── 写入 bridge/inbox/*.json（bridge 信封）
  └── 调用 openclaw CLI → session: slackoff_decision_loop
        ↓
  返回 { bridge: {ok, filePath}, channel: {ok, replyText} }
  ↓
界面显示：bridge 状态通知 + openclaw 回复文本
```

---

## 7. 数据模型（前端 WorkItem）

从 `NotificationItem` 映射而来：

| 字段 | 来源 |
|---|---|
| `id` | `item.id` |
| `priority` | 从 content 语义推断（P0/P1/P2/P3） |
| `risk` | 固定 `low`（后续由 OpenClaw 提供） |
| `source` | 从 `app` 字段提取（WeChat / Teams / Email 等） |
| `summary` | `content` 截断 80 字 |
| `deadline` | 相对时间（`item.time`） |
| `aiDraft` | **`item.ai_reply`**（OpenClaw 写入） |
| `previewDraft` | **`item.execution_plan`**（OpenClaw 写入，Step 2 预览用） |
| `screenshotUrl` | **`item.screenshot_url`**（OpenClaw 写入，截图路径） |
| `sourceMessage` | `item.content`（原始全文） |

---

## 8. 组件结构

```
CommandCenter（页面状态管理）
  ├── 左栏：inbox list（tabs + search + queue cards）
  └── 右栏：CommandCenterWorkspace
              ├── DebugConsole（固定右上角悬浮）
              ├── StepIndicator
              ├── StepOnePlan     (step1)
              ├── StepTwoExecute  (step2)
              ├── StepThreeResults(step3)
              ├── ProcessedItemSummary（已处理 tab）
              └── shortcut-bar + shortcut-overlay
```

---

## 9. 可用性验收标准

- 新用户 5 分钟内可完成首次"分诊 → 确认方案 → 确认执行"闭环
- 常见任务（查看 → 轻改草稿 → 发送）≤ 20 秒
- 80% 高频操作可纯键盘完成

---

## 10. 后续待做（对照原始 PRD）

| 项目 | 状态 |
|---|---|
| priority 和 risk 由 OpenClaw 写入（而非前端推断） | ⬜ 待 OpenClaw 实现 |
| finalRecipients 由 OpenClaw 填充（当前前端硬编码 `来源: xxx`） | ⬜ 待 OpenClaw 实现 |
| 执行前截图（`screenshot_url` 字段已接，前端展示待完善） | 🔶 部分实现 |
| 忽略 HIGH 风险需二次确认 | ⬜ 未实现 |
| Undo（发送后 5~15 秒撤销） | ⬜ 未实现 |
| 批量处理（Command Bar） | ⬜ 未实现 |
| 4 面板 Monitor Wall 布局 | ⬜ 暂不做，当前 2 栏够用 |
