import { expect, test } from "@playwright/test";
import { launchApp, type LaunchedApp } from "../../tests/e2e/helpers/app";

/**
 * fork 自有 e2e 的地板用例。
 *
 * 它只证明两件事，但两件都是 fork 独有的风险：
 * 1. `--config fork/e2e/playwright.fork.config.ts` 在 CI 里真的收集得到用例
 *    （配置写错、testDir 写错，这里会以「no tests found」红掉，而不是静默通过）；
 * 2. fork 的挂载坐标（M1 IPC / M2 preload / M5 词条 / M6 类型 / M8 迁移 / M9 init）
 *    如果把启动弄坏，这一条会最先红。
 *
 * Tess 的真实流程用例放在同目录 `fork/e2e/<flow>.spec.ts`，把这里当模板用即可。
 */

let app: LaunchedApp | undefined;

test.beforeEach(async () => {
  app = await launchApp();
});

test.afterEach(async () => {
  await app?.close();
});

test("fork build boots the real app with the module nav intact", async () => {
  const { window, rendererErrors } = app!;

  // 侧栏（导航）在，且设置入口可点：挂载点把渲染层挂坏时这里先红。
  const nav = window.getByRole("navigation", { name: "Modules" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("button", { name: "Settings" })).toBeVisible();

  // 渲染层未捕获异常 = 挂载代码抛了；沙箱化的空白数据目录里不该有。
  expect(rendererErrors).toEqual([]);
});
