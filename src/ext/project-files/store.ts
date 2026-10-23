// Open/closed state and per-device preferences of the project files drawer. App holds none of it.
import { useSyncExternalStore } from "react";

import type { CopyFormat } from "./reference.ts";

const KEY = "ovis:ext:project-files:";

function load<T>(name: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const raw = window.localStorage.getItem(KEY + name);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return valid(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function save(name: string, value: unknown): void {
  try { window.localStorage.setItem(KEY + name, JSON.stringify(value)); } catch { /* storage blocked: the default next time */ }
}

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isFormat = (value: unknown): value is CopyFormat => value === "lines" || value === "code" || value === "markdown";

export interface Prefs {
  /** drawer width in px (desktop) */
  width: number;
  /** tree column width in px */
  treeWidth: number;
  maximized: boolean;
  showHidden: boolean;
  format: CopyFormat;
}

let open = false;
let prefs: Prefs | null = null;
const listeners = new Set<() => void>();
const emit = (): void => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); };

export function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function useOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}

function currentPrefs(): Prefs {
  prefs ??= {
    width: load("width", 760, isNumber),
    treeWidth: load("treeWidth", 260, isNumber),
    maximized: load("maximized", false, isBoolean),
    showHidden: load("showHidden", false, isBoolean),
    format: load("format", "code", isFormat),
  };
  return prefs;
}

export function setPref<K extends keyof Prefs>(name: K, value: Prefs[K]): void {
  prefs = { ...currentPrefs(), [name]: value };
  save(name, value);
  emit();
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, currentPrefs);
}
