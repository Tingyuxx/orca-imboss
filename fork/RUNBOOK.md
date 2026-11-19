# imboss-fork 操作手册（RUNBOOK）

一句话原则：**fork 主线永远等于「最新官方 tag + 我们几十行挂载 + 若干自有目录」**。
所以跟上游同步是日常，改上游文件是例外。

- 自己的仓：`github.com/Tingyuxx/orca-imboss`
- 官方仓（upstream）：`github.com/sethyuan/orca-imboss`
- 主线分支：`fork`（`main` 保持和官方一致，不用来放我们的改动）
- 当前基线：见 `fork/upstream-base.json`（目前 `v1.24.0` / `3aa87fe`）

---

## 1. 远端与分支模型

```
upstream  → https://github.com/sethyuan/orca-imboss.git   （只 fetch，不 push）
origin    → https://github.com/Tingyuxx/orca-imboss.git    （我们自己的仓）
upstream-main  只读镜像，`git fetch upstream && git merge --ff-only upstream/main`
fork           我们的主线：官方 tag 之上叠我们的提交（线性，rebase 维护）
              ← 已是仓库默认分支，新克隆直接落在它上面
sync/<tag>     同步时用的临时分支，出问题就丢
```

新机器 / 重装后恢复环境（3 步）：

```bash
git clone https://github.com/Tingyuxx/orca-imboss.git
cd orca-imboss
bash fork/tools/bootstrap.sh     # 补 upstream remote + 抓 27 个官方 tag + 开 rerere + 确认分支
```

常用命令：

```bash
git fetch upstream --tags --prune        # 抓官方新版本
git log --oneline upstream/main -10      # 官方最近在改什么
git diff --stat v1.24.0 fork -- src/     # 我们的改动有多大（应该很小）
```

## 2. 本机能做什么（Windows + 无 MSVC，本机实测）

| 操作 | 状态 | 说明 |
| --- | --- | --- |
| `bash fork/tools/*.sh`、`node fork/tools/*.mjs` | ✅ | 只用 git + node 内建模块，任何机器都能跑 |
| `pnpm install --ignore-scripts --frozen-lockfile` | ✅ | 约 17 秒，只装依赖不跑原生编译（见第 9 节） |
| `pnpm typecheck` | ✅ | node/web/e2e 三份 tsconfig 全过 |
| `pnpm build`（typecheck + electron-vite build） | ✅ | 产出 `out/main`、`out/preload`、`out/renderer`（约 6 MB），已验证 fork 代码进了产物（`out/main/index.js` 里有 `fork:info`） |
| `pnpm dev` | ❌ | 需要 better-sqlite3 的 Electron ABI 二进制，必须 MSVC 现编 |
| `pnpm test:e2e` | ❌ | 同上 + 需要 electron 二进制 |
| `electron-builder --win`（打包） | ❌ | 需要原生模块重建 → 交给 CI |

**结论：本机可以写代码 + typecheck + build；`dev`/`e2e`/打包交给 GitHub Actions（`windows-latest` 自带 VS）。**

## 3. 跟上游同步（官方 2–3 天发一版，这是日常动作）

```bash
bash fork/tools/sync-upstream.sh --check     # 1. 看有没有新版本、新 tag、官方改了什么
bash fork/tools/sync-upstream.sh v1.25.0     # 2. 在 sync/v1.25.0 上 rebase 并自动自检
#    自检通过后：
git switch fork && git merge --ff-only sync/v1.25.0
bash fork/tools/sync-upstream.sh --finalize v1.25.0   # 3. 记录新基线（amend 同一条 commit）
git push origin fork
```

