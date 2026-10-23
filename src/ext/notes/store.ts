// Scratch notes live in this browser's localStorage only: no server, no other device. Another tab
// of the app sees an edit through the storage event. App holds none of this state.
import { useSyncExternalStore } from "react";

import { newId, parseNotes, type Note } from "./notes.ts";

const KEY = "ovis:ext:notes:";
const NOTES = KEY + "notes";
const ACTIVE = KEY + "active";
const WIDTH = KEY + "width";

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Whether the value was stored (false: storage blocked or full). */
function write(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export interface NotesState {
  notes: Note[];
  /** the note shown; always one of `notes` */
  active: string;
  /** false when the last edit could not be stored */
  saved: boolean;
  width: number;
}

let open = false;
let state: NotesState | null = null;
const listeners = new Set<() => void>();
const emit = (): void => { for (const listener of listeners) listener(); };
const subscribe = (listener: () => void): (() => void) => { listeners.add(listener); return () => listeners.delete(listener); };

function blank(): Note {
  return { id: newId(), text: "", updated: Date.now() };
}

function load(saved = true): NotesState {
  const stored = parseNotes(read(NOTES));
  const notes = stored.length > 0 ? stored : [blank()];
  const active = read(ACTIVE);
  const width = read(WIDTH);
  return {
    notes,
    active: typeof active === "string" && notes.some((note) => note.id === active) ? active : notes[0]!.id,
    saved,
    width: typeof width === "number" && Number.isFinite(width) ? width : 440,
  };
}

function current(): NotesState {
  state ??= load();
  return state;
}

function commit(next: NotesState, keys: { notes?: boolean; active?: boolean; width?: boolean }): void {
  let saved = true;
  if (keys.notes) saved = write(NOTES, next.notes) && saved;
  if (keys.active) saved = write(ACTIVE, next.active) && saved;
  if (keys.width) saved = write(WIDTH, next.width) && saved;
  state = { ...next, saved };
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== null && !event.key.startsWith(KEY)) return;
    state = load();
    emit();
  });
}

export function setOpen(next: boolean): void {
  if (open === next) return;
  open = next;
  emit();
}

export function useOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}

export function useNotes(): NotesState {
  return useSyncExternalStore(subscribe, current);
}

export function setText(id: string, text: string): void {
  const now = current();
  commit({ ...now, notes: now.notes.map((note) => note.id === id ? { ...note, text, updated: Date.now() } : note) }, { notes: true });
}

export function select(id: string): void {
  const now = current();
  if (now.active === id || !now.notes.some((note) => note.id === id)) return;
  commit({ ...now, active: id }, { active: true });
}

/** A new empty note, first in the list, shown. An empty note already there is reused. */
export function addNote(): void {
  const now = current();
  const empty = now.notes.find((note) => note.text.trim() === "");
  if (empty) { select(empty.id); return; }
  const note = blank();
  commit({ ...now, notes: [note, ...now.notes], active: note.id }, { notes: true, active: true });
}

/** Removes a note; the last one left is emptied instead, so there is always one to write in. */
export function removeNote(id: string): void {
  const now = current();
  const index = now.notes.findIndex((note) => note.id === id);
  if (index < 0) return;
  const rest = now.notes.filter((note) => note.id !== id);
  const notes = rest.length > 0 ? rest : [blank()];
  const active = now.active === id ? notes[Math.min(index, notes.length - 1)]!.id : now.active;
  commit({ ...now, notes, active }, { notes: true, active: true });
}

export function setWidth(width: number): void {
  commit({ ...current(), width }, { width: true });
}
