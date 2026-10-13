// The drawer: a non-modal panel at the right of the app, under the header, so the pane beside it
// stays in sight and in use. Tree on the left, preview on the right; on a phone one at a time.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUp, Eye, EyeOff, House, Maximize2, Minimize2, RefreshCw, SquareTerminal, X } from "lucide-react";

import type { AppSlotContext } from "../../slots/types.ts";
import { MachineContext, useMachineApi, useMediaQuery, type DirectoryListing } from "../upstream.ts";
import { useTx } from "./i18n.ts";
import { Preview } from "./Preview.tsx";
import { setOpen, setPref, useOpen, usePrefs } from "./store.ts";
import { cdBlocked, parentOf, sendCd } from "./terminal.ts";
import { Tree } from "./Tree.tsx";
import "./project-files.css";

export function ProjectFiles({ ctx }: { ctx: AppSlotContext }) {
  const open = useOpen();
  if (!open) return null;
  return <MachineContext.Provider value={ctx.machineId}><Drawer ctx={ctx} /></MachineContext.Provider>;
}

function Drawer({ ctx }: { ctx: AppSlotContext }) {
  const tx = useTx();
  const prefs = usePrefs();
  const phone = useMediaQuery("(max-width: 640px)");
  const wide = useMediaQuery("(min-width: 769px)");
  const pane = ctx.pane;
  const paneFolder = pane ? pane.foreground_cwd ?? pane.cwd ?? "~" : null;
  const [root, setRoot] = useState(paneFolder ?? "~");
  const [resolved, setResolved] = useState<DirectoryListing | null>(null);
  const [file, setFile] = useState<string | null>(null);
  // the row picked last in the tree: "cd here" goes to it (a file: its folder), else to the root
  const [selection, setSelection] = useState<{ path: string; kind: "dir" | "file" } | null>(null);
  const [refresh, setRefresh] = useState(0);
  const surface = useRef<HTMLElement>(null);

  // another pane takes the drawer with it; the same pane changing folder (a cd sent from here) does not
  useEffect(() => { if (paneFolder !== null) goTo(paneFolder); }, [pane?.pane_id]);
  useEffect(() => { surface.current?.querySelector<HTMLElement>(".pf-quick")?.focus(); }, []);

  /** A new root: nothing picked under the old one. */
  function goTo(next: string): void {
    setRoot(next);
    setFile(null);
    setSelection(null);
  }

  const close = useCallback(() => setOpen(false), []);
  // Escape from inside closes it, unless a modal above it (the file viewer) has the key
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || !surface.current?.contains(document.activeElement)) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const onRootResolved = useCallback((listing: DirectoryListing) => setResolved(listing), []);
  const rootPath = resolved?.path ?? root;
  const crumbs = rootPath.replace(/\\/g, "/").split("/").filter(Boolean);
  const shownRoot = crumbs.slice(-2).join(" › ") || rootPath;

  // drag the left edge to resize (desktop); the tree's own edge the same way
  const drag = (target: "width" | "treeWidth") => (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const grip = event.currentTarget;
    grip.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const start = target === "width" ? surface.current?.getBoundingClientRect().width ?? prefs.width : prefs.treeWidth;
    const move = (next: PointerEvent): void => {
      const delta = target === "width" ? startX - next.clientX : next.clientX - startX;
      const limit = target === "width" ? [360, window.innerWidth - 120] : [160, Math.max(200, (surface.current?.getBoundingClientRect().width ?? 800) - 280)];
      setPref(target, Math.round(Math.max(limit[0]!, Math.min(limit[1]!, start + delta))));
    };
    const up = (): void => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up); };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  const full = phone || !wide || prefs.maximized;
  const style = full ? undefined : { width: `min(${prefs.width}px, calc(100vw - 120px))` };
  const showTree = !phone || file === null;
  const showPreview = !phone || file !== null;

  return (
    <aside ref={surface} className={`pf-drawer${full ? " is-full" : ""}`} style={style} role="dialog" aria-modal="false" aria-label={tx("Project files")}>
      {!full && <div className="pf-grip" role="separator" aria-orientation="vertical" aria-label={tx("Resize")} onPointerDown={drag("width")} />}
      <header className="pf-head">
        <h2 className="pf-title">{tx("Project files")}</h2>
        <span className="pf-root" title={rootPath}>{shownRoot}</span>
        <div className="pf-actions">
          <button type="button" className="icon-button" aria-label={tx("Parent folder")} title={tx("Parent folder")} disabled={!resolved?.parent} onClick={() => { if (resolved?.parent) goTo(resolved.parent); }}><ArrowUp aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-label={tx("Back to the pane's folder")} title={tx("Back to the pane's folder")} disabled={paneFolder === null || root === paneFolder} onClick={() => { if (paneFolder !== null) goTo(paneFolder); }}><House aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-label={tx("Refresh")} title={tx("Refresh")} onClick={() => setRefresh((n) => n + 1)}><RefreshCw aria-hidden="true" /></button>
          <button type="button" className="icon-button" aria-pressed={prefs.showHidden} aria-label={tx("Show hidden and ignored folders")} title={tx("Show hidden and ignored folders")} onClick={() => setPref("showHidden", !prefs.showHidden)}>{prefs.showHidden ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}</button>
          {wide && !phone && <button type="button" className="icon-button" aria-label={prefs.maximized ? tx("Restore size") : tx("Maximize")} title={prefs.maximized ? tx("Restore size") : tx("Maximize")} onClick={() => setPref("maximized", !prefs.maximized)}>{prefs.maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}</button>}
          <button type="button" className="icon-button" aria-label={tx("Close project files")} title={tx("Close project files")} onClick={close}><X aria-hidden="true" /></button>
        </div>
      </header>
      {pane === null ? <p className="pf-empty">{tx("Open a pane first.")}</p> : (
        <div className="pf-body" style={phone ? undefined : { gridTemplateColumns: `${prefs.treeWidth}px 6px minmax(0, 1fr)` }}>
          {showTree && <div className="pf-side">
            <QuickOpen paneId={pane.pane_id} onOpen={setFile} />
            <Tree root={root} paneId={pane.pane_id} showHidden={prefs.showHidden} refresh={refresh} selected={selection?.path ?? null} onRootResolved={onRootResolved}
              onSelect={(path, kind) => { setSelection({ path, kind }); if (kind === "file") setFile(path); }} />
            <CdButton ctx={ctx} dir={selection === null ? rootPath : selection.kind === "dir" ? selection.path : parentOf(selection.path)} />
          </div>}
          {!phone && <div className="pf-split" role="separator" aria-orientation="vertical" aria-label={tx("Resize")} onPointerDown={drag("treeWidth")} />}
          {showPreview && (file === null
            ? <p className="pf-empty">{tx("Pick a file in the tree.")}</p>
            : <Preview key={file} path={file} paneId={pane.pane_id} root={rootPath} onOpenInViewer={ctx.openFile} onBack={phone ? () => setFile(null) : undefined} />)}
        </div>
      )}
    </aside>
  );
}