- rebase 冲突时：`git add <文件> && git rebase --continue`；放弃：`git rebase --abort && git switch fork && git branch -D sync/<tag>`。
- `rerere` 已开（`git config rerere.enabled true`），同样的冲突下次自动套用上次的解法。
- **判断「上游改动是否破坏我们的功能」的三道闸**（对应方案文档 6.2 节）：
  1. `check-integration.sh`：挂载点标记是否还在、挂载面积是否超预算（>40 行就说明有人把逻辑写进上游文件了）；
  2. `pnpm typecheck` / CI 的 `pnpm build`：类型与打包层面是否被上游改坏（挂载点漂移在这里暴露）；
  3. 冒烟清单（第 7 节）：行为层面是否被改坏。
- 上游实现了我们的功能 → 直接 `git rebase -i` 丢掉我们对应的提交，少一处维护。

## 4. 发一个 fork 版本

```bash
bash fork/tools/release.sh             # 算 tag → 打 tag → 推 tag → CI 打包并发布
bash fork/tools/release.sh --dry-run   # 只看会打什么 tag
```

人工步骤为零：CI（`.github/workflows/fork-release.yml`）会做
`set-version → gen-builder-config → check-integration → pnpm build → electron-builder --publish always`，
产物传到本仓 Release，用户的自动更新从那里拉。

发布后 CI 还会自己做两道确认（不需要人盯着）：

1. **补传 `.blockmap`**：electron-builder 有时只在日志里打印 `uploading …blockmap`，release 上其实没有（实测 404）。
   缺它不影响能不能更新，但会让每次更新退化成完整 142MB 下载，所以 workflow 里显式 `gh release upload --clobber`。
2. **校验发布物**：下载 release 上的 `latest.yml`，断言 `version` = tag 版本，再用
   `fork/tools/check-update-logic.mjs --self-check` 跑**真实的 `isUpdateAvailable`**：
   前一日版本可升级、同版本不升级、后一日版本不降级。本地想复现就下载那个 yml 再跑同一条命令。

**版本号 / tag 规则（唯一一套，脚本和 CI 都按这个来）**

| 项 | 格式 | 例 |
| --- | --- | --- |
| tag | `v<官方版本>-fork.<YYYYMMDD>.<当日序号>` | `v1.24.0-fork.20261119.1` |
| package.json version（CI 临时改，不提交） | `<官方版本>-fork.<YYYYMMDD>.<当日序号>` | `1.24.0-fork.20261119.1` |
| 安装包文件名 | `orca-imboss-fork-<version>.exe` | `orca-imboss-fork-1.24.0-fork.20261119.1.exe` |

为什么必须长这样（源码依据，方案文档 7.2 节有完整推导）：

1. **tag 必须是合法 semver**：electron-updater 的 GitHub provider 遍历 releases atom 时
   `if (!semver.valid(hrefTag)) continue;` —— `fork-v1.24.0-...` 这种前缀会被全部跳过，
   结果是「永远没有可用更新」（`No published versions on GitHub`）。
2. **必须是预发布（prerelease）后缀 `<base>-fork.<...>`**：
   - `AppUpdater` 构造时 `this.allowPrerelease = hasPrereleaseComponents(currentVersion)`
     → 我们的版本自动开启预发布通道，不用改上游代码；
   - 通道名取自预发布标识 → 通道 = `fork`；
   - 而 electron-builder 生成更新信息文件时 `channel = publishConfig.channel || "latest"`
     → 实际产出 `latest.yml`。客户端会先按通道要 `fork.yml`（404）再**自动回退**到
     `latest.yml`（`GitHubProvider.getLatestVersion` 的 fallback 分支），功能正常，
     代价是每次检查多一个 404 请求。想消掉它就把 `publish.channel` 设成 `fork`，
     但那样**版本号必须永远带 `-fork.` 后缀**，否则客户端会去找 `latest.yml` 而找不到。当前选择「不设 channel」，容错更大。
3. **日期 + 序号保证单调递增**：`1.24.0-fork.20261119.1 < 1.24.0-fork.20261119.2 < 1.24.0-fork.20261120.1`（semver：先比 base，再逐段比预发布标识，数字段按数值比）。
4. **GitHub Release 不用勾 pre-release**：模板里 `releaseType: release`
   （`electron-publish/out/gitHubPublisher.js`：`prerelease: this.releaseType === "prerelease"`）。
   这样 GitHub 页面是正式 release，provider 不用担心被过滤。
