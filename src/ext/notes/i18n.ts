// The extension's own strings (see custom-docs/ext-agents.md: never `t("…")` here). English is the key;
// Chinese follows upstream's zh-CN register. Other languages fall back to English.
import { useMemo } from "react";

import { currentLanguage, useSettings } from "../upstream.ts";

const ZH: Record<string, string> = {
  "Scratch notes": "临时笔记",
  "Close scratch notes": "关闭临时笔记",
  "New note": "新建笔记",
  "Delete note": "删除笔记",
  "Click again to delete": "再点一次确认删除",
  "Notes": "笔记列表",
  "Untitled": "无标题",
  "Write here, tidy it up, then copy it to an agent…": "在这里先写、整理好，再复制给 Agent…",
  "Copy all": "复制全部",
  "Copy selection": "复制选中",
  "Copied": "已复制",
  "Copy refused: press Ctrl+C": "无法自动复制，请按 Ctrl+C",
  "Saved in this browser": "已保存在此浏览器",
  "Not saved: browser storage is blocked or full": "未保存：浏览器存储被禁用或已满",
  "{count} chars": "{count} 字",
  "Resize": "调整宽度",
};

const DICTIONARIES: Record<string, Record<string, string>> = { zh: ZH };

export type Tx = (key: string, vars?: Record<string, string | number>) => string;

function translate(language: string, key: string, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[language]?.[key] ?? key;
  return vars === undefined ? text : text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

/** For components: a new function whenever the language changes. */
export function useTx(): Tx {
  const { resolvedLanguage } = useSettings();
  return useMemo<Tx>(() => (key, vars) => translate(resolvedLanguage, key, vars), [resolvedLanguage]);
}

/** Outside React (a menu row built during App's render): the language the app last set. */
export const txNow: Tx = (key, vars) => translate(currentLanguage(), key, vars);
