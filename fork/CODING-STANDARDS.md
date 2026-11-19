# fork 代码规范（Rune / Nova / Tess 必读，Vera 按此评审）

目的只有一个：**让上游同步永远不需要手工解冲突**。风格分歧可以商量，下面带 ⛔ 的条款没有商量空间。

## 1. 文件放哪
| 你要写的东西 | 放这里 |
| --- | --- |
| 主进程新逻辑 | `src/main/fork/<module>.ts`（`src/main/fork/index.ts` 统一导出/初始化） |
| 数据结构、纯函数、类型 | `src/shared/fork/`（`types.ts` 只放类型，`flags.ts` 只放开关） |
| IPC | handler 在 `src/main/ipc/fork.ts`，渲染层入口在 `src/preload/fork.ts`，类型走 `src/shared/fork/types.ts` |
| 渲染层组件/页面 | `src/renderer/fork/**`；页面注册表 `src/renderer/fork/modules.ts` |
| fork 词条 | `src/shared/fork/translations/zhCN.json`（键名一律 `fork.` 前缀） |
| 迁移 | `src/main/fork/migrations.ts`，表名 `fork_` 前缀，记账表 `fork_migrations` |
| 单元测试 | `fork/tests/<module>.test.ts` |
| e2e | `fork/e2e/<flow>.spec.ts` |
| 一次性脚本 | `fork/tools/<name>.mjs`（不改 `package.json` 加 script） |

⛔ 不新建 `src/**/fork/` 之外的文件（除了上面登记的挂载行）。新文件必须是「新路径」，不是「插进上游目录再改上游文件」。

## 2. 挂载点写法
- 上游文件里的每一行改动都必须落在已登记的 `FORK-MOUNT:Mx` 行上，且整处合计 1–3 行。
- 形态固定为「顶部 ad import + 一处调用/展开」：
  ```ts
  import { registerForkHandlers } from "./fork"   // FORK-MOUNT:M1
  ...
  registerForkHandlers(bind)                      // FORK-MOUNT:M1
  ```
- ⛔ 不在上游文件里做「顺手整理」（换 import 顺序、改类型、加注释、格式化）。
- ⛔ 一个 PR 最多碰 1 个挂载点；需要第二个就拆 ticket。
- ⛔ 新挂载点必须由 Kai 先登记进 `fork/integration-points.md` + `fork/mount-claims.md`，代码后到。

## 3. 命名与风格
- 沿用上游的习惯优先于个人偏好：文件名 kebab-case / 组件 PascalCase、函数 `verbNoun`、布尔 `is/has/can`、fork 专有符号统一 `Fork` 前缀或放在 fork 目录里避免与上游同名。
- 类型：`type` 用于数据形状，`interface` 只在上游已有 `interface` 的地方沿用；导出类型集中在 `src/shared/fork/types.ts`。
- 不写默认导出给 fork 模块（便于 grep 与 tree-shaking 判断），除非上游惯例要求。
- 注释写「为什么」，不写「这行在干什么」。涉及上游行为的判断，注释里带一句依据（文件路径或 commit）。

## 4. 测试
- 纯逻辑（解析、状态归约、格式化、校验、退避计算）：**必须**有 `fork/tests` 单测，`node --test fork/tests` 能跑。
- 单测约束：`import { x } from "../../src/.../file.ts"`（带 `.ts`）；不用 path alias；不用 `enum`/`namespace`。
- UI 行为与端到端：`fork/e2e/<flow>.spec.ts`，命名描述用户行为（`retries failed send with backoff`），一个文件一条主流程。
- ⛔ 不放宽断言、不加 `skip`、不加 retry 来掩盖不稳定；已知 flaky 登记进 `fork/test-plan/<slug>.md` 并从门禁集合移出。

## 5. 提交与 PR
- 分支：`feat/<ticket>-<slug>`（实现）、`test/<ticket>-<slug>`（测试）、`fix/<ticket>-<slug>`（修 bug）。
- 提交信息：`fork(<area>): <动词> <结果>`，`area` ∈ `ipc|db|renderer|shared|tools|ci|test`。
  例：`fork(ipc): retry chat send with backoff on transient failure`。
- 一个提交一件事；不把格式化、重命名、功能混在一起（rebase 时会被上游改动放大成冲突）。
- PR 正文四段：**改了什么 / 为什么必须在这一层（L0→L1→L2 的推理）/ Evidence（命令输出 + CI 链接）/ 哪部分只能靠 e2e 或真机验证**。
- ⛔ 不推 `fork`、不打 tag、不 `--force` 推别人的分支、不 `--no-verify`。

## 6. 错误处理与日志（fork 代码里最简单的三条）
- 主进程：fork 的入口函数（`initFork`、`registerForkHandlers`、`applyForkMigrations`）内部 catch 全部异常并 `console.error("[fork] ...", e)`，**绝不让 fork 的失败冒泡成上游启动失败**。
- 渲染层：fork 组件出错要有本地兜底 UI（不整页白屏）；IPC 失败必须有可见反馈，不能静默。
- 所有 fork 日志带 `[fork]` 前缀，便于在真机冒烟时一眼分辨问题来源。
