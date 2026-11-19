#!/usr/bin/env node
/**
 * 把 package.json 的 version 改成一次 fork 发布的版本（**不提交**）。
 *
 * 为什么需要它：electron-updater 判断「新版本」只看发布资产里 `latest.yml` 的
 * `version` 字段，而这个字段就是打包时 package.json 的 version。fork 的版本号必须
 *  1) 是合法 semver（否则 GitHub provider 会跳过这个 release，见下），
 *  2) 带 `-fork.<日期>.<序号>` 预发布后缀（日期递增 + 同日序号递增 = 严格单调），
 *  3) 基础版本号 = 当前跟到的官方版本（可追溯）。
 *
 * 关于 tag：electron-builder 自己按 `v` + version 建 tag
 * （electron-publish/out/gitHubPublisher.js: `this.tag = githubTagPrefix(info) + version`），
 * 所以 tag 与 version 天然不会脱钩；不要在版本号里带 `v`。
 *
 * 用法：
 *   node fork/tools/set-version.mjs --from-tag v1.24.0-fork.20261119.1 --strict-base
 *   node fork/tools/set-version.mjs 1.24.0-fork.20261119.1
 *   node fork/tools/set-version.mjs --from-tag <tag> --check   # 只校验，不写文件
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const PKG = resolve(ROOT, "package.json");
const config = JSON.parse(readFileSync(resolve(ROOT, "fork.config.json"), "utf8"));

const argv = process.argv.slice(2);
const tagIndex = argv.indexOf("--from-tag");
const checkOnly = argv.includes("--check");
const strictBase = argv.includes("--strict-base");
const positional = argv.filter(
  (a, i) => !a.startsWith("--") && argv[i - 1] !== "--from-tag",
);

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

let raw;
if (tagIndex >= 0) {
  const tag = argv[tagIndex + 1];
  if (!tag) fail("--from-tag 后面要跟 tag，例如 --from-tag v1.24.0-fork.20261119.1");
  if (!tag.startsWith(config.tagPrefix)) {
    fail(`tag "${tag}" 必须以 "${config.tagPrefix}" 开头（electron-builder 生成的 tag 是 v<version>）`);
  }
  raw = tag.slice(config.tagPrefix.length);
} else if (positional.length > 0) {
  raw = positional[0];
} else {
  fail(
    "用法：set-version.mjs <version> | --from-tag <tag> [--strict-base] [--check]",
  );
}

// <baseSemver>-<prereleaseId>.<YYYYMMDD>.<n>
const id = config.prereleaseId;
const re = new RegExp(`^(\\d+\\.\\d+\\.\\d+)-${id}\\.(\\d{8})\\.(\\d+)$`);
const match = re.exec(raw);
if (!match) {
  fail(
    `版本号 "${raw}" 不合法。必须是 <官方版本>-${id}.<YYYYMMDD>.<序号>，` +
      `例如 1.24.0-${id}.20261119.1。\n` +
      "  原因：GitHub provider 只接受**合法 semver** 的 tag（electron-updater/out/providers/GitHubProvider.js: " +
      "`if (!semver.valid(hrefTag)) continue;`），" +
      `且更新通道名取自预发布标识 "${id}"，缺了这个后缀自动更新会失效。`,
  );
}
const [, base, date, seq] = match;

const pkgText = readFileSync(PKG, "utf8");
const current = JSON.parse(pkgText).version;
const versionLinePrefix = `"version": "${current}"`;
if (!pkgText.includes(versionLinePrefix)) {
  fail(`package.json 里找不到 ${versionLinePrefix}，无法安全替换`);
}

if (strictBase && base !== current) {
  fail(
    `tag/版本里的基础版本 ${base} 与 package.json 的 ${current} 不一致。` +
      "发布前先把版本对齐（tag 必须记录真实的官方基线，否则无法追溯）。",
  );
}

if (checkOnly) {
  console.log(`✓ 版本格式正确：${raw}（基础 ${base}，日期 ${date}，序号 ${seq}）`);
  if (base !== current) {
    console.warn(`  ! 基础版本 ${base} ≠ 当前 package.json ${current}`);
  }
  process.exit(0);
}

writeFileSync(PKG, pkgText.replace(versionLinePrefix, `"version": "${raw}"`));
const written = JSON.parse(readFileSync(PKG, "utf8")).version;
if (written !== raw) fail(`写入失败：package.json 现在是 ${written}`);

console.log(`✓ package.json version: ${current} → ${written}`);
console.log(`  tag（electron-builder 会自动建）: ${config.tagPrefix}${written}`);