/** Quick open over the pane folder's files (git ls-files where there is git), as the composer's @ does. */
function QuickOpen({ paneId, onOpen }: { paneId: string; onOpen: (path: string) => void }) {
  const tx = useTx();
  const { fetchPaneFiles } = useMachineApi();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[] | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q === "") { setResults(null); return; }
    let live = true;
    const timer = window.setTimeout(() => {
      fetchPaneFiles(paneId, q, 50).then((files) => { if (live) { setResults(files); setActive(0); } }).catch(() => { if (live) setResults([]); });
    }, 150);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query, paneId, fetchPaneFiles]);

  const choose = (path: string): void => { onOpen(path); setQuery(""); };
  return (
    <div className="pf-quick-wrap">
      <input className="input pf-quick" type="search" value={query} placeholder={tx("Quick open (files tracked by git)…")} aria-label={tx("Quick open (files tracked by git)…")}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (results === null || results.length === 0) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((n) => Math.min(results.length - 1, n + 1)); }
          else if (event.key === "ArrowUp") { event.preventDefault(); setActive((n) => Math.max(0, n - 1)); }
          else if (event.key === "Enter") { event.preventDefault(); choose(results[active]!); }
        }} />
      {results !== null && <ul className="pf-quick-results" role="listbox" aria-label={tx("Files")}>
        {results.length === 0 && <li className="pf-tree-note" role="none">{tx("No matching files")}</li>}
        {results.map((path, index) => (
          <li key={path} role="option" aria-selected={index === active} className={`pf-quick-row${index === active ? " is-active" : ""}`} title={path}
            onMouseDown={(event) => { event.preventDefault(); choose(path); }}>{path}</li>
        ))}
      </ul>}
    </div>
  );
}

/** Types `cd <folder>` into the selected pane and presses Enter: a shell only, never an agent's prompt. */
function CdButton({ ctx, dir }: { ctx: AppSlotContext; dir: string }) {
  const tx = useTx();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  useEffect(() => setState("idle"), [dir]);
  useEffect(() => {
    if (state !== "sent" && state !== "failed") return;
    const timer = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [state]);
  const pane = ctx.pane;
  if (pane === null) return null;
  const blocked = cdBlocked(pane);
  const name = dir.replace(/[\/]+$/, "").split(/[\/]/).pop() || dir;
  const title = blocked === "agent" ? tx("An agent runs in this pane: the command would be sent to it as a message.")
    : blocked === "restoring" ? tx("This pane is not running.")
    : tx("Change the selected pane's folder to {path}", { path: dir });
  const send = async (): Promise<void> => {
    setState("sending");
    try {
      await sendCd(ctx.machineId, pane, dir);
      setState("sent");
    } catch {
      setState("failed");
    }
  };
  return (
    <div className="pf-cd">
      <button type="button" className="btn pf-cd-button" disabled={blocked !== null || state === "sending"} title={title} onClick={() => void send()}>
        <SquareTerminal aria-hidden="true" />
        <span className="pf-cd-label">{state === "sent" ? tx("Sent to the terminal") : state === "failed" ? tx("Could not send") : tx("cd to {name}", { name })}</span>
      </button>
      <span className="visually-hidden" role="status">{state === "sent" ? tx("Sent to the terminal") : state === "failed" ? tx("Could not send") : ""}</span>
    </div>
  );
}
