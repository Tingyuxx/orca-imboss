# 零代码能力清单 + 第一批候选功能（供老板勾选）

写这个文件时没改任何功能代码，只是把「现有版本已经能干什么」和「值得先做什么」摊开。
所有路径/字段都是在本仓源码里查到的（括号里给了出处），不是猜的。

---

## 一、五层「不改代码就能拿到」的能力

按「加一步就能用」排序，越靠前越便宜。每条都给了具体做法和步数。

### 1. Skills（技能）：`~/.imboss/agent/skills/<name>/SKILL.md`

- **是什么**：标准 Agent Skills 格式 —— 一个文件夹，`SKILL.md` 里 frontmatter 写 `name` + `description`，
  正文是给模型的操作说明，可以再带脚本/模板等附件文件（`src/main/agent/builtin-skills.ts` L153–193）。
  应用把 `SKILL.md` 的**绝对路径**写进员工上下文，模型按需读取执行。
- **怎么加**：建 1 个文件夹 + 1 个 `SKILL.md`（+ 可选脚本），或者直接跟助手说「帮我写个 xxx 技能」——
  内置 `skills-management` 技能就是干这个的。**0 行代码，2 分钟。**
- **能拿到**：把重复的操作固化成流程（含调用本机 shell 的脚本）、给员工灌领域知识/规范、把一段长 prompt 变成可复用资产。
- **现成例子（随代码内置，可参考写法）**：`skills-management`、`mcp-management`、`mini-app-development`。

### 2. MCP server：`~/.imboss/agent/mcp.json`

- **是什么**：一个 JSON 对象，key 是 server 名，两种 transport：
  stdio `{ "command": "npx", "args": [...], "env": {}, "cwd": "..." }` 或 http `{ "url": "https://…", "headers": {} }`
  （`src/main/mcp-store.ts` L29–30、L286–342）。
- **怎么加**：加 1 个条目（或让助手用 `mcp-management` 技能改），然后在员工那里勾上这个 server。**0 行代码，1 分钟。**
- **能拿到**：任意外部系统变成员工的工具 —— GitHub、浏览器自动化、数据库、公司内部 API、你自己写的脚本服务。
  这是「不改代码扩展产品能力」性价比最高的一条路。

### 3. Mini Apps：`~/.imboss/mini-apps/<id>/metadata.json`

- **是什么**：本质是**本地 web 服务 + iframe 入口**。`metadata.json` 字段：
  `{ name, icon, entry, command?, args?, cwd?, env? }`，`entry` 必须是 loopback http(s)；
  有 `command/args` 就会自动拉起这个服务（`src/main/mini-apps.ts` L40–70）。侧栏顺序在 `mini-apps/index.json`。
- **怎么加**：写一个能起本地端口的页面（任意栈），放 `metadata.json`，重启应用即出现在侧栏。**0 行 Electron 代码**。
- **能拿到**：任何「网页做得出来的界面」——仪表盘、报表、看板、内部工具，不必碰 React 主工程。

### 4. 员工/团队：`imb_set_employees`

- **是什么**：员工的 `name / role / systemPrompt / mcp(工具集) / skills / model / thinkingLevel` 都能通过对话创建和修改，
  `id: 0` 还能自改助手自己的 systemPrompt（`src/main/agent/builtin-tools.ts` L567+）。
- **能拿到**：给不同工作造专用角色（比如「上游同步专员」「日报作者」「代码审查」），各带不同技能和模型。
  内置配套工具：`imb_create_chat`、`imb_send_message`、`imb_read_chat`、`imb_list_employees`、`imb_toolset`、`imb_ask`、`imb_progress`、`imb_interrupt`、`imb_get_employee_stat`、`imb_generate_image`。

### 5. 定时任务：`imb_set_cronjob`

- **是什么**：一条 cron job = `{ chatId, employeeId, schedule(cron 表达式), content }`（`src/shared/types/cron.ts` L34–40）——
  到点就给某个员工在某个会话里发一条 prompt，**拥有全套工具权限**。
- **能拿到**：定时提醒、每日简报、定期巡检（含「检查上游有没有新版本」）、定时备份。**0 行代码。**

### 6. 设置项（设置页现有开关，`src/shared/constants/settings.ts`）

`app.locale`（界面语言）、`agent.defaultModel`、`agent.imageModel`、`agent.defaultThinkingLevel`、
`agent.userEnv`（给工具用的环境变量）、`agent.workdir`（agent 工作目录）、`app.commonProjects`（常用项目短名单）、
`network.httpProxy`、`ui.theme.mode` / `ui.theme.color`、`ui.module`、`app.windowShortcut`（全局显隐快捷键）。

