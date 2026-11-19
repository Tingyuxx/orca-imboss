import { SettingKeys } from "@shared/constants/settings";
import { setupL10N } from "@shared/l10n";
import zhCN from "@shared/translations/zhCN.json";
// FORK-MOUNT:M5 — 同 src/main/locale.ts：fork 词条走自己的 JSON
import forkZhCN from "@shared/fork/translations/zhCN.json";
import { appStore } from "./app-store";

export const TRANSLATIONS = { "zh-CN": { ...zhCN, ...forkZhCN } }; // FORK-MOUNT:M5

export async function setLocale(value: string): Promise<void> {
  await imb.settings.set(SettingKeys.Locale, value);
  setupL10N(value, TRANSLATIONS);
  appStore.locale = value;
}

export function updateLocale(value: string): void {
  setupL10N(value, TRANSLATIONS);
  appStore.locale = value;
}