5. **tag 不需要手工打**：electron-builder 自己按 `v` + version 建 tag
   （`this.tag = githubTagPrefix(info) + version`），所以 tag 和版本号不会脱钩。

已知约束（重要）：

- 基础版本号决定「跨天」的先后：**不要用旧 base 发比已装版本更新的日期**，
  比如已装 `1.25.0-fork.20261120.1`，再用 base 1.24.0 发 `1.24.0-fork.20251125.1` —— semver 更小，不会被当成升级。
- `1.24.0-fork.x < 1.24.0`：fork 版本在 semver 上低于同号官方版。所以官方安装包
  **不能**装到同一台机器上当升级（也会因为 appId/产品名不同而并存，见第 7 节）。

## 5. 自动更新

- 更新源写死在安装包的 `resources/app-update.yml`，由 `electron-builder.fork.yml` 的 `publish` 生成，指向**我们自己的仓**。
- 绝不能让它指回 `sethyuan/orca-imboss`：那样「检查更新」会把官方版装上来，覆盖 fork。
  防呆：`src/main/fork/index.ts` 的 `initFork()` 在启动时读 `app-update.yml` 并比对 `fork.config.json`，
  不一致就在主进程日志打 `[fork] 更新源指向 …`；`window.imb.fork.info()` 里也有 `updateFeedOk` 字段。
- 上游的更新器策略照旧：`autoDownload=false`、`autoInstallOnAppQuit=false`，用户点「下载 / 安装」才动。
- 开发期（`pnpm dev`）没有 `app-update.yml`，会用仓库里的 `dev-app-update.yml`（指向官方）。
  只是「手动检查更新」会查到官方版本，**不要点安装**；dev 里装不上。

## 6. CI 两个 workflow

| workflow | 触发 | 干什么 |
| --- | --- | --- |
| `fork-ci.yml`（job `verify`，快闸门） | push 到 `fork`、PR、手动 | `pnpm install` → 抓官方 tag → `check-integration.sh` → `pnpm build`（含 typecheck），约 2 分钟 |
| `fork-ci.yml`（job `e2e`，参考信号） | 同上，与 `verify` **并行** | 95 个 Playwright 用例串行跑（真实 Electron）；25 分钟上限，`continue-on-error`，失败也会留 Playwright 报告 artifact |
| `fork-release.yml` | 推 `v*-fork.*` tag 或手动填 version | `set-version` → `gen-builder-config` → 自检 → `pnpm build` → `electron-builder --publish always` → 上传安装包 artifact |

### 6.1 必须知道：上游的 `release.yml` 在仓库里要**禁用**

上游自带的 `.github/workflows/release.yml` 触发条件是 `push tag v*`。我们的 fork tag 也匹配 `v*`，
所以推一个 fork tag 会**同时**触发两个工作流：除了我们的 `fork-release`，上游那个也会跑一遍
（4 个平台，用**官方** `electron-builder.yml` 配置），最后把官方 branded 的安装包发到我们的 Release。
第一次试验就真实撞上了（run 被手动 cancel）。

处理方式：**不改文件，直接禁用那个工作流**（禁用状态绑定在文件路径上，上游日后改内容也保持禁用）：

```bash
gh workflow list --all                       # 应有 Release → disabled_manually
gh workflow disable "Release" --repo Tingyuxx/orca-imboss   # 万一被重新启用就跑这句
```

新的仓库 / 重新 fork 时必须重新做一次。

- 凭据只用 `GITHUB_TOKEN`（workflow 里 `permissions: contents: write`），**不需要任何自定义 secret**，也不要把 token 写进文件。
- e2e 为什么单独一个 job 且暂时不挡合并：95 个用例串行、首次运行超过 13 分钟（run 44480057467）。
  `verify` 已经覆盖 typecheck + build + 骨架自检，足够判断「这次改动有没有把 fork 弄坏」；
  等 e2e 拿到一次完整通过、并把耗时摸清，再把 `e2e` job 的 `continue-on-error` 去掉（第 11 节有记录）。

