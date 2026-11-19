# imboss-fork 工作流（唯一权威版本）

> 适用对象：助理 + 6 名员工（Kai / Ada / Rune / Nova / Tess / Vera）+ Mira。**每次派活前，助理按第 9 节执行；员工按各自 systemPrompt 执行。** 与旧文档（`dev-team-and-skills.md`）冲突时，以本文件为准。
> 仓库：`C:\Users\听雨潇潇\.imboss\workdir\orca-imboss`（主 worktree，**只有 Kai 在这里写入**）；worktree 根目录：`C:\Users\听雨潇潇\.imboss\workdir\worktrees\`。
> 标的：老板自用的 orca-imboss fork（Electron + TS + React + SQLite），靠 rebase 跟进上游；自定义只写 `src/**/fork/**`，碰上游只碰已登记挂载点。

## 0. 三条不变量（取代旧的「同一时刻只有一个人写仓库」）

旧规则「同一时刻只有一个人能写仓库」在并行模型下**作废**。取而代之：

| # | 不变量 | 违反的样子 |
| --- | --- | --- |
| I1 | **一个 ticket = 一个 worktree = 一个 owner。** 单个人同时只开 1 个 worktree；worktree 里只做那一个 ticket | 两个人 cd 进同一个目录、或一个 worktree 里塞两个 ticket |
| I2 | **主 worktree（`orca-imboss`）只由 Kai 写**：合并、rebase、tag、挂载点登记、`fork/RUNBOOK.md` 与 `upstream-base.json` | Rune 在主 worktree 里改代码 |
| I3 | **路径所有权互斥**（第 1 节表）。**共享 fork 文件**（`src/shared/fork/types.ts`、`flags.ts`、`translations/zhCN.json`、`src/renderer/fork/modules.ts`）由**唯一 owner** 写：`src/shared/fork/**` 归 Rune，`src/renderer/fork/**` 归 Nova；要用到对方文件的改动，发消息请对方落，不自己动手 | Nova 直接改 `src/shared/fork/types.ts`；两人同时改同一个文件 |

**为什么这样就够**：路径互斥（I3）保证两个人不会改同一个文件，worktree 隔离（I1）保证两个人不会同时改同一个目录，主 worktree 独占（I2）保证 `fork` 分支的线性历史只有一个人在写。三者合起来就不需要「全局只有一个写手」这种排队式规则了。

## 1. 角色与边界（7 人 + 助理）

| 员工 | 一句话职责 | 只写这些路径 | 绝不碰 | worktree | 技能（已安装的确切名字） |
| --- | --- | --- | --- | --- | --- |
| **Kai** | 技术负责人：git 拓扑、上游同步、发版、CI、worktree 与挂载点登记 | 主 worktree 全部；`fork/tools/**`、`fork/RUNBOOK.md`、`fork/integration-points.md`、`fork/mount-claims.md`、`fork/upstream-base.json`、`.github/workflows/fork-*.yml`、`fork.config.json` | `src/**`（业务代码）、spec 正文、review 结论 | 主 worktree（不另开） | `diagnosing-bugs` `research` `wizard` `handoff` |
| **Ada** | 需求与规格：一句话 → spec → tickets + 验收标准；领域词汇 | `fork/specs/**`、`fork/GLOSSARY.md`、`fork/adr/**` | `src/**`、`fork/tools/**`、git 提交 | `worktrees\<ticket>-ada` | `grilling` `grill-with-docs` `to-spec` `to-tickets` `domain-modeling` `wait-what` `handoff` |
| **Rune** | 主进程 · 数据层 · IPC：`src/main/fork/**`、`src/shared/fork/**`、`src/preload/fork.ts`，以及 M1/M2/M6/M8/M9 挂载行 | 上述路径 + `fork/tests/**`（仅本人负责的模块） | 渲染层、`fork/tools/**`、`package.json`、`zhCN.json`（上游那份） | `worktrees\<ticket>-rune` | `implement` `tdd` `codebase-design` `diagnosing-bugs` `pr` |
| **Nova** | 渲染层 · React · 交互：`src/renderer/fork/**`（组件、页面、`modules.ts`），以及 M3/M3b/M4/M5 挂载行 | `src/renderer/fork/**` + 上述挂载行 | `src/main/**`、`src/shared/fork/**`（要改动请 Rune 落）、`package.json` | `worktrees\<ticket>-nova` | `implement` `tdd` `codebase-design` `pr` `prototype` |
| **Tess** | 测试工程：单元测试 `fork/tests/**`、e2e `fork/e2e/**`、回归清单、CI 里的测试信号 | `fork/tests/**`、`fork/e2e/**`、`fork/test-plan/**` | 产品代码（发现 bug 交回 owner）、`fork/tools/**` | `worktrees\<ticket>-tess` | `tdd` `diagnosing-bugs` `codebase-design` |
| **Vera** | 双轴评审与门禁：`code-review` 的 Standards + Spec 两轴，出 PASS / CHANGES REQUIRED 结论 | `fork/reviews/**`（只写报告） | 任何源码、spec 正文、`fork/tools/**` | 不建 worktree：在主 worktree 只读审阅（`git diff origin/fork...origin/<分支>`、`gh pr diff`） | `code-review` `tdd` `codebase-design` `research` |
| **Mira** | 流程与编排设计：本文件、员工 prompt、技能裁剪、retro、挂载点预算的事故分析 | `fork/process/**`、`~/.imboss/agent/skills/**`（起草，交助理执行） | `src/**`、`fork/tools/**`、spec 正文 | 不开 | `writing-for-agents` `retro` `grilling` `wait-what` `handoff` |
| **助理（0）** | 路由、派发、进度、把老板的决定落成任务、执行 app 配置 | app 配置（员工、技能勾选、cron） | **不写代码、不写 spec、不下评审结论、不自己判验收** | — | 内置 3 技能 + `handoff` |

> 18 个已安装技能全部有归属（Ada 7 / Rune 5 / Nova 5 / Tess 3 / Vera 4 / Kai 4 / Mira 5 / 助理 1，含重叠）。上表没出现的技能**不要勾选**：技能装进磁盘 ≠ 员工能用，只有被勾选的才会出现在会话里。

## 2. 工作项载体

```
fork/specs/<slug>/
  spec.md                 ← Ada 写；含「挂载方案」小节
  tickets/01-<slug>.md    ← Ada 写；Rune/Nova 认领
fork/reviews/<slug>-<YYYYMMDD>.md   ← Vera 写
fork/mount-claims.md                ← Kai 写（挂载点预占表）
fork/tests/<module>.test.ts         ← Tess/Rune 写（node --test 直接跑，需 fork/tests/tsconfig.json）
fork/e2e/playwright.fork.config.ts   ← Tess 建（testDir 相对配置文件；不改上游 playwright.config.ts）
fork/e2e/<flow>.spec.ts             ← Tess 写（CI 跑）
fork/process/retro-<YYYYMMDD>.md    ← Mira 写
```

**spec.md 必备小节**：Problem Statement / Solution / User Stories / Implementation Decisions / **挂载方案**（层 L0·L1·L2 + 挂载点 ID + 预计行数 + 为什么不用更便宜的层 + 明确不改什么）/ Testing Decisions（含「本机能跑什么」）/ Out of Scope / 验收标准。

**ticket 必备字段**（模板在 `skills/to-tickets`）：

```
# <NN>: <标题>
**层 / 挂载点:** L1 - new files under src/main/fork/** (no mount point)
**Blocked by:** 01, 02 | None (can start immediately)
**Status:** ready | claimed by <名字> @ <YYYY-MM-DD> | in-review | merged | parked
- [ ] 验收项 1
- [ ] 验收项 2
```

Status 流转只有四种合法迁移：`ready → claimed → in-review → merged`，任何一步失败回 `ready`（附一行原因）或 `parked`（附恢复条件）。**只有 Kai 能写 `merged`。**

## 3. 端到端流程（14 步）

| # | 步骤 | 谁 | 输入 | 输出物（落在哪） | 完成判据（可验证证据） | 失败回退 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 需求入口 | 老板 → 助理 | 一句话 / 一个现象 | 任务 chat | 助理已在 chat 里写明：类型、第一棒、验收人 | — |
| 2 | 路由（第 9 节路由表） | 助理 | 老板原话 | 派发消息 | 消息里有 `目标 / 约束 / 交付物 / 汇报格式` 四段 | 类型不清 → 先问老板一个问答卡片 |
| 3 | 需求拷问 | Ada | 老板原话 + 仓库现状 | 问答卡片（`imb_ask`） | 每轮 frontier 问题都带推荐答案；老板答完 | 老板不答 → 按推荐答案走，spec 里标「未确认假设」 |
| 4 | 写 spec（含挂载方案） | Ada | 拷问结论 | `fork/specs/<slug>/spec.md` | 文件存在 + 有 `## 挂载方案` 小节 + 验收标准可勾选 | 层选错 → **G0** 打回重写（不是让实现少写几行） |
| 5 | **G0 分层门禁** | Kai | spec | spec 内 `挂载方案` 被 Kai 追加一行 `G0: approved by Kai @ date` | `bash fork/tools/check-integration.sh` 预估面积 ≤ 预算（每处 ≤3 行） | 超预算 → 回第 4 步重定层（L2→L1→L0 逐级试） |
| 6 | 拆 tickets | Ada | 已批 spec | `tickets/NN-*.md` | 每个 ticket 有 `层 / 挂载点`、`Blocked by`、验收项；**一 ticket ≤1 挂载点** | 粒度粗 → 回第 6 步重切（不进入实现） |
| 7 | **G1 粒度门禁** | Vera | tickets | tickets 上的 `G1: ok by Vera @ date` | `grep -c "挂载点" fork/specs/<slug>/tickets/*.md` 与 `grep -L "验收" ...` 全通过 | 不合 → 回第 6 步 |
| 8 | 建 worktree（ticket 命中 L2 时同时预占挂载点） | Kai | 已批 ticket | `worktrees\<ticket>-<role>` + 分支 `feat/<ticket>-<slug>` + `fork/mount-claims.md` 一行 | `git worktree list` 里有该路径；`pnpm typecheck` 在该 worktree 里绿 | 建失败 → 删目录重来；挂载点已被占 → ticket 置 `parked` 或改 L1 |
| 9 | 实现（含 tdd） | Rune / Nova | ticket + spec | 分支提交 + `node --test fork/tests` 结果 | 本地四项绿：`pnpm typecheck`、`pnpm build`、`node --test fork/tests`、`bash fork/tools/check-integration.sh`（贴输出） | 冲突/卡住 20 分钟 → 停，置 `parked` 并 @Kai |
| 10 | 补测试（并行进行） | Tess | ticket + 实现分支 | `fork/e2e/<flow>.spec.ts`、`fork/test-plan/<slug>.md` | e2e 用例在 CI 里通过（贴 run 链接；命令 `pnpm exec playwright test --config fork/e2e/playwright.fork.config.ts`） | 用例不稳 → 标 `@flaky` 并从门禁集合移出，记录在 test-plan |
| 11 | 开 PR | Rune / Nova | 分支 | GitHub PR（`pr` 模板：最小可视化 + Evidence + 单向门判断） | `gh pr checks <n>` 显示 `verify` 绿 | CI 红 → 本分支修；不许绕 |
| 12 | **G2/G3/G4 评审** | Vera | PR + spec | `fork/reviews/<slug>-<date>.md`（含 verdict） | 报告首行 `PASS`；正文含 `check-integration.sh` 原始输出 + 双轴结论 + CI run 链接 | `CHANGES REQUIRED` → 回第 9 步；`SPEC NEEDS REWORK` → 回第 4 步 |
| 13 | 合并 | Kai | PASS 报告 + PR | `fork` 上的 squash 提交 + `mount-claims.md` 该行置 `released` | `bash fork/tools/check-integration.sh` 在 `fork` 上绿；`git log fork --oneline -1` 是该提交 | 合并冲突 → Kai 解；涉及 fork 业务代码 → 要 owner 在分支上 rebase 后重推 |
| 14 | **G6 真机冒烟 + 发版** | 老板 / Kai | `fork` 最新提交 | tag `v<官方>-fork.<YYYYMMDD>.<seq>` + Release | 老板在 chat 里逐条回 ✅（`fork/RUNBOOK.md` §8 六条）；`gh release view` 有产物 | 冒烟失败 → 修后发 `-fork.<日期>.2`，**永不删旧 release、不降版本** |

## 4. 并行与 worktree 规范

### 4.1 目录与分支

| 项 | 约定 |
| --- | --- |
| worktree 根 | `C:\Users\听雨潇潇\.imboss\workdir\worktrees\`（与主仓同一磁盘卷，否则 pnpm 硬链接失效） |
| worktree 路径 | `worktrees\<ticket>-<role>`，例 `worktrees\t03-rune`、`worktrees\t04-nova`、`worktrees\review-t03` |
| 分支 | `feat/<ticket>-<slug>`，例 `feat/t03-retry-backoff`；PR 目标恒为 `fork` |
| 谁建 | **只有 Kai**：`git worktree add ../worktrees/t03-rune -b feat/t03-retry-backoff fork` + 在该目录 `pnpm install --ignore-scripts --frozen-lockfile` |
| 谁清理 | **只有 Kai**，合并后：`git worktree remove --force ../worktrees/t03-rune` → `git branch -D feat/t03-...`（已 squash）→ `git worktree prune` |
| 员工进目录 | 员工的会话 cwd 是 `workdir`，开工第一条命令必须 `cd worktrees\<ticket>-<role>`；`pwd` 结果不是自己的 worktree 就停 |

**依赖与磁盘（实测）**：worktree 共享同一 `.git`（不复制历史，`.git` 仅 7.1MB）。`node_modules` **不会**被复制，需在 worktree 里跑一次 `pnpm install --ignore-scripts --frozen-lockfile`（实测 ~17s）。`node_modules` 标称 459MB，但 pnpm 的 store 用硬链接，**增量磁盘占用远小于 459MB**（最坏情况按 459MB/个 估）。三个并行 worktree ≈ 1.5GB 上限、安装 3×17s，可接受。`pnpm dev`/打包在 worktree 里同样跑不起来（本机无 MSVC），不需要额外适配。

### 4.2 挂载点「登记 + 预占」

唯一的挂载点台账是 `fork/mount-claims.md`，**只有 Kai 写**（避免两个实现员抢同一个文件）。格式：

```
| 挂载点 | 上游文件 | ticket | owner | 状态 | 起 | 释 |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | src/main/ipc/index.ts | t03 | Rune | claimed | 2026-11-19 | - |
| M3 | src/renderer/App.tsx | t04 | Nova | released | 2026-11-18 | 2026-11-20 |
```

规则：
1. ticket 命中 L2 时，Kai 在建 worktree 的同一次动作里写一行 `claimed`；**同一挂载点同一时刻只能有一行 `claimed`**。
2. 校验（可复制）：
   ```
   grep -c "| M1 |" fork/mount-claims.md            # 应 ≤ 1 行 claimed
   bash fork/tools/check-integration.sh             # 实际 FORK-MOUNT 与台账对账
   ```
3. 争用时的处理顺序：① 等（写进 ticket `Blocked by`）→ ② 改成 L1（把逻辑挪进 `src/**/fork/**`，通常可行）→ ③ 由 Kai 决定合并两个 ticket。**绝不**为了绕开争用去新开挂载点。
4. 合并后 Kai 把该行置 `released` 并填释放日期；台账只增不删（历史即证据）。

### 4.3 上游同步（rebase）与并行分支如何共存

**唯一入口**：只有 Kai 执行 `bash fork/tools/sync-upstream.sh`。任何员工都不许 rebase `fork`、不许 `git push fork`。

- **冻结窗口**：只要有任何 ticket 处于 `claimed` 或 `in-review`，`fork` 不 rebase。Kai 在此期间只做 `sync-upstream.sh --check`（只读），并把差距写进每日简报。
- **批量同步**：攒到「队列空」或「距上次同步 ≥7 天」时开窗，一次同步到最新 tag。上游 2–3 天一个版本，我们容忍 ≤7 天滞后（个人自用，滞后成本低于冲突成本）。
- **开窗顺序**（Kai 执行，别人不动）：
  1. 通知所有 owner「即将同步，停止推送」，等每个人回 `已停`；
  2. `bash fork/tools/sync-upstream.sh --check` → `bash fork/tools/sync-upstream.sh v<tag>`（在 `sync/<tag>` 上 rebase，自动自检）；
  3. 三道闸全绿后 `git switch fork && git merge --ff-only`；
  4. 广播「`fork` 现在在 `<新 tip sha>`，请各自 rebase」。
- **各人怎么跟**（**每个 owner 只 rebase 自己的分支**，在新 tip 公布后执行）：
  ```
  cd worktrees/<ticket>-<role>
  git fetch origin && git rebase origin/fork
  ```
  冲突处理：`// FORK-MOUNT:` 区域冲突 → 保留标记行 + 重放我们那 1–3 行（禁止整段取 ours/theirs）；上游代码冲突 → 取上游；`fork/` 目录冲突 → 保留我们。rerere 已开启，同类冲突第二次自动解。
- **绝不允许**两个人各自把分支 rebase 到不同 base：base 只能是「Kai 广播的那个 `fork` tip」。广播之前不开工新 ticket。
- **紧急例外**（安全修复/上游修了致命 bug）：Kai 可以直接开窗，所有人 `parked` 手里的分支，同步完立刻 rebase。

### 4.4 合并顺序与责任

- 合并者：**只有 Kai**。squash 合并进 `fork`，保持线性历史（否则下次 rebase 跟进上游会炸）。
- 合并前必须同时满足：① PR 的 `verify` 绿（`gh pr checks <n>`）；② Vera 报告首行 `PASS`；③ 该分支已 rebase 到**当前** `fork` tip 且 CI 仍有绿记录（rebase 后要重跑或看新 run）；④ 该 ticket 占用的挂载点台账行为 `claimed` 且改动行数符合预计。
- 合并顺序：**一次只合一个**。每合一个，Kai 让下一个分支 owner `git rebase origin/fork` 并等新 CI 绿，再合下一个。
- 冲突归属：合并冲突由 Kai 解；若冲突落在 fork 业务代码（`src/**/fork/**`）里，必须交回该分支 owner 在分支上 rebase 解决，Kai 不动别人的业务代码。

## 5. 门禁 G0–G6

| 门 | 验什么 | 证据（可复制/可点开） | 放行者 | 谁能推翻 |
| --- | --- | --- | --- | --- |
| **G0 分层** | 挂载方案是否已用到最便宜的层；挂载面积是否在预算内 | spec 里 `## 挂载方案` + `bash fork/tools/check-integration.sh` 输出 + spec 内 `G0: approved by Kai` | Kai | 老板任意时刻 |
| **G1 粒度** | 每个 ticket 端到端可验证、`Blocked by` 真 gate、**一 ticket ≤1 挂载点** | `grep -L "层 / 挂载点" fork/specs/<slug>/tickets/*.md` 无输出 | Vera | Kai（流程性原因） |
| **G2 本地** | typecheck / build / 单测 / 骨架自检 | 四条命令输出贴在 PR 正文：`pnpm typecheck`、`pnpm build`、`node --test fork/tests`、`bash fork/tools/check-integration.sh` | 实现者自查（证据必须贴） | Vera（发现伪造/缺项即打回） |
| **G3 CI** | `verify` job 全绿（typecheck+build+骨架+挂载面积）；`e2e-smoke` 目前是**参考信号**，红了要写结论但不阻断 | PR 链接 + `gh pr checks <n>` 输出 | 自动 | Kai / Vera（可要求先修再合） |
| **G4 评审** | 双轴：Standards（规范 + 挂载纪律硬违规）+ Spec（忠实度） | `fork/reviews/<slug>-<date>.md` 首行 verdict + 原始命令输出 + CI 链接 | **Vera 出 PASS 即视为通过**（老板不逐次过目） | 老板（随时否决）、Kai（仅流程原因） |
| **G5 登记** | 新功能已写进 `fork/integration-points.md`，台账行释放 | 合并后 `bash fork/tools/check-integration.sh` 在 `fork` 上绿 + 台账 `released` | Kai | — |
| **G6 冒烟** | 真机上六条：启动/侧栏/设置/技能列表/本次功能/无红色报错（`fork/RUNBOOK.md` §8） | 老板在 chat 逐条 ✅/❌ | **老板（唯一真人门）** | 只有老板 |

**挂载纪律硬违规（G4 直接判 `CHANGES REQUIRED`，无解释空间）**：diff 里出现以下任一即死——
1. `src/` 下非 `*/fork/*` 的改动行没有 `// FORK-MOUNT:Mx` 标记；
2. 某挂载点改动 > 3 行（M3b 除外，且 M3b 只许加名字）；
3. 出现 `src/shared/translations/zhCN.json`、`src/main/db/migrations.ts`/`user_version`、`package.json`、`electron-builder.yml`、`.github/workflows/release.yml` 的任何改动；
4. 台账里没有 `claimed` 行却改了某个挂载点。
证据：`bash fork/tools/check-integration.sh` 的原始输出（不许转述）。

## 6. 失败与回滚

| 情形 | 处置 | 退到哪 | 要恢复什么 |
| --- | --- | --- | --- |
| 分支 rebase 冲突解不了 | owner 20 分钟内解决不了就 `git rebase --abort`，ticket 置 `parked`，@Kai 说明冲突位置 | 第 8 步（保留 worktree）或第 6 步（要重切） | 分支回到上次绿 commit；挂载点台账行保留 |
| 上游同步冲突解不了 | `git rebase --abort`，删 `sync/<tag>` 分支，**不动 `fork`**；等下一次窗口，或上游发了修这个冲突的版本 | `fork` 不变 | 什么都不丢；简报里记「滞后原因」 |
| CI `verify` 红 | 分支上修；不许 `--no-verify`、不许注释掉检查、不许改 workflow 绕过 | 第 9 步 | 重跑证据（新 commit 或 `gh run rerun`） |
| `e2e-smoke` 红 | 先判断是不是已知 flaky（`fork/test-plan/<slug>.md` 有记录）→ 是则记录、继续；否则当 bug 修 | 第 9 步（产品 bug）/ 第 10 步（用例 bug） | 用例或产品任一修好并留 run 链接 |
| 上游大改（改了我们依赖的接口） | Kai 出 3 行结论：影响哪个 fork 模块、要谁改、要不要先跳过该 tag；必要时同步完成后立刻派一个 ticket | 第 4 步（新的适配 spec） | `fork` 已在新 tag 上且三道闸绿 |
| 功能做完但老板不想要 | **不删分支**（保留证据），PR 标 `wontmerge`；若已合并进 `fork`，发一个 `revert` 提交（不回滚版本号），并在 spec 里记「决策与日期」 | `fork` 上前进式回退 | 台账行置 `released`+原因；老板的决定写进 spec |
| 门禁被误放行（事故） | Mira 写事故分析进 `fork/process/`：哪道门、为什么漏、改成什么确定性检查 | 改门禁本身，不追责个人 | 新增/加强一条 `check-integration.sh` 规则或一条 prompt 纪律 |
| worktree 被搞坏（装错依赖、跑脏了） | Kai 直接删目录重建（成本 17s + 分支还在，零损失） | 第 8 步 | 分支完好；local 未提交改动丢弃（本来就不该有） |

## 7. 上游同步与发版节奏

| 事件 | 频率 | 谁 | 动作与产物 |
| --- | --- | --- | --- |
| 上游检查 | 每工作日 09:00（cron） | Kai | `bash fork/tools/sync-upstream.sh --check` → 回 3 行：最新 tag / 我们落后多少 / 有无安全相关改动 |
| 同步窗口 | 队列空 或 滞后 ≥7 天 | Kai | 第 4.3 节全流程；产物：`fork` 新 tip + `upstream-base.json` 更新 + 广播消息 |
| 发版前检查单 | 每次发版 | Kai | `check-integration.sh` 绿；`pnpm build` 绿；`fork` 上 CI 最新 run 绿；`integration-points.md` 无待登记项；`mount-claims.md` 无残留 `claimed` |
| 发版 | 有可交付功能且老板冒烟通过后 | Kai | `bash fork/tools/release.sh` → tag `v<官方>-fork.<YYYYMMDD>.<seq>` → `fork-release.yml` 打包 → `gh release view <tag>` |
| 发版后验证 | 每次发版 | 老板 | 装新版 → 确认「检查更新」行为正常（同日更早版本可升级、同版本不升级） |
| 回滚 | 只在修不回来时 | Kai | **前进式**：发更高版本修复。永不删 Release、永不降 semver |

## 8. 老板参与点（只有两处）

1. **需要决策时**：助理发问答卡片（`imb_ask`），一屏内可答完，每题带推荐答案。
2. **G6 真机冒烟**：升级后按 `fork/RUNBOOK.md` §8 六条点一遍，逐条回 ✅/❌。

其余时间不打扰：进度看任务卡、结论看 report。**老板随时可否决任何门禁结论**（一句话即生效，助理负责回滚编排）。

## 9. 助理编排规则（照此执行）

### 9.1 路由表

| 老板说的类型 | 第一棒 | 下一棒 | 允许并行 | 助理绝不自己做 |
| --- | --- | --- | --- | --- |
| 新功能 / 「我想要 X」 | Ada（拷问+spec） | Kai(G0) → Ada(拆 ticket) → Vera(G1) → Kai(建 worktree) → Rune/Nova（实现）+ Tess（测试） → Vera(G4) → Kai(合) → 老板(G6) | 实现与测试可并行；两个以上 ticket 可并行（各自 worktree） | 写 spec、定验收、判 PASS |
| 有个东西坏了 / 现象描述 | Vera（先复现定性）→ 若是上游 bug：Kai；若我们的：Rune/Nova | 修完走 G2→G4→合 | 否（先定性再动手） | 直接派给 Rune 让他「看看」 |
| 「上游那个功能我也想要」 | Kai（判断是否已在 L0 可配） | 需要代码 → Ada | 否 | 判断能不能零代码实现 |
| 「更新到最新版」/ 同步 | Kai | 同步后广播 | 否 | 自己跑 git |
| 「装个技能 / 改流程 / 团队怎么改」 | Mira | 助理执行 app 配置 | 否 | 改技能文件（Mira 起草、助理执行） |
| 「发版」 | Kai（检查单 → tag） | 老板 G6 | 否 | 自己打 tag |
| 一句话看不懂要什么 | 助理直接问老板（一个问答卡片） | — | — | 猜需求 |

### 9.2 派发规范

1. **一次只派一件**：一条消息一个 owner 一个目标；不同 ticket 才能并行，同一 ticket 的实现与测试可以同时派（不同人不同 worktree）。
2. **等前置步 report 再派下一棒**。不要「预期他会做完」就提前派。
3. **brief 四段式**（缺一段就是不合格派发）：
   ```
   【目标】一句话，可验收。
   【约束】层/挂载点、不许碰的文件、本机跑不了什么。
   【交付物】确切路径 + 格式（spec.md / ticket / PR / review 报告）。
   【汇报】report 里必须有的四项：做了什么、证据（命令输出或链接）、产出路径、要谁接手。
   ```
4. 派发时把相关文件路径直接写进消息，不要让员工自己去猜（员工 cwd 是 `workdir`，不是仓库）。
5. 涉及 git 拓扑（建/删 worktree、合并、rebase、tag）的动作**只派给 Kai**。

### 9.3 汇报与纠偏

| 情形 | 助理动作 |
| --- | --- |
| 员工报告完成 | 先看证据文件/命令输出是否存在；存在才更新进度卡，然后派下一棒 |
| 员工报了完成但**没有证据** | 不更新进度卡，回一条：「补上 §9.2【汇报】要求的证据，或说明哪一条没做到」 |
| 员工越界（写了不属于自己的路径、改了禁改文件） | **立即中断**（`imb_interrupt`），要求 `git checkout -- <路径>` 复原，并在 report 里记录一次事故；重复发生交 Mira 改 prompt |
| 员工卡住超过 30 分钟无进展 | 问一句「卡在哪一步、需要谁」，必要时改派或 `parked` |
| 两个员工在同一个 ticket 上撞了 | 立即停掉后来的那个，交 Kai 仲裁 worktree 归属 |
| 员工发现方案有问题（层选错、spec 漏需求） | 允许直接 @ 上一棒（Ada/Kai），不必绕助理；同时抄送助理一条一句话说明 |
| 老板中途改需求 | 停掉在跑的 ticket（`parked`），派 Ada 改 spec，重走 G0/G1，不要在原 branch 上硬改 |

### 9.4 「这一步算不算完成」的客观判据

只有两种东西算完成证据：**① 落在磁盘上的文件（路径可打开）；② 命令的原始输出或 CI/PR 链接（可点开）**。

- 「我看过了没问题」「应该可以」一律不算。
- 每道门的证据形态固定在第 5 节表格里，照抄即可。
- 助理自己不判技术结论（不判 review、不判冒烟、不判分层），只判「证据在不在」。

## 10. 度量与改进（每周 retro，Mira 主笔，助理排期）

| 指标 | 怎么取（可复制） | 健康线 | 超标时改什么 |
| --- | --- | --- | --- |
| 返工次数 | `grep -c "CHANGES REQUIRED" fork/reviews/*.md` | ≤1 / 每功能 | 提高 G1 粒度或补 `fork/CODING-STANDARDS.md` |
| 门禁拦下的问题 | `fork/reviews/*.md` 里 Standards 轴的挂载纪律条目数 | 有拦截是好事；连续 0 次要怀疑门禁失灵 | 加确定性检查（`check-integration.sh` 规则） |
| rebase 冲突数 | 同步简报里记「冲突文件数」 | ≤2 个文件/次 | 收敛挂载点、或把逻辑挪进 `src/**/fork/**` |
| 上游跟进延迟 | `upstream-base.json` 的 tag 日期 vs 今天 | ≤7 天 | 缩短冻结窗口、把 ticket 切小 |
| worktree 建/删耗时 | Kai 简报 | ≤2 分钟/个 | 预装依赖快照或减少并行数 |
| 员工越界次数 | 事故记录（`fork/process/`） | 0 | 改 prompt 硬纪律，或加机械检查 |

**谁改流程**：Mira 起草（改本文件需要助理批准），助理执行 app 配置，Kai 执行仓库侧改动。**流程文件本身也走版本**：改动写进 `fork/process/CHANGELOG.md`，注明日期与原因。

---

## 附录：命令速查（员工可直接抄）

```bash
# 进自己的场子
cd C:/Users/听雨潇潇/.imboss/workdir/worktrees/t03-rune

# 本地四道闸（G2 证据）
pnpm typecheck
pnpm build
node --test fork/tests
bash fork/tools/check-integration.sh

# 单跑一个测试文件（Node 24 直接吃 .ts，零依赖）
node --test fork/tests/backoff.test.ts

# 只格式化自己改的文件（禁止跑全仓 pnpm format，会重排上游文件）
pnpm exec prettier --write src/shared/fork/retry.ts

# 开 PR 前
git fetch origin && git rebase origin/fork
gh pr create --base fork --fill

# 查 CI
gh pr checks <n>

# Kai 专用：建/删 worktree
git worktree add ../worktrees/t03-rune -b feat/t03-retry-backoff fork
git worktree list
git worktree remove --force ../worktrees/t03-rune && git worktree prune
```
