// The drawer: a non-modal panel at the right of the app, under the header, holding one note at a
// time in a plain textarea. Every keystroke is stored in this browser; nothing goes to a pane.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, Copy, Plus, Trash2, X } from "lucide-react";

import type { AppSlotContext } from "../../slots/types.ts";
import { copyText, useMediaQuery } from "../upstream.ts";
import { useTx } from "./i18n.ts";
import { titleOf } from "./notes.ts";
import { addNote, removeNote, select, setOpen, setText, setWidth, useNotes, useOpen } from "./store.ts";
import "./notes.css";

export function ScratchNotes(_: { ctx: AppSlotContext }) {
  return useOpen() ? <Drawer /> : null;
}

function Drawer() {
  const tx = useTx();
  const { notes, active, saved, width } = useNotes();
  const note = notes.find((entry) => entry.id === active) ?? notes[0]!;
  const phone = useMediaQuery("(max-width: 640px)");
  const surface = useRef<HTMLElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");
  const [armed, setArmed] = useState(false);

  useEffect(() => { editor.current?.focus(); }, [note.id]);
  useEffect(() => { setRange([0, 0]); setArmed(false); setCopy("idle"); }, [note.id]);
  useEffect(() => {
    if (copy === "idle") return;
    const timer = window.setTimeout(() => setCopy("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [copy]);
  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const close = useCallback(() => setOpen(false), []);
  // Escape from inside closes it, unless a modal above it has the key
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || !surface.current?.contains(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const [start, end] = range;
  const picked = end > start && end <= note.text.length;
  const doCopy = async (): Promise<void> => {
    const [from, to] = picked ? [start, end] : [0, note.text.length];
    if (await copyText(note.text.slice(from, to))) { setCopy("copied"); return; }
    // refused (plain HTTP without the copy command): leave the text selected for Ctrl+C
    const box = editor.current;
    box?.focus();
    box?.setSelectionRange(from, to);
    setCopy("refused");
  };

  const remove = (): void => {
    if (note.text.trim() !== "" && !armed) { setArmed(true); return; }
    removeNote(note.id);
  };

  // drag the left edge to resize (desktop)
  const drag = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const from = surface.current?.getBoundingClientRect().width ?? width;
    const move = (next: PointerEvent): void => {
      setWidth(Math.round(Math.max(300, Math.min(window.innerWidth - 120, from + startX - next.clientX))));
    };
    const up = (): void => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  const copyLabel = copy === "copied" ? tx("Copied") : copy === "refused" ? tx("Copy refused: press Ctrl+C") : picked ? tx("Copy selection") : tx("Copy all");
  return (
    <aside ref={surface} className={`sn-drawer${phone ? " is-full" : ""}`} style={phone ? undefined : { width: `min(${width}px, calc(100vw - 120px))` }}
      role="dialog" aria-modal="false" aria-label={tx("Scratch notes")}>
      {!phone && <div className="sn-grip" role="separator" aria-orientation="vertical" aria-label={tx("Resize")} onPointerDown={drag} />}
      <header className="sn-head">
        <h2 className="sn-title">{tx("Scratch notes")}</h2>
        <select className="select sn-pick" value={note.id} aria-label={tx("Notes")} onChange={(event) => select(event.target.value)}>
          {notes.map((entry) => <option key={entry.id} value={entry.id}>{titleOf(entry.text) || tx("Untitled")}</option>)}
        </select>
        <div className="sn-actions">
          <button type="button" className="icon-button" aria-label={tx("New note")} title={tx("New note")} onClick={addNote}><Plus aria-hidden="true" /></button>
          <button type="button" className={`icon-button${armed ? " sn-armed" : ""}`} aria-label={armed ? tx("Click again to delete") : tx("Delete note")} title={armed ? tx("Click again to delete") : tx("Delete note")} onClick={remove}><Trash2 aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-label={tx("Close scratch notes")} title={tx("Close scratch notes")} onClick={close}><X aria-hidden="true" /></button>
        </div>
      </header>
      <textarea ref={editor} className="sn-editor" value={note.text} spellCheck={false} placeholder={tx("Write here, tidy it up, then copy it to an agent…")} aria-label={tx("Scratch notes")}
        onChange={(event) => setText(note.id, event.target.value)}
        onSelect={(event) => setRange([event.currentTarget.selectionStart, event.currentTarget.selectionEnd])} />
      <footer className="sn-foot">
        <span className={`sn-status${saved ? "" : " is-error"}`}>
          {saved ? tx("Saved in this browser") : tx("Not saved: browser storage is blocked or full")} · {tx("{count} chars", { count: note.text.length })}
        </span>
        <button type="button" className="btn btn-primary sn-copy" disabled={note.text === ""}
          onMouseDown={(event) => event.preventDefault()} onClick={() => void doCopy()}>
          {copy === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          <span>{copyLabel}</span>
        </button>
        <span className="visually-hidden" role="status">{copy === "idle" ? "" : copyLabel}</span>
      </footer>
    </aside>
  );
}