## 7. 与官方版并存 / 数据目录（当前策略：**共用**）

### 7.1 共存
`appId`/`productName`/可执行文件都改过（`com.orcastudio.imboss.fork` / `imboss-fork` / `orca-imboss-fork`），
所以 fork 版和官方版可以同时装在一台机器，安装/卸载互不影响。

### 7.2 数据目录：两者共用 `~/.imboss`（已定）

事实依据：`src/main/data-dir.ts` 的 `getDataRoot()` 返回 `join(homedir(), ".imboss")`，
**和产品名/appId 无关**。所以：

- **fork 版读写的就是老板现有的那份数据** —— 员工、会话、设置、头像、已装技能、MCP 配置全部接得上，不用迁移。
- 现有实际内容（同一个 hook 里定义的路径）：
  | 路径 | 内容 |
  | --- | --- |
  | `~/.imboss/db/imboss.db` (WAL) | 全部业务数据 |
  | `~/.imboss/agent/skills/` | 用户/AI 自己装的技能 |
  | `~/.imboss/agent/mcp.json` | MCP server 配置 |
  | `~/.imboss/agent/auth.json` (0600) | 模型provider 凭据 |
  | `~/.imboss/agent/models.json` / `models-store.json` | 自定义模型 |
  | `~/.imboss/agent/sessions/` | agent 会话文件 |
  | `~/.imboss/agent/builtin-skills/` | 随代码分发的内置技能（会被覆盖，不要手改） |
  | `~/.imboss/mini-apps/<id>/metadata.json` | Mini App |
  | `~/.imboss/avatars/`、`attachments/`、`integrations/` | 头像、粘贴附件、IM 媒体 |
- **如果官方版还留着**：它会看到**同一份数据**（同一个 DB、同一批技能/MCP）。两版同时开同一个 DB 属于 SQLite 多进程读写（WAL 能撑，但不建议同时发消息）。
- **将来要卸官方版**：直接卸，数据不会丢（数据不在安装目录）。
- **万一以后要隔离**：两个办法，优先级从高到低
  1. 启动前设 `IMBOSS_DATA_ROOT`（每次调用都会读，不需要改代码）：
     ```powershell
     $env:IMBOSS_DATA_ROOT="$env:USERPROFILE\.imboss-fork"; & "C:\Path\to\orca-imboss-fork.exe"
     ```
     注意：`~/.agents/skills`（跨工具共享的只读技能目录）是 home 级的，**不会**跟着 `IMBOSS_DATA_ROOT` 走。
  2. 真要默认就隔离，可以在 `src/main/fork/index.ts` 里调 `process.env["IMBOSS_DATA_ROOT"] ||= ...`（必须在任何 `getDataRoot()` 调用前，即 `initFork()` 位置要提到最早）——但这会**丢掉现有配置**接入，所以不是当前选择。

### 7.3 DB 结构纪律（不变）
fork 默认**不改数据库结构**（`FORK_MIGRATIONS = []`，迁移函数直接 return）。
真要加表只能加在 `src/main/fork/migrations.ts`（`fork_` 前缀 + `fork_migrations` 记账表），
**绝不能**动 `src/main/db/migrations.ts` 的 `user_version` —— 那会让官方版跳过它自己的迁移。

## 8. 冒烟清单（每次同步 / 每次发版后，5 分钟）

1. 启动，进得了主界面，聊天列表能加载（DB 正常）。
2. `window.imb.fork.info()` 有返回，`updateFeedOk` 为 `true`；主进程日志无 `[fork] 更新源指向`。
3. 「检查更新」能连上自己的 Release（首个版本发布后可验证：装上旧版 → 检查 → 应提示新版）。
4. 中文界面正常（M5 合并没把词条搞坏）。
5. 设置里改语言、切换主题，重启后仍生效。
6. 官方功能抽查：新建会话发一条消息；打开一个 mini app；跑一个 cron 任务。

