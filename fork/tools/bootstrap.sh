#!/usr/bin/env bash
# 在一个**新克隆**里恢复 fork 的工作环境（老板换机器 / 重装 / 清理后重建都用这个）。
#
# 用法（新克隆目录里）：bash fork/tools/bootstrap.sh
#
# 做的事：
#   1. 校验 origin 指向 fork 自己的仓（fork.config.json 里的 owner/repo）；
#   2. 补上 upstream（官方仓）remote 并抓取 tag —— fork 的 rebase 基准全靠它；
#   3. 打开 rerere（冲突解法复用），切到 fork 主线；
#   4. 打印当前状态。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

info() { printf '\033[36m→\033[0m %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fail() { printf '\033[31m✗\033[0m %s\n' "$1"; exit 1; }

# 新克隆默认落在 main（= 官方镜像），此时还没有 fork.config.json：先切到 fork 分支。
if [ ! -f fork.config.json ]; then
  info "当前分支没有 fork.config.json（默认落在官方镜像分支），先切到 fork"
  git switch fork || fail "切不到 fork 分支，检查 origin 是否指向 ${OWNER:-fork 自己的仓}"
fi

OWNER=$(node -e 'process.stdout.write(require("./fork.config.json").owner)')
REPO=$(node -e 'process.stdout.write(require("./fork.config.json").repo)')
UP_OWNER=$(node -e 'process.stdout.write(require("./fork.config.json").upstream.owner)')
UP_REPO=$(node -e 'process.stdout.write(require("./fork.config.json").upstream.repo)')
BRANCH=$(node -e 'process.stdout.write(require("./fork.config.json").forkBranch)')

ORIGIN=$(git remote get-url origin 2>/dev/null || true)
case "$ORIGIN" in
  *"${OWNER}/${REPO}"*) ok "origin = $ORIGIN" ;;
  "") fail "没有 origin remote" ;;
  *) fail "origin 指向 $ORIGIN，与 fork.config.json (${OWNER}/${REPO}) 不一致" ;;
esac

if git remote get-url upstream >/dev/null 2>&1; then
  ok "upstream 已存在：$(git remote get-url upstream)"
else
  info "添加 upstream = https://github.com/${UP_OWNER}/${UP_REPO}.git"
  git remote add upstream "https://github.com/${UP_OWNER}/${UP_REPO}.git"
fi

info "抓取官方 tag"
git fetch upstream --tags --prune || fail "fetch upstream 失败"
ok "官方 tag 数量：$(git tag --list 'v[0-9]*' | wc -l | tr -d ' ')"

git config rerere.enabled true
git config rerere.autoupdate true
ok "rerere 已开启"

git switch "$BRANCH" 2>/dev/null || git switch -c "$BRANCH" "origin/$BRANCH"
ok "当前分支：$(git rev-parse --abbrev-ref HEAD)"

echo
info "状态："
git log --oneline -5 | sed 's/^/    /'
echo "    上游基线：$(node -e 'process.stdout.write(require("./fork/upstream-base.json").baseTag)')"
echo "    fork tag：$(git tag --list "v*-$(node -e 'process.stdout.write(require("./fork.config.json").prereleaseId)').*" | tail -3 | tr '\n' ' ')"

echo
info "下一步（本地没有 MSVC，只能做静态检查）："
echo "    bash fork/tools/check-integration.sh"
echo "    node fork/tools/gen-builder-config.mjs --check"
echo "    需要跑 build/e2e/打包 → 推到 GitHub 让 CI 跑（fork-ci workflow）"
