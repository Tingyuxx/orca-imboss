#!/usr/bin/env bash
# fork 骨架自检：每次 rebase 上游之后、每次改动挂载点之后跑一遍。
# 不依赖 node_modules（本机装不全也能跑），只用 git + node 内建模块。
#
# 用法： bash fork/tools/check-integration.sh        （在仓库任意位置执行均可）
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

FAIL=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }

echo "== 1. fork 自有文件 =="
for f in fork.config.json electron-builder.fork.yml fork/upstream-base.json \
         src/shared/fork/flags.ts src/shared/fork/types.ts \
         src/shared/fork/translations/zhCN.json \
         src/main/fork/index.ts src/main/fork/migrations.ts \
         src/main/ipc/fork.ts src/preload/fork.ts \
         fork/tools/gen-builder-config.mjs fork/tools/set-version.mjs \
         fork/tools/sync-upstream.sh fork/tools/release.sh \
         fork/integration-points.md fork/RUNBOOK.md; do
  [ -f "$f" ] && ok "$f" || bad "缺失 $f"
done

echo "== 2. 上游文件里的挂载点（每一处都必须是 FORK-MOUNT 标记行）=="
# 文件:期望出现次数
MOUNTS="
src/main/ipc/index.ts:2
src/preload/index.ts:2
src/main/locale.ts:2
src/renderer/locale.ts:2
src/shared/types/index.ts:1
src/main/db/index.ts:2
src/main/index.ts:2
"
for entry in $MOUNTS; do
  file="${entry%%:*}"
  want="${entry##*:}"
  if [ ! -f "$file" ]; then bad "缺失上游文件 $file"; continue; fi
  got=$(grep -c "FORK-MOUNT:" "$file" || true)
  if [ "$got" = "$want" ]; then ok "$file ($got 处标记)"; else bad "$file 期望 $want 处 FORK-MOUNT 标记，实际 $got"; fi
done

echo "== 3. 挂载面积（改上游文件的行数预算）=="
BASE_TAG=$(node -e 'console.log(require("./fork/upstream-base.json").baseTag)')
if git rev-parse -q --verify "refs/tags/$BASE_TAG" >/dev/null; then
  FILES="src/main/ipc/index.ts src/preload/index.ts src/main/locale.ts src/renderer/locale.ts src/shared/types/index.ts src/main/db/index.ts src/main/index.ts .gitignore"
  # 用工作区 vs tag 的 diff：未提交也能查出挂载面积漂移
  # shellcheck disable=SC2086
  STATS=$(git diff --numstat "$BASE_TAG" -- $FILES | awk '{a+=$1; d+=$2} END {printf "%d %d", a+0, d+0}')
  ADD=${STATS%% *}; DEL=${STATS##* }
  TOTAL=$((ADD + DEL))
  BUDGET=40
  if [ "$TOTAL" -le "$BUDGET" ]; then
    ok "相对 $BASE_TAG 在挂载文件里共改动 $TOTAL 行（预算 $BUDGET）: +$ADD/-$DEL"
  else
    bad "相对 $BASE_TAG 在挂载文件里改了 $TOTAL 行，超过预算 $BUDGET：说明有逻辑写进了上游文件，请挪进 src/fork 或对应 fork 模块"
  fi
  if git diff --numstat "$BASE_TAG" -- src/shared/translations/zhCN.json | grep -q .; then
    bad "禁改文件 src/shared/translations/zhCN.json 被改动了（词条请放 src/shared/fork/translations/zhCN.json）"
  else
    ok "src/shared/translations/zhCN.json 未被改动"
  fi
else
  warn "本地没有 $BASE_TAG 这个 tag，跳过挂载面积检查（先 git fetch upstream --tags）"
fi

echo "== 4. 打包/发布配置 =="
if node fork/tools/gen-builder-config.mjs --check; then :; else bad "gen-builder-config.mjs --check 失败"; fi

echo "== 5. 版本一致性（package.json vs 上游基线）=="
node -e '
const pkg = require("./package.json");
const base = require("./fork/upstream-base.json");
const want = base.baseTag.replace(/^v/, "");
if (pkg.version === want) {
  console.log(`  ✓ package.json version ${pkg.version} == 上游基线 ${base.baseTag}`);
} else if (pkg.version.startsWith(want + "-")) {
  console.log(`  ✓ package.json version ${pkg.version} 基于上游基线 ${base.baseTag}（发布时的临时版本号，正常）`);
} else {
  console.error(`  ✗ package.json version ${pkg.version} 与上游基线 ${base.baseTag} 不一致：同步完上游后要跑 sync-upstream.sh --finalize <tag>`);
  process.exit(1);
}
' || FAIL=1

echo "== 6. fork 迁移 =="
MIG=$(grep -c 'id: "' src/main/fork/migrations.ts || true)
echo "  · FORK_MIGRATIONS 条目数: $MIG（0 条 = 不动数据库，优先保持 0）"

echo "== 7. CI 工作流 =="
for f in .github/workflows/fork-ci.yml .github/workflows/fork-release.yml; do
  [ -f "$f" ] && ok "$f" || bad "缺失 $f"
done
if grep -rnE "(ghp|gho|ghs|ghu|github_pat)_[A-Za-z0-9]{20,}" .github/workflows/ fork/ 2>/dev/null \
     | grep -v "check-integration.sh" | grep -q .; then
  bad "发现疑似硬编码 GitHub token"
else
  ok "没有硬编码 token"
fi

echo
if [ "$FAIL" -eq 0 ]; then
  echo "== 全部通过 =="
  echo "提醒：本机没有 MSVC，pnpm dev / 打包只能在 CI 里验证（见 fork/RUNBOOK.md）。"
else
  echo "== 有检查未通过（见上面 ✗）=="
fi
exit "$FAIL"
