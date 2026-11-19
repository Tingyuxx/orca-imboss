# fork 集成点登记表（imboss-fork）

这个文件是本 fork **唯一**的「我们改动了上游哪些地方」清单。规则很简单：

> 上游文件里只允许出现被 `FORK-MOUNT:Mx` 标记的行；没有标记的改动一律视为事故。
> 校验：`bash fork/tools/check-integration.sh`（CI 每次都会跑）。

## 0. 三层改造顺序（新功能一律从上往下试）

| 层 | 手段 | 例子 | 是否改上游文件 |
| --- | --- | --- | --- |
| L0 | 零代码扩展点 | `~/.imboss/agent/skills`（技能）、`~/.imboss/agent/mcp.json`（MCP server）、`~/.imboss/mini-apps`（mini app）、cron、设置里的 KV | 否 |
| L1 | 只加新文件 | `src/main/fork/**`、`src/shared/fork/**`、`src/preload/fork.ts`、`src/renderer/fork/**`、`fork/**` | 否 |
| L2 | 挂载点（`FORK-MOUNT`） | 下表的 M1–M9 | 是，每处 1–3 行 |

判断标准：能在 L0 解决的**绝不**写代码；必须写代码的先用 L1；只有「渲染层/主进程必须知道这个模块存在」时才用 L2。

## 1. 已悬挂的挂载点

| ID | 上游文件 | 位置 | 改动 | 行数 |
| --- | --- | --- | --- | --- |
| M1 | `src/main/ipc/index.ts` | 末尾 import + `registerRemoteHandlers` 结尾（`registerBackupHandlers` 之后） | `import { registerForkHandlers } from "./fork"` + `registerForkHandlers(bind)` | 2 |
| M2 | `src/preload/index.ts` | 顶部 import + `api` 对象末尾 | `import { forkApi } from "./fork"` + `fork: forkApi` | 2 |
| M5 | `src/main/locale.ts` | import + `TRANSLATIONS` | fork 词条 `{...zhCN, ...forkZhCN}` | 2 |
| M5 | `src/renderer/locale.ts` | import + `TRANSLATIONS` | 同上 | 2 |
| M6 | `src/shared/types/index.ts` | 文件末尾 | `export * from "../fork/types"` | 1 |
| M8 | `src/main/db/index.ts` | import + `initDatabase()` 里 `migrate(_db)` 之后 | `applyForkMigrations(_db)` | 2 |
| M9 | `src/main/index.ts` | import + `app.whenReady` 里 `initUpdater()` 之后 | `initFork()` | 2 |

为什么是这几处（选点依据见方案文档第 2 节的历史改动统计）：
`src/main/db/index.ts` 历史改动 2 次、`src/renderer/locale.ts` 1 次、`src/main/locale.ts` 6 次、`src/renderer/App.tsx` 12 次；
而 `src/shared/translations/zhCN.json`(103)、`src/preload/index.ts`(54)、`package.json`(54)、`app-store.ts`(47) 是高频文件，尽量只挂一行或根本不碰。

## 2. 预留挂载点（需要时再加，别提前挂空代码）

| ID | 上游文件 | 加的条件 | 精确做法 |
| --- | --- | --- | --- |
| M3 | `src/renderer/App.tsx` | 第一个 fork 自带页面（`MODULE_VIEWS`）| `import { FORK_MODULE_VIEWS } from "./fork/modules"`，在 `MODULE_VIEWS` 里 `...FORK_MODULE_VIEWS` |
| M3b | `src/renderer/app-store.ts` | 同上 | **无法避免**：`AppModule` 联合类型与 `VALID_MODULES` 都在这个文件里，新增模块名必须改这里。届时只加 union 成员 + 数组里加一项，仍用 `// FORK-MOUNT:M3` 标记（这是唯一一个可能改动超过 3 行的挂载点，务必只加名字，不加逻辑） |
| M4 | `src/renderer/components/nav/index.tsx` | 同上 | `NAV_ITEMS` 里 `...FORK_NAV_ITEMS` |
| M7 | `src/shared/constants/settings.ts` | 第一个需要在设置里持久化的 fork 选项 | `SettingKeys` 里加 `ForkXxx: "fork.xxx"`（键名一律 `fork.` 前缀，避免和上游撞） |

`src/shared/constants/settings.ts` 的键是全应用共享的 KV，**fork 专用键必须带 `fork.` 前缀**，
这样上游将来加同名功能也不会覆盖老板的设置。

## 3. 禁改 / 慎改清单

| 文件 | 原因 | 替代做法 |
| --- | --- | --- |
| `src/shared/translations/zhCN.json` | 上游最高频改动（103 次），冲突王 | 词条写到 `src/shared/fork/translations/zhCN.json`，M5 处合并；fork 键优先 |
| `src/main/db/migrations.ts` + `PRAGMA user_version` | fork 追加会导致**官方版跳过它自己的迁移** | `src/main/fork/migrations.ts` 独立表 `fork_migrations`，表名 `fork_` 前缀 |
| `electron-builder.yml` | 上游发布配置 | `electron-builder.fork.yml`（模板）+ `fork/tools/gen-builder-config.mjs` |
| `dev-app-update.yml` | 上游开发期更新源（指向官方） | 不改；只在 RUNBOOK 里注明「dev 里手动检查更新会查官方仓，别点安装」 |
| `package.json` | 高频（54 次） | 不新增 script、不加依赖；脚本一律 `node fork/tools/xxx.mjs`，CI 里写全命令 |

## 4. 结构约定

```
fork.config.json              # 唯一配置源：owner/repo、appId、产品名、tag 前缀、CI 版本
electron-builder.fork.yml     # 打包配置模板（@@…@@ 占位符由 gen-builder-config 填）
fork/
  upstream-base.json          # 当前基线：官方 tag + commit + 同步时间（--finalize 维护）
  integration-points.md       # 本文件
  RUNBOOK.md                  # 操作手册
  tools/
    bootstrap.sh              # 新克隆里恢复环境（补 upstream remote、rerere、切分支）
    sync-upstream.sh          # 跟官方同步（--check / <tag> / --finalize）
    release.sh                # 发 fork 版本（算 tag → 打 tag → 推 tag）
    check-integration.sh      # 骨架自检（本文件第 1 节 + 挂载面积预算）
    gen-builder-config.mjs    # 生成 .electron-builder.fork.gen.yml
    set-version.mjs           # 按 tag 改写 package.json version（不提交）
.github/workflows/
  fork-ci.yml                 # typecheck + build + e2e + 骨架自检
  fork-release.yml            # 打 tag → 打包 → 发布到本仓 Release
src/shared/fork/              # 共享层（tsconfig 已覆盖，无需改 tsconfig）
  flags.ts                    # FORK_ENABLED + 各功能开关
  types.ts                    # 对渲染层暴露的类型
  translations/zhCN.json      # fork 词条
src/main/fork/                # 主进程：identity/自检、迁移
src/preload/fork.ts           # window.imb.fork.*
```

## 5. 新功能登记（每加一个功能补一行）

| 功能 | 层 | 涉及文件 | 挂载点 | 开关 | 回归测试/冒烟 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| （示例）fork 身份 + 更新源自检 | L1+L2 | `src/main/fork/index.ts`、`src/preload/fork.ts`、`src/main/ipc/fork.ts` | M1,M2,M9 | `FORK_ENABLED` | 启动看 console 无 `[fork] 更新源指向` 报错；`window.imb.fork.info()` 有值 | 已完成 |