## 9. 本机无 MSVC 的装法（只为 typecheck）

```bash
pnpm install --ignore-scripts --frozen-lockfile   # 跳过原生编译/electron 下载
pnpm typecheck                                    # 可以跑
```

要真的 `pnpm dev`，必须先装 C++ 工具链（约 3–6 GB）：

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --quiet --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
node node_modules/electron/install.js             # 下载 electron 二进制（allowBuilds 里没放行 electron）
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
```

## 10. 排错

| 现象 | 原因 / 处理 |
| --- | --- |
| `Error: Could not find any Visual Studio installation to use` | 本机缺 MSVC：见第 9 节，或直接用 CI |
| `prebuild-install warn install No prebuilt binaries found (target=44.0.0 runtime=electron arch=x64)` | better-sqlite3 没有 Electron 44 的预编包，必须现编（→ MSVC） |
| `check-integration.sh` 报「挂载面积超预算」 | 有人把逻辑写进上游文件了，挪进 `src/fork`/`src/main/fork`，上游文件只留标记行 |
| `check-integration.sh` 报「zhCN.json 被改动」 | 词条要写到 `src/shared/fork/translations/zhCN.json` |
| `sync-upstream.sh` 报「package.json version 与 tag 不一致」 | 官方这次没在 tag 里改版本号：确认后再 `--finalize`，别硬发 |
| 检查更新报 `Cannot find latest.yml` | 发布时没走 `fork-release.yml`（没生成更新信息文件），检查是否用了 `dist:win` 而不是 `--config .electron-builder.fork.gen.yml` |
| 装了 fork 版却提示「发现官方新版本」 | `publish` 又指回官方了，检查 `fork.config.json` 与 `gen-builder-config` 的输出 |

## 11. 首个版本（`v1.24.0-fork.20261119.1`）实测记录

`2026-11-19T07:38Z`，`fork-release` run **44480661877** 在 `windows-latest` 上跑完（3m58s），
Release id **451013608**。逐条核对结果：

| 检查项 | 结果 | 证据 |
| --- | --- | --- |
| tag 形状 | ✅ `v1.24.0-fork.20261119.1` | `gh release view` 输出 `tag=…` |
| Release 不被标成 pre-release | ✅ `draft=false prerelease=false` | `gh api .../releases/tags/…` |
| 产物名 | ✅ `orca-imboss-fork-1.24.0-fork.20261119.1.exe`（149,363,479 B） | Release assets |
| 版本号进了 exe 元数据 | ✅ `FileVersion`/`ProductVersion` = `1.24.0-fork.20261119.1`，`ProductName` = `imboss-fork` | `(Get-Item exe).VersionInfo` |
| `latest.yml` 与产物一致 | ✅ `version` = tag 版本；`sha512` 与下载到的 exe 实测 sha512 **完全相同** | 本地 `crypto` 复算 |
| 更新器真的认这个版本 | ✅ `check-update-logic.mjs --self-check`：前一日版本可升级、同版本不升级、后一日版本不降级 | 真实 `isUpdateAvailable` 判定 |
| 通道文件 | ⚠️ 只有 `latest.yml`，没有 `fork.yml` —— **这正是设计**（客户端请求 `fork.yml` 404 后回退 `latest.yml`，见第 4 节） | Release assets |
| `.blockmap` 增量包 | ❌ 缺（HTTP 404）。日志里明明打印了 `uploading …blockmap`，但 release 上没有 | `curl -I …exe.blockmap` → 404 |
| 发布说明 | ⚠️ 首次 `gh release edit` 撞 `HTTP 422 Validation Failed: Release.tag_name already exists`（electron-builder 刚建完 release 的竞态），该步骤 `continue-on-error` 所以没影响产物 | 日志 |
| 代码签名 | ⚠️ 未签名（`no code signing certificate configured, signing is skipped`），安装时 SmartScreen 会拦一次 | 日志 |

**已按这次结果修的两处**（`fork-release.yml`）：

1. 新增 `Make sure the delta (.blockmap) asset is attached`：publish 之后显式 `gh release upload dist/*.blockmap --clobber`。
   缺 blockmap 不影响能不能更新，但会让每次更新退化成完整 142MB 下载。
2. `Attach release notes` 改成「先等 release 可见（最多 5×5s）→ 再 edit，失败重试 5 次」。
   同时新增 `Verify published update metadata` 门禁：下载发布出来的 `latest.yml`，断言其 `version` = tag 版本，
   并跑 `fork/tools/check-update-logic.mjs --self-check`（用真实 `isUpdateAvailable` 验证可升级/不降级）。
   这三条以后每次发版都会自动跑，不用人工核对。

### 11.1 第二次实测抓到的大坑：同一条 tag 被建出**两个** release

`.4` 那轮发现 `Attach release notes` 一直 `HTTP 422 Release.tag_name already exists`，查下去才发现：

```
451023729 v1.24.0-fork.20261119.4  assets=3   ← exe + latest.yml + blockmap
451023730 v1.24.0-fork.20261119.4  assets=1   ← 只有一个 blockmap
```

`electron-builder 26.17.0` 在 `--publish always` 下会为同一条 tag **并发**创建两个 release
（日志里两行 `• publishing` 时间戳只差 0.1ms）。后果连坐三处：blockmap 被传到「兄弟」release 上（所以 `.1` 的
blockmap 是 404）、`gh release edit` 永远 422、Release 页面出现两条同 tag 记录。

**改法**：`--publish never` 只负责打包；发布改由 `gh release create/upload` 一次完成（`fork-release.yml`
的 `Publish release` 步骤），可重入（release 已存在就 `--clobber` 补传）。

`.5` 实测结果（Release 451030126，run 44483245642，2m42s）：

| 检查项 | 结果 |
| --- | --- |
| release 数量 | ✅ 一条 tag 一条 release（不再有兄弟） |
| 资产 | ✅ `latest.yml` + `.exe` + `.exe.blockmap` 全在同一 release，三个 URL 都是 HTTP 200 |
| 标题/正文 | ✅ `name=imboss-fork 1.24.0-fork.20261119.5`，正文含上游 base tag + commit + 版本规则 |
| pre-release 标记 | ✅ `prerelease=false`（版本字符串本身是预发布，但页面是正常 release） |
| 更新判定（真实 `isUpdateAvailable`） | ✅ `.1 → .5` = true，`.4 → .5` = true，同版本 false，官方 `1.24.0` → fork = false（官方版不会自动变成 fork 版，需手动装一次） |
| 整个 job 耗时 | 2m42s（此前 5m07s，因为省掉了 electron-builder 自己那套上传） |

另外修了 `release.sh` 的序号计算：`git ls-remote --tags` 对 annotated tag 会多输出一行 `…^{}`
（peeled），之前被当成「另一个 tag」计数，导致序号跳号（`.1` 之后直接 `.4`）。现在改为「取最大序号 + 1」。

## 12. 还没在真机上验证过的点（需要你本机点一下）

1. 旧 fork 版 →「检查更新」→ 下载 → 安装 → about 里版本号变化（验证第 4 节的版本/通道结论闭环）。
   自动更新需要**至少两个** fork 版本才有意义，所以这条要等第二个版本。
2. 与官方版并存安装、卸载一个不影响另一个。
3. 首次启动时 `initFork()` 读到的 `app-update.yml` 里 `owner/repo` 是否为 `Tingyuxx/orca-imboss`（自我保护检查）。
4. `fork:info` IPC 在设置页/调试面板里能否正常返回（目前只有 `window.imb.fork.info()`，还没有界面消费它）。
5. 远程后端（`imboss-backend`）本次未做 fork 打包，只出 Windows 桌面安装包。
