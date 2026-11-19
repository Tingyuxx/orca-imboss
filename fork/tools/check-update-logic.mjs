#!/usr/bin/env node
/**
 * 用**真实的 electron-updater 判定逻辑**检查「一个已装版本会不会把某个版本当作可升级」。
 *
 * 背景：自动更新是否触发由 `AppUpdater.isUpdateAvailable()` 决定（版本后缀 `-fork.` 会
 * 自动开启预发布通道、`allowDowngrade` 默认 false 等细节都在里面），靠肉眼推 semver 容易错。
 * 这个工具直接 new 一个真实的 Updater 原型实例来跑那段逻辑，不猜。
 *
 * 用法：
 *   node fork/tools/check-update-logic.mjs --latest-yml latest.yml --expect-version 1.24.0-fork.20261119.1 --self-check
 *   node fork/tools/check-update-logic.mjs --version 1.24.0-fork.20261119.1 --current 1.24.0-fork.20261118.1
 *
 * 选项：
 *   --latest-yml <file>     从发布出来的 latest.yml 里读 version（推荐，校验的就是真发布物）
 *   --version <ver>         直接指定「远端版本」（与 --latest-yml 二选一）
 *   --current <ver>         已装版本，可重复多次
 *   --expect-version <ver>  断言 latest.yml 里的 version 等于它（tag → 版本号一致性）
 *   --self-check            自动跑三条不变量：更旧的日期可升级、同版本不可升级、更新的日期不降级
 *
 * 退出码：0 全部符合预期；1 有不符合项（可直接当 CI 门禁）。
 */
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);

function arg(name, dflt = null) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : dflt;
}
function multi(name) {
  const out = [];
  args.forEach((a, i) => {
    if (a === name && args[i + 1] !== undefined) out.push(args[i + 1]);
  });
  return out;
}
const has = (name) => args.includes(name);

/** 极简 latest.yml 解析：只取顶层 `version:` 与 `path:`，够用且不引依赖。 */
function readLatestYml(file) {
  if (!existsSync(file)) throw new Error(`找不到 ${file}`);
  const text = readFileSync(file, "utf8");
  const version = /^version:\s*'?"?([^'"\n]+)'?"?\s*$/m.exec(text)?.[1]?.trim();
  const path = /^path:\s*'?"?([^'"\n]+)'?"?\s*$/m.exec(text)?.[1]?.trim();
  const sha512 = /^\s+sha512:\s*'?"?([A-Za-z0-9+/=]+)'?"?\s*$/m.exec(text)?.[1]?.trim();
  if (!version) throw new Error(`${file} 里没有 version 字段`);
  return { version, path, sha512 };
}

/** 真实 electron-updater 实例：绕过构造函数，只喂构造函数里会设的那几个字段。 */
function makeUpdater(currentVersion) {
  const requireFromApp = createRequire(join(ROOT, "package.json"));
  const eu = requireFromApp("electron-updater");
  const inst = Object.create(eu.NsisUpdater.prototype);
  Object.defineProperty(inst, "currentVersion", { value: currentVersion });
  // 构造函数里的真实默认值（AppUpdater.js：allowDowngrade=false；allowPrerelease 由版本是否带预发布标识决定）
  Object.defineProperty(inst, "allowDowngrade", { value: false, writable: true });
  Object.defineProperty(inst, "allowPrerelease", { value: /-/.test(currentVersion), writable: true });
  // 构造函数 L186/L187 装的两个闭包：无灰度、无最低系统版本限制时都恒为 true
  inst._isUpdateSupported = () => true;
  inst._isUserWithinRollout = () => true;
  inst._logger = { info() {}, warn() {}, error() {}, debug() {} };
  return inst;
}

async function available(currentVersion, remoteVersion) {
  const inst = makeUpdater(currentVersion);
  const info = {
    version: remoteVersion,
    files: [],
    path: "",
    sha512: "",
    releaseDate: "",
    releaseName: "",
  };
  return inst.isUpdateAvailable(info);
}

/** `1.24.0-fork.20261119.1` → 前一天同序号，用于自检「更旧的版本应当能升级」。 */
function previousDay(version) {
  const m = /^(\d+\.\d+\.\d+)-fork\.(\d{8})\.(\d+)$/.exec(version);
  if (!m) return null;
  const d = new Date(
    Date.UTC(
      Number(m[2].slice(0, 4)),
      Number(m[2].slice(4, 6)) - 1,
      Number(m[2].slice(6, 8)),
    ),
  );
  d.setUTCDate(d.getUTCDate() - 1);
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `${m[1]}-fork.${stamp}.${m[3]}`;
}

/** `1.24.0-fork.20261119.1` → 后一天同序号，用于自检「更新的版本不该被当成降级」。 */
function nextDay(version) {
  const m = /^(\d+\.\d+\.\d+)-fork\.(\d{8})\.(\d+)$/.exec(version);
  if (!m) return null;
  const d = new Date(
    Date.UTC(
      Number(m[2].slice(0, 4)),
      Number(m[2].slice(4, 6)) - 1,
      Number(m[2].slice(6, 8)),
    ),
  );
  d.setUTCDate(d.getUTCDate() + 1);
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, "");
  return `${m[1]}-fork.${stamp}.${m[3]}`;
}

async function main() {
  const ymlFile = arg("--latest-yml");
  let remote = arg("--version");
  let published = null;
  if (ymlFile) {
    published = readLatestYml(ymlFile);
    remote = remote ?? published.version;
    console.log(`latest.yml: version=${published.version} path=${published.path ?? "(无)"}`);
    console.log(`           sha512=${published.sha512 ? published.sha512.slice(0, 16) + "…" : "(无)"}`);
  }
  if (!remote) throw new Error("需要 --latest-yml 或 --version 指明远端版本");

  let failed = 0;
  const expectVersion = arg("--expect-version");
  if (expectVersion) {
    const ok = published ? published.version === expectVersion : remote === expectVersion;
    console.log(`${ok ? "✓" : "✗"} latest.yml version ${remote} ${ok ? "==" : "!="} 期望 ${expectVersion}（tag 与版本一致）`);
    if (!ok) failed++;
  }

  const cases = [];
  for (const c of multi("--current")) cases.push({ current: c, remote, expect: "auto" });

  if (has("--self-check")) {
    const older = previousDay(remote);
    const newer = nextDay(remote);
    if (older) cases.push({ current: older, remote, expect: true, note: "更旧的日期 → 应当可升级" });
    cases.push({ current: remote, remote, expect: false, note: "同版本 → 不应升级" });
    if (newer) cases.push({ current: newer, remote, expect: false, note: "更新的版本 → 不应降级" });
  }
  if (cases.length === 0) throw new Error("没有要检查的已装版本（用 --current 或 --self-check）");

  console.log("\n已装版本                        远端版本                        isUpdateAvailable  判定");
  for (const c of cases) {
    let got;
    try {
      got = await available(c.current, c.remote);
    } catch (e) {
      console.log(`  ✗ ${c.current} → ${c.remote} 判定抛错：${e.message}`);
      failed++;
      continue;
    }
    const mark = c.expect === "auto" ? "·" : got === c.expect ? "✓" : "✗";
    if (c.expect !== "auto" && got !== c.expect) failed++;
    console.log(
      `  ${c.current.padEnd(30)} ${c.remote.padEnd(30)} ${String(got).padEnd(18)} ${mark} ${c.note ?? ""}`,
    );
  }

  if (failed > 0) {
    console.log(`\n✗ ${failed} 项不符合预期`);
    process.exit(1);
  }
  console.log("\n✓ 判定逻辑符合预期");
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
