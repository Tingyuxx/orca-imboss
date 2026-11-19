# 挂载点台账（fork/mount-claims.md）

上游文件里每一处 `// FORK-MOUNT:Mx` 改动，都必须在建 worktree 的**同一次动作**里在这里占一行。
挂载点是什么、为什么选这些点，见 `fork/integration-points.md`。

## 规则（硬性）

1. **只有 Kai 写这个文件。** 别人要占挂载点，发消息请 Kai 落；两个实现员同时改这个文件必然冲突。
2. **同一挂载点同一时刻只能有一行 `claimed`。** 第二个 ticket 撞上来时按 `fork/WORKFLOW.md` §4.2 处理：① 等（写进 ticket `Blocked by`）→ ② 改成 L1（逻辑挪进 `src/**/fork/**`）→ ③ 由 Kai 决定合并两个 ticket。**绝不**为了绕开争用去新开挂载点。
3. **合并后立刻置 `released` 并填释放日期**：`git log fork --oneline -1` 是那次 squash 提交，`check-integration.sh` 在 `fork` 上绿。
4. **台账只增不删。** 历史行就是「谁在什么时候动过这个挂载点」的证据；功能被回滚也要留着，状态改成 `released` 并在备注里写原因。
5. 状态只有 `claimed` / `released` 两个值。
6. 校验（`verify` job 每次都会跑第 1、2 条）：
   ```
   bash fork/tools/check-integration.sh      # == 8. 挂载点台账 ==
   ```

## 台账

| 挂载点 | 上游文件 | ticket | owner | 状态 | 起 | 释 |
| --- | --- | --- | --- | --- | --- | --- |

<!-- 空表 = 当前没有任何挂载点被占用。

新增一行的写法（空格对齐随你，列顺序必须是：挂载点 / 上游文件 / ticket / owner / 状态 / 起 / 释）：

    M1 · src/main/ipc/index.ts · t03 · Rune · claimed · 2026-11-19 · -
    M3 · src/renderer/App.tsx    · t04 · Nova · released · 2026-11-18 · 2026-11-20

上面两行用 · 分隔只是为了不被 check-integration.sh 当成真实台账行；真行要用竖线围起来。
-->
