# fork/specs — 工作项载体

一个功能一个 slug 目录。目录名用小写 kebab-case，不带日期（日期进文件内的元信息）。

```
fork/specs/<slug>/
  spec.md                 ← Ada 写；含「挂载方案」小节
  tickets/01-<slug>.md    ← Ada 写；Rune/Nova 认领
```

配套产物在别处（不是这里）：

| 产物 | 路径 | 谁写 |
| --- | --- | --- |
| 评审报告 | `fork/reviews/<slug>-<YYYYMMDD>.md` | Vera |
| 单测 | `fork/tests/<module>.test.ts` | Tess / Rune |
| e2e | `fork/e2e/<flow>.spec.ts` | Tess |
| 回归清单 | `fork/test-plan/<slug>.md` | Tess |
| 架构决策 | `fork/adr/NNNN-<slug>.md` | Ada |
| 流程 retro | `fork/process/retro-<YYYYMMDD>.md` | Mira |
| 挂载点预占 | `fork/mount-claims.md` | **只有 Kai** |

## spec.md 必备小节

Problem Statement / Solution / User Stories / Implementation Decisions / **挂载方案**（层 L0·L1·L2 + 挂载点 ID + 预计行数 + 为什么不用更便宜的层 + 明确不改什么）/ Testing Decisions（含「本机能跑什么」）/ Out of Scope / 验收标准。

`## 挂载方案` 小节末尾留一行给 Kai 的 G0 放行：`G0: approved by Kai @ <YYYY-MM-DD>`。

## ticket 必备字段

```
# <NN>: <标题>
**层 / 挂载点:** L1 - new files under src/main/fork/** (no mount point)
**Blocked by:** 01, 02 | None (can start immediately)
**Status:** ready | claimed by <名字> @ <YYYY-MM-DD> | in-review | merged | parked
- [ ] 验收项 1
- [ ] 验收项 2
```

Status 只有四种合法迁移：`ready → claimed → in-review → merged`；失败回 `ready`（附一行原因）或 `parked`（附恢复条件）。**只有 Kai 能写 `merged`。**

一 ticket ≤ 1 个挂载点；要第二个就拆 ticket。

## 权威文档

流程细节以 `fork/WORKFLOW.md` 为准（唯一权威版本），代码规矩以 `fork/CODING-STANDARDS.md` 为准。
本 README 只是目录索引，冲突时以那两份为准。
