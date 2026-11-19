#!/usr/bin/env bash
# 发一个 fork 版本：算 tag → 打 tag → 推 tag → CI 打包并发布到自己的 GitHub Release。
#
# 用法：
#   bash fork/tools/release.sh              # 打 tag 并推送，触发 fork-release workflow
#   bash fork/tools/release.sh --dry-run    # 只算/校验，不动 git
#
# tag 格式：v<官方版本>-fork.<YYYYMMDD>.<当日序号>
#   例：v1.24.0-fork.20261119.1
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
# 基线 commit 取 fork/upstream-base.json（那是上游 tag 的 commit），不是 HEAD
BASE_COMMIT=$(node -e 'process.stdout.write(require("./fork/upstream-base.json").baseCommit)' 2>/dev/null)
BASE_COMMIT=${BASE_COMMIT:-$(git rev-parse "v${BASE}" 2>/dev/null || echo unknown)}
DATE=$(date -u +%Y%m%d)

# 当日序号：取「本地 + 远端」同 base 同日期 tag 里**最大的序号 + 1**（不是数个数）。
# 注意 ls-remote 对 annotated tag 会多输出一行 "…^{}"（peeled），必须过滤，否则会跳号。
PATTERN="${TAG_PREFIX}${BASE}-${PRERELEASE_ID}.${DATE}.*"
# 抓「最后一节的数字」并取最大值；ls-remote 的每行取第 2 列后同样适用
max_seq() {
  awk '{ n=$NF; sub(/.*\./,"",n); if (n ~ /^[0-9]+$/ && n+0>m) m=n+0 } END { if (m>0) print m }'
}
LOCAL_MAX=$(git tag --list "$PATTERN" | max_seq)
# annotated tag 会多一行 peeled ref（…^{}），必须过滤，否则会跳号
REMOTE_MAX=$(git ls-remote --tags origin "$PATTERN" 2>/tmp/fork-lsremote.err | grep -v "[^{]*\^{}" | awk '{print $2}' | max_seq)
if [ -z "$REMOTE_MAX" ] && [ -s /tmp/fork-lsremote.err ]; then
  info "无法查询远端 tag（$(head -1 /tmp/fork-lsremote.err)），只按本地序号，注意别在多台机器上同时发"
fi
if [ -n "$LOCAL_MAX" ] && [ -n "$REMOTE_MAX" ]; then
  LAST=$(( LOCAL_MAX > REMOTE_MAX ? LOCAL_MAX : REMOTE_MAX ))
else
  LAST=${LOCAL_MAX:-${REMOTE_MAX:-0}}
fi
N=$((LAST + 1))
TAG="${TAG_PREFIX}${BASE}-${PRERELEASE_ID}.${DATE}.${N}"

info "官方基线：${BASE} (${BASE_COMMIT:0:8})"
info "本次 tag：${TAG}（本地最大序号 ${LOCAL_MAX:-无}，远端最大序号 ${REMOTE_MAX:-无}）"

node fork/tools/set-version.mjs --from-tag "$TAG" --strict-base --check || fail "版本号校验失败"
node fork/tools/gen-builder-config.mjs --check || fail "打包配置校验失败"
bash fork/tools/check-integration.sh >/dev/null || fail "骨架自检未通过，先跑 bash fork/tools/check-integration.sh 看详情"

if [ "$DRY_RUN" = "1" ]; then
  info "--dry-run：不创建/推送 tag"
  exit 0
fi

git tag -a "$TAG" -m "fork release ${TAG}" -m "upstream base: ${BASE} (${BASE_COMMIT})"
git push origin "$TAG" || fail "推送 tag 失败"
info "已推送 ${TAG}。CI 会依次做：set-version → build → electron-builder（发布到本仓 Release）"
echo "    看进度：gh run watch \$(gh run list --workflow=fork-release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
echo "    或直接打开 Actions 页面：fork-release workflow"
