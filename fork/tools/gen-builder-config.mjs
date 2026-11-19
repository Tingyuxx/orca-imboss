#!/usr/bin/env node
/**
 * 由 `fork.config.json` + `electron-builder.fork.yml`（模板）生成真正给
 * electron-builder 用的配置：`.electron-builder.fork.gen.yml`（仓库根目录，
 * 已 gitignore）。
 *
 * 存在的理由：owner/repo/appId/productName 这类「会变、且必须只有一份」的信息
 * 只能有一个来源。模板里用 `@@…@@` 占位，值全部从 fork.config.json 取；
 * 生成时如果还有占位符没被替换，直接失败（避免把官方的 publish 目标带进产物）。
 *
 * 用法：
 *   node fork/tools/gen-builder-config.mjs            # 生成
 *   node fork/tools/gen-builder-config.mjs --check    # 只校验（不写文件），CI/本地都能跑
 *   node fork/tools/gen-builder-config.mjs --out <path>
 *   node fork/tools/gen-builder-config.mjs --config <path> --check   # 用另一个配置文件校验（自测用）
 *
 * 只用 Node 内建模块：本机 `pnpm install` 装不全（无 MSVC）也照样能跑。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const CONFIG = resolve(ROOT, "fork.config.json");
const TEMPLATE = resolve(ROOT, "electron-builder.fork.yml");
const DEFAULT_OUT = resolve(ROOT, ".electron-builder.fork.gen.yml");

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const outIndex = argv.indexOf("--out");
const outPath = outIndex >= 0 ? resolve(argv[outIndex + 1]) : DEFAULT_OUT;
const configIndex = argv.indexOf("--config");
const configPath =
  configIndex >= 0 ? resolve(argv[configIndex + 1]) : CONFIG;

const fail = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};

const config = JSON.parse(readFileSync(configPath, "utf8"));
const template = readFileSync(TEMPLATE, "utf8");

const placeholder = (value) => String(value ?? "").startsWith("REPLACE_ME");

const values = {
  "@@APP_ID@@": config.appId,
  "@@PRODUCT_NAME@@": config.productName,
  "@@EXECUTABLE_NAME@@": config.executableName,
  "@@ARTIFACT_BASE@@": config.artifactBaseName,
  "@@PUBLISH_OWNER@@": config.owner,
  "@@PUBLISH_REPO@@": config.repo,
};

for (const [token, value] of Object.entries(values)) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`fork.config.json 缺少 ${token} 对应的值`);
  }
}

let generated = template;
for (const [token, value] of Object.entries(values)) {
  generated = generated.split(token).join(value);
}

const leftover = generated.match(/@@[A-Z_]+@@/g);
if (leftover) fail(`模板里还有未替换的占位符：${leftover.join(", ")}`);

// 安全底线：publish 绝不能指回官方仓
const upstream = config.upstream ?? {};
for (const key of ["owner", "repo"]) {
  if (placeholder(config[key])) {
    fail(
      `fork.config.json 的 ${key} 仍是占位符。填好老板的 GitHub ${key} 再生成` +
        `（否则会拿标题为 REPLACE_ME 的更新源去发布）。`,
    );
  }
  if (config[key] === upstream[key] && config.owner === upstream.owner) {
    fail(`publish 目标与官方仓相同（${upstream.owner}/${upstream.repo}）——会覆盖 fork，拒绝生成。`);
  }
}

if (!/^\s*publish:\s*$/m.test(generated)) {
  fail("生成结果里没有 publish 段：自动更新会失效（老板要求保留指向自己仓的自动更新）。");
}
// 生成结果必须是合法 YAML（占位符值一律加引号，因此在替换后仍能解析）——这里做一次简单断言，
// 避免一个写坏的模板到 electron-builder 那一步才炸。
for (const [key, val] of [
  ["appId", config.appId],
  ["productName", config.productName],
]) {
  if (!new RegExp(`^\\s*${key}:\\s*"?${val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?\\s*$`, "m").test(generated)) {
    fail(`生成结果的 ${key} 与 fork.config.json 不一致`);
  }
}
if (!new RegExp(`owner:\\s*"?${config.owner}"?\\s*$`, "m").test(generated)) {
  fail("生成结果的 publish.owner 与 fork.config.json 不一致");
}

if (check) {
  console.log("✓ fork.config.json + electron-builder.fork.yml 可用");
  console.log(`  appId      = ${config.appId}`);
  console.log(`  productName= ${config.productName}`);
  console.log(`  publish    = github ${config.owner}/${config.repo}`);
  process.exit(0);
}

writeFileSync(outPath, generated);
console.log(`✓ 已生成 ${outPath}`);
console.log(`  publish → github ${config.owner}/${config.repo}`);
