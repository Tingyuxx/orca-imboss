#!/usr/bin/env bash
# 跟上游同步：把 fork 主线 rebase 到新的官方 tag 上。
#
# 用法：
#   bash fork/tools/sync-upstream.sh --check              # 只看上游有没有新版本
#   bash fork/tools/sync-upstream.sh v1.25.0              # 在 sync/<tag> 分支上 rebase 并自检
#   bash fork/tools/sync-upstream.sh --finalize v1.25.0   # 记录新基线（amend 同一条 commit，永不累积冲突）
#
# 设计要点：
# - fork 主线保持线性：我们的提交永远排在最新官方 tag 之上（见 fork/RUNBOOK.md）；
# - rebase 在临时分支 sync/<tag> 上做，出问题直接 git switch fork 回滚；
# - 每次同步只改 fork/upstream-base.json 这一个自有文件的**同一条 commit**（--amend），
#   所以不会出现「上次的基线记录」和「这次的基线记录」互相冲突。
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

BASE_RECORD_SUBJECT="chore(fork): record upstream base"
FAIL=0
info() { printf '\033[36m→\033[0m %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=1; }

base_tag() { node -e 'process.stdout.write(require("./fork/upstream-base.json").baseTag)'; }

fetch_upstream() {
  info "git fetch upstream --tags --prune"
  git fetch upstream --tags --prune || { bad "fetch 失败：检查 remote upstream 是否指 https://github.com/sethyuan/orca-imboss.git"; exit 1; }
}

case "${1:-}" in
  --check|"")
    fetch_upstream
    BASE=$(base_tag)
    info "当前 fork 基线：$BASE ($(node -e 'process.stdout.write(require("./fork/upstream-base.json").baseCommit.slice(0,7))'))"
    NEW=$(git tag --list 'v*' --no-merged "$BASE" --sort=creatordate)
    if [ -z "$NEW" ]; then
      ok "上游没有比 $BASE 更新的 tag，无需同步"
    else
      echo "上游新 tag："
      echo "$NEW" | sed 's/^/    /'
      NEWEST=$(echo "$NEW" | tail -1)
      echo
      echo "自 $BASE 起的上游改动（$NEWEST）："
      git log --oneline "$BASE..$NEWEST" | sed 's/^/    /' | head -40
      echo
      info "下一步：bash fork/tools/sync-upstream.sh $NEWEST"
    fi
    echo
    info "fork 自己的提交（相对 $BASE）："
    git log --oneline "$BASE..fork" | sed 's/^/    /'
    exit "$FAIL"
    ;;

  --finalize)
    TAG="${2:-}"
    [ -n "$TAG" ] || { bad "用法：--finalize <官方 tag>"; exit 1; }
    git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { bad "本地没有 tag $TAG（先 git fetch upstream --tags）"; exit 1; }
    COMMIT=$(git rev-parse "$TAG^{commit}")
    CURRENT=$(git rev-parse --abbrev-ref HEAD)
    [ "$CURRENT" = "fork" ] || { bad "请先切到 fork 分支（当前 $CURRENT）"; exit 1; }

    node -e '
      const fs = require("fs");
      const p = "fork/upstream-base.json";
      const next = {
        baseTag: process.argv[1],
        baseCommit: process.argv[2],
        syncedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
        note: "由 sync-upstream.sh --finalize 维护：记录本 fork 上次 rebase 到的上游 tag/commit",
      };
      fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
    ' "$TAG" "$COMMIT"

    git add fork/upstream-base.json
    if git log -1 --format=%s | grep -q "^${BASE_RECORD_SUBJECT}"; then
      git commit --amend --no-edit -q
      ok "已 amend 基线记录 commit"
    else
      git commit -q -m "${BASE_RECORD_SUBJECT} ${TAG}"
      ok "已新建基线记录 commit"
    fi

    PKG_VER=$(node -e 'process.stdout.write(require("./package.json").version)')
    TAG_VER=${TAG#v}
    if [ "$PKG_VER" = "$TAG_VER" ]; then
      ok "package.json version 与 tag 一致：$PKG_VER"
    else
      bad "package.json version ($PKG_VER) 与 tag ($TAG) 不一致：上游这次没改版本号？确认后再发布"
    fi

    bash fork/tools/check-integration.sh || FAIL=1
    echo
    info "本地无法打包（没有 MSVC），下一步：git push origin fork 让 CI 跑 typecheck/build"
    exit "$FAIL"
    ;;

  -*)
    bad "未知参数 $1"; exit 1
    ;;

  *)
    TAG="$1"
    fetch_upstream
    git rev-parse -q --verify "refs/tags/$TAG" >/dev/null || { bad "本地没有 tag $TAG"; exit 1; }
    [ -z "$(git status --porcelain)" ] || { bad "工作区不干净，先 commit 或 stash"; exit 1; }

    BRANCH="sync/$TAG"
    if git rev-parse -q --verify "refs/heads/$BRANCH" >/dev/null; then
      info "复用已存在的 $BRANCH"
      git switch "$BRANCH" || exit 1
      git rebase "$TAG" || {
        bad "rebase 冲突：解冲突后 git add <文件> && git rebase --continue"
        echo "    （rerere 已开启，同样冲突下次会自动复用解法：git rerere status）"
        exit 1
      }
    else
      info "git switch -c $BRANCH fork && git rebase $TAG"
      git switch -c "$BRANCH" fork || exit 1
      git rebase "$TAG" || {
        bad "rebase 冲突"
        echo "    解冲突后：git add <文件> && git rebase --continue"
        echo "    放弃这次同步：git rebase --abort && git switch fork && git branch -D $BRANCH"
        exit 1
      }
    fi

    info "rebase 完成，跑骨架自检"
    bash fork/tools/check-integration.sh || FAIL=1

    if [ -d node_modules/.bin ] && [ -x node_modules/.bin/tsc ]; then
      info "本机有可用的 node_modules，跑类型检查（不需要 MSVC）"
      if node_modules/.bin/tsc --noEmit -p tsconfig.node.json --composite false \
         && node_modules/.bin/tsc --noEmit -p tsconfig.web.json --composite false; then
        ok "typecheck 通过"
      else
        bad "typecheck 失败：上游动了我们挂载的文件，先修挂载点"
      fi
    else
      info "本机没有 node_modules，跳过 typecheck（交给 CI：fork-ci workflow）"
    fi

    [ "$FAIL" -eq 0 ] || { echo; bad "自检未通过，先修完再 git switch fork && git merge --ff-only $BRANCH"; exit 1; }

    echo
    info "自检通过。收尾："
    echo "    git switch fork && git merge --ff-only $BRANCH"
    echo "    bash fork/tools/sync-upstream.sh --finalize $TAG"
    exit 0
    ;;
esac
