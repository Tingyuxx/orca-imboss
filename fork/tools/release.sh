#!/usr/bin/env bash
# 发一个 fork 版本：算 tag → 打 tag → 推 tag → CI 打包并发布到自己的 GitHub Release。
#
# 用法：
#   bash fork/tools/release.sh              # 打 tag 并推送，触发 fork-release workflow
#   bash fork/tools/release.sh --dry-run    # 只算/校验，不动 git
#
# tag 格式：v<官方版本>-fork.<YYYYMMDD>.<当日序号>
#   例：v1.24.0-fork.20251120.1
# 为什么是这个形状（老板要的「官方版本号 + 发布日期」保留在 tag 里）：
#   * 必须是**合法 semver** —— electron-updater 的 GitHub provider 会跳过非法 semver 的
#     tag（`if (!semver.valid(hrefTag)) continue;`），`fork-v1.24.0-...` 这种前缀会让
#     自动更新彻底失效；
#   * 预发布标识 `fork` 同时决定了更新通道（`fork.yml`）和 allowPrerelease 的自动开启；
#   * 日期 + 序号保证单调递增（同一天发两次就是 .1/.2）。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

fail() { printf '\033[31m✗\033[0m %s\n' "$1"; exit 1; }
info() { printf '\033[36m→\033[0m %s\n' "$1"; }

BRANCH=$(node -e 'process.stdout.write(require("./fork.config.json").forkBranch)')
PRERELEASE_ID=$(node -e 'process.stdout.write(require("./fork.config.json").prereleaseId)')
TAG_PREFIX=$(node -e 'process.stdout.write(require("./fork.config.json").tagPrefix)')

[ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ] || fail "请先切到 $BRANCH 分支（当前 $(git rev-parse --abbrev-ref HEAD)）"
[ -z "$(git status --porcelain)" ] || fail "工作区不干净，先 commit"

BASE=$(node -e 'process.stdout.write(require("./package.json").version)')
COMMIT=$(git rev-parse --short=8 HEAD)
DATE=$(date -u +%Y%m%d)

# 当日序号：本地 + 远端已有的同 base 同日期 tag 都算上（换机器也不会撞号）
LOCAL_COUNT=$(git tag --list "${TAG_PREFIX}${BASE}-${PRERELEASE_ID}.${DATE}.*" | wc -l | tr -d ' ')
REMOTE_TAGS=$(git ls-remote --tags origin "${TAG_PREFIX}${BASE}-${PRERELEASE_ID}.${DATE}.*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$REMOTE_TAGS" = "0" ]; then
  info "远端 tag 查询为空或失败，只按本地计数（$LOCAL_COUNT）"
fi
N=$((LOCAL_COUNT + REMOTE_TAGS + 1))
TAG="${TAG_PREFIX}${BASE}-${PRERELEASE_ID}.${DATE}.${N}"

info "官方基线：${BASE} (${COMMIT})"
info "本次 tag：${TAG}"

node fork/tools/set-version.mjs --from-tag "$TAG" --strict-base --check || fail "版本号校验失败"
node fork/tools/gen-builder-config.mjs --check || fail "打包配置校验失败"
bash fork/tools/check-integration.sh >/dev/null || fail "骨架自检未通过，先跑 bash fork/tools/check-integration.sh 看详情"

if [ "$DRY_RUN" = "1" ]; then
  info "--dry-run：不创建/推送 tag"
  exit 0
fi

git tag -a "$TAG" -m "fork release ${TAG}" -m "upstream base: ${BASE} (${COMMIT})"
git push origin "$TAG" || fail "推送 tag 失败"
info "已推送 ${TAG}。CI 会依次做：set-version → build → electron-builder（发布到本仓 Release）"
echo "    看进度：gh run watch \$(gh run list --workflow=fork-release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
echo "    或直接打开 Actions 页面：fork-release workflow"
