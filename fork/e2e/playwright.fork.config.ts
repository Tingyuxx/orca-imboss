import { defineConfig } from "@playwright/test";

/**
 * fork 自有 e2e 的配置（用例放 `fork/e2e/*.spec.ts`）。
 *
 * 为什么不复用上游 `playwright.config.ts`：上游配置的 `testDir` 是
 * `tests/e2e`，收不到 `fork/e2e`；而 `playwright.config.ts` 与
 * `tsconfig.e2e.json` 都是上游文件，挂载纪律不允许我们改（见
 * `fork/integration-points.md` §3）。所以 fork 自带一份配置，用
 * `--config fork/e2e/playwright.fork.config.ts` 指过来：
 *
 *   pnpm exec playwright test --config fork/e2e/playwright.fork.config.ts
 *
 * 刻意和上游保持同样的取舍：
 * - `testDir` 相对**本文件所在目录**解析 → 就是 `fork/e2e` 本身。
 * - `workers: 1`：每个用例启动一整个 Electron 应用（自带 SQLite 与 Chromium
 *   user data），串行才可预测。
 * - 产物写到仓库根的 `playwright-report-fork/` 与 `test-results-fork/`（路径相对
 *   本文件，所以 `../../` 前缀），与上游那份报告分开，CI 分两个 artifact 传。
 * - 用例直接复用上游 helper `tests/e2e/helpers/app.ts`（只读引用，不改它）：那套
 *   helper 负责真实 Electron 启动 + 数据目录沙箱化，重写一遍只会漂移。
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "../../playwright-report-fork" }],
  ],
  outputDir: "../../test-results-fork",
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
});