### 7. IM 集成：`~/.imboss/integrations.json`

支持的平台：`wechat` / `qq` / `telegram`（`src/shared/types/integrations.ts` L10）。
接上以后，外部消息就是触发源，员工可以直接在 IM 里干活。

---

## 二、层 0 做不到什么（必须动代码）

| 想要的效果 | 为什么做不到 | 要碰哪里 |
| --- | --- | --- |
| 应用侧栏多一个**原生**页面/模块（不是 iframe） | 模块要注册进 `AppModule` 联合类型与 `VALID_MODULES` | `src/renderer/app-store.ts` + `App.tsx`(M3) + `nav/index.tsx`(M4) —— 唯一会碰热点文件的一类 |
| 新的主进程能力（新 IPC 通道、新数据库表） | 没有通道渲染层调不到 | 新文件 `src/main/fork/**` + M1/M2 各 1 行；DB 只能加 `fork_` 前缀表 |
| 托盘/原生菜单/系统级集成 | 上游没暴露扩展点 | 需要新增挂载点，属于「大改」，先别做 |
| 改自动更新/打包行为 | 由 `electron-builder.fork.yml` 决定 | 已在本 fork 里做完了 |

---

## 三、第一批候选功能（请老板勾选）

记号：**层** = 需要的改造层级（0 = 零代码）；**工作量** = 小（≤半天）/ 中（1–2 天）/ 大（>2 天）；
**碰热点？** = 是否改上游高频文件（改了就增加同步冲突）。

| # | 功能 | 做什么 | 层 | 工作量 | 碰热点？ |
| --- | --- | --- | --- | --- | --- |
| 1 | **上游发版哨兵** | 定时（如每 6 小时）检查官方 tag；有新版本就在会话里给出「影响面摘要」：新版 diff --stat、我们 6 个挂载文件是否被改动、能否直接 rebase | 0（skill + cron，脚本用 git/gh） | 小 | 否 |
| 2 | **自动备份** | 每天把 `~/.imboss/db/imboss.db` 导出到指定目录并只保留最近 N 份（仓库本身就有 `pnpm db:export`） | 0（skill + cron） | 小 | 否 |
| 3 | **每日工作简报** | 每晚汇总当天会话/成本/未完成任务，用 `imb_get_employee_stat` + 现有 Spend 模块数据，发到指定会话或微信 | 0（cron + 员工） | 小 | 否 |
| 4 | **外部工具接入（MCP）** | 想接什么就接什么：GitHub / 浏览器 / 本地文件目录 / 公司内部 API。给 1–3 个你常用的，我写 `mcp.json` 条目 + 配套 skill | 0 | 小–中 | 否 |
| 5 | **个人工作台 Mini App** | 一个本地页面聚合：今日待办、今日花费、定时任务下次运行时间、fork 版本与上游基线。开一屏看完 | 0（mini app，自带本地服务） | 中 | 否 |
| 6 | **fork 状态面板** | 把 `window.imb.fork.info()` 的 base tag / 更新源 / 最近同步时间做成可视化（先做 mini app 版最省） | 0（mini app）→ 若要原生页面则 2（M3/M4/M7） | 小 / 中 | 否 / 是 |
| 7 | **会话导出（Markdown/JSON）** | 一键把某个会话导出成可归档的 Markdown；可以先用层 0（让员工读会话再写文件）验证需求，再考虑做原生按钮 | 0 → 2 | 小 → 中 | 否 → 是 |
| 8 | **快捷键与命令面板** | 一个统一入口（`Cmd/Ctrl+K`）快速切会话/派活/跑技能 | 2（新页面 + 快捷键） | 中 | 是（`app-store.ts`、`chat-module`） |

建议的推进顺序：**先 1 + 2**（当天就能用，且都在零代码层，顺便验证 skill/cron 这套扩展方式），
然后看需求在 3/4/5 里挑一个；7/8 这类**原生界面功能放到最后**，因为它们必须动热点文件，收益/冲突比最差。

## 四、明确不建议做的事（避免踩坑）

1. 改 `src/shared/translations/zhCN.json`（上游 103 次改动，冲突王）—— 词条写 `src/shared/fork/translations/zhCN.json`。
2. 动 `src/main/db/migrations.ts` 的 `user_version` —— 会让官方版跳过它自己的迁移。
3. 让打包 `publish` 指回官方仓 —— 一次自动更新就把 fork 覆盖成官方版。
4. 用 `fork-v…` 形状的 tag —— 不是合法 semver，自动更新永远收不到（详见 `RUNBOOK.md` 第 4 节）。
