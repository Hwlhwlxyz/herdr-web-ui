// The extension's own strings (see custom-docs/ext-agents.md: never `t("…")` here). English is the key;
// Chinese follows upstream's zh-CN register. Other languages fall back to English.
import { useMemo } from "react";

import { currentLanguage, useSettings } from "../upstream.ts";

const ZH: Record<string, string> = {
  "Project files": "项目文件",
  "Close project files": "关闭项目文件",
  "Open a pane first.": "请先选择一个窗格。",
  "Parent folder": "上级目录",
  "Back to the pane's folder": "回到窗格目录",
  "Refresh": "刷新",
  "Show hidden and ignored folders": "显示隐藏和忽略的目录",
  "Maximize": "最大化",
  "Restore size": "还原大小",
  "Quick open (files tracked by git)…": "快速打开（git 跟踪的文件）…",
  "No matching files": "没有匹配的文件",
  "Loading…": "加载中…",
  "This folder cannot be opened.": "无法打开此目录。",
  "Folders could not be loaded.": "目录加载失败。",
  "More entries are not shown (over 500).": "还有更多项未显示（超过 500 项）。",
  "Empty folder": "空目录",
  "Pick a file in the tree.": "在左侧目录树中选择一个文件。",
  "Back to files": "返回文件列表",
  "Copy path": "复制路径",
  "Copied": "已复制",
  "Copy absolute path": "复制绝对路径",
  "Copy relative path": "复制相对路径",
  "Copy refused: press Ctrl+C": "无法自动复制，请手动复制",
  "Open in viewer": "在查看器中打开",
  "{count} lines": "{count} 行",
  "Only the first {count} lines are shown. Open it in the viewer for the rest.": "只显示了前 {count} 行，完整内容请在查看器中打开。",
  "This file is not text. Open it in the viewer.": "这不是文本文件，请在查看器中打开。",
  "The file could not be opened.": "无法打开此文件。",
  "Select code, or click a line number (Shift+click extends).": "拖选代码，或点击行号选择行（Shift+点击可扩展）。",
  "Copy format": "复制格式",
  "Path and lines": "路径和行号",
  "Path and code": "路径 + 代码",
  "Markdown block": "Markdown 代码块",
  "Copy reference": "复制引用",
  "Clear selection": "清除选择",
  "Resize": "调整宽度",
  "Files": "文件",
  "cd to {name}": "cd 到 {name}",
  "Change the selected pane's folder to {path}": "将当前窗格的目录切换到 {path}",
  "An agent runs in this pane: the command would be sent to it as a message.": "此窗格正在运行 Agent，命令会被当作消息发给它，因此不可用。",
  "This pane is not running.": "此窗格没有在运行。",
  "Sent to the terminal": "已发送到终端",
  "Could not send": "发送失败",
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
