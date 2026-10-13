// The read-only preview: numbered, highlighted lines; a picked range (a drag over the code, or a
// click on a line number, Shift+click to extend) copies as a reference for an agent.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, TriangleAlert, X } from "lucide-react";

import { CodeLines, copyText, formatBytes, languageForPath, LINE_ELEMENT_LIMIT, readFilePreviewText, useHighlightedLines, useMachineApi, type FileInfo } from "../upstream.ts";
import { useTx } from "./i18n.ts";
import { formatReference, lineLabel, relativeTo, sliceLines, type CopyFormat } from "./reference.ts";
import { setPref, usePrefs } from "./store.ts";

/** What travels for a preview; the viewer (Open in viewer) has the rest. */
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_LINES = Math.min(10_000, LINE_ELEMENT_LIMIT);

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | { status: "binary"; info: FileInfo }
  | { status: "text"; info: FileInfo; text: string; truncated: boolean };

interface Pick { from: number; to: number }

/** The source line a DOM position falls on: its `.hl-line`, or for the "\n" between two lines, the one before (end) or after (start). */
function lineAt(node: Node | null, edge: "start" | "end"): number | null {
  if (node === null) return null;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node as Element;
  const line = element?.closest<HTMLElement>("[data-line]");
  if (line) return Number(line.dataset.line);
  const sibling = edge === "end" ? node.previousSibling : node.nextSibling;
  if (sibling instanceof HTMLElement && sibling.dataset.line) return Number(sibling.dataset.line);
  return null;
}

export interface PreviewProps {
  path: string;
  paneId: string;
  /** the tree's root, which references are relative to */
  root: string;
  onOpenInViewer: (path: string) => void;
  /** a phone: back to the tree */
  onBack?: () => void;
}

export function Preview({ path, paneId, root, onOpenInViewer, onBack }: PreviewProps) {
  const tx = useTx();
  const { fetchFileInfo, fileUrl } = useMachineApi();
  const { format } = usePrefs();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [pick, setPick] = useState<Pick | null>(null);
  const [copied, setCopied] = useState<"path" | "ref" | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const anchor = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const abort = new AbortController();
    setLoaded({ status: "loading" }); setPick(null); setManual(null); anchor.current = null;
    void (async () => {
      try {
        const info = await fetchFileInfo(path, paneId);
        if (cancelled) return;
        if ("candidates" in info) { setLoaded({ status: "error" }); return; }
        if (info.kind !== "text") { setLoaded({ status: "binary", info }); return; }
        const response = await fetch(fileUrl(info.path, paneId), { signal: abort.signal, headers: { range: `bytes=0-${MAX_BYTES - 1}` } });
        const body = await readFilePreviewText(response, MAX_BYTES, { signal: abort.signal, maxLines: MAX_LINES, timeoutMs: 15_000, partialOnTimeout: true });
        if (!cancelled) setLoaded({ status: "text", info, text: body.text.replace(/\r\n/g, "\n"), truncated: body.truncated });
      } catch {
        if (!cancelled) setLoaded({ status: "error" });
      }
    })();
    return () => { cancelled = true; abort.abort(); };
  }, [path, paneId, fetchFileInfo, fileUrl]);

  const text = loaded.status === "text" ? loaded.text : "";
  const language = loaded.status === "text" ? languageForPath(loaded.info.path) : null;
  const code = useHighlightedLines(text, language);
  const lineCount = useMemo(() => text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0), [text]);
  const shownPath = loaded.status === "text" || loaded.status === "binary" ? loaded.info.path : path;
  const reference = relativeTo(root, shownPath);

  // a drag over the code picks its lines; a click that selects nothing leaves the pick alone
  useEffect(() => {
    const onChange = (): void => {
      const pre = preRef.current;
      const selection = document.getSelection();
      if (!pre || !selection || selection.rangeCount === 0 || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      if (!pre.contains(range.startContainer) || !pre.contains(range.endContainer)) return;
      const from = lineAt(range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer.childNodes[range.startOffset] ?? range.startContainer : range.startContainer, "start");
      let to = lineAt(range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer.childNodes[Math.max(0, range.endOffset - 1)] ?? range.endContainer : range.endContainer, "end");
      // a selection that ends at the very start of a line (a triple-click) does not take that line
      if (to !== null && from !== null && to > from && range.endOffset === 0 && range.endContainer.nodeType === Node.TEXT_NODE) to -= 1;
      if (from === null || to === null) return;
      anchor.current = Math.min(from, to);
      setPick({ from: Math.min(from, to), to: Math.max(from, to) });
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, []);

  // a press on a line number picks that line, Shift extends from the last one picked
  const onMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    const line = (event.target as Element).closest<HTMLElement>("[data-line]");
    const codeElement = preRef.current?.querySelector("code");
    if (!line || !codeElement || event.button !== 0) return;
    const gutterEnd = codeElement.getBoundingClientRect().left + parseFloat(getComputedStyle(codeElement).paddingInlineStart || "0");
    if (event.clientX >= gutterEnd) return;
    event.preventDefault();
    document.getSelection()?.removeAllRanges();
    const at = Number(line.dataset.line);
    const from = event.shiftKey && anchor.current !== null ? anchor.current : at;
    if (!event.shiftKey) anchor.current = at;
    setPick({ from: Math.min(from, at), to: Math.max(from, at) });
  };

  // the band behind the picked lines, measured from their elements
  const placeBand = useCallback(() => {
    const band = bandRef.current;
    const scroller = scrollRef.current;
    const pre = preRef.current;
    if (!band || !scroller || !pre || pick === null) { if (band) band.hidden = true; return; }
    const first = pre.querySelector<HTMLElement>(`[data-line="${pick.from}"]`);
    const last = pre.querySelector<HTMLElement>(`[data-line="${pick.to}"]`);
    if (!first || !last) { band.hidden = true; return; }
    const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
    const top = first.getBoundingClientRect().top - base;
    const bottom = last.getBoundingClientRect().bottom - base;
    band.hidden = false;
    band.style.top = `${top}px`;
    band.style.height = `${bottom - top}px`;
  }, [pick]);
  useLayoutEffect(placeBand, [placeBand, code]);
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(placeBand);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [placeBand, loaded.status]);

  useEffect(() => {
    if (copied === null) return;
    const timer = window.setTimeout(() => setCopied(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (value: string, kind: "path" | "ref"): Promise<void> => {
    setManual(null);
    if (await copyText(value)) setCopied(kind);
    // no clipboard (plain-HTTP LAN): the text is put in a box, selected, to copy by hand
    else setManual(value);
  };
  const copyReference = (): void => {
    if (pick === null) return;
    void copy(formatReference(format, reference, pick.from, pick.to, sliceLines(text, pick.from, pick.to), language), "ref");
  };

  const formats: { value: CopyFormat; label: string }[] = [
    { value: "lines", label: tx("Path and lines") },
    { value: "code", label: tx("Path and code") },
    { value: "markdown", label: tx("Markdown block") },
  ];
  const name = shownPath.split(/[\\/]/).pop() ?? shownPath;
  const meta = loaded.status === "text" ? `${tx("{count} lines", { count: lineCount })} · ${formatBytes(loaded.info.size)}`
    : loaded.status === "binary" ? formatBytes(loaded.info.size) : "";

  return (
    <section className="pf-preview" aria-label={name}>
      <header className="pf-preview-head">
        {onBack && <button type="button" className="icon-button" aria-label={tx("Back to files")} title={tx("Back to files")} onClick={onBack}><ArrowLeft aria-hidden="true" /></button>}
        <div className="pf-preview-title">
          <span className="pf-preview-path" title={shownPath}>{reference}</span>
          {meta && <span className="pf-preview-meta">{meta}</span>}
        </div>
        <button type="button" className="icon-button" aria-label={copied === "path" ? tx("Copied") : tx("Copy path")} title={copied === "path" ? tx("Copied") : tx("Copy path")} onClick={() => void copy(reference, "path")}>
          {copied === "path" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
        <button type="button" className="icon-button" aria-label={tx("Open in viewer")} title={tx("Open in viewer")} onClick={() => onOpenInViewer(shownPath)}><ExternalLink aria-hidden="true" /></button>
      </header>
      {loaded.status === "text" && loaded.truncated && <p className="pf-notice" role="status"><TriangleAlert aria-hidden="true" />{tx("Only the first {count} lines are shown. Open it in the viewer for the rest.", { count: lineCount })}</p>}
      <div ref={scrollRef} className="pf-preview-body" onMouseDown={onMouseDown}>
        {loaded.status === "loading" && <p className="pf-empty">{tx("Loading…")}</p>}
        {loaded.status === "error" && <p className="pf-empty" role="alert">{tx("The file could not be opened.")}</p>}
        {loaded.status === "binary" && <p className="pf-empty">{tx("This file is not text. Open it in the viewer.")}</p>}
        {loaded.status === "text" && <>
          <div ref={bandRef} className="pf-pick-band" hidden aria-hidden="true" />
          <CodeLines ref={preRef} lines={code.lines} lineNumbers open={null} className="pf-code" />
        </>}
      </div>
      {loaded.status === "text" && <footer className="pf-pickbar">
        {pick === null
          ? <span className="pf-pickbar-hint">{tx("Select code, or click a line number (Shift+click extends).")}</span>
          : <>
            <span className="pf-pickbar-range" title={`${reference}:${lineLabel(pick.from, pick.to)}`}>{name}:{lineLabel(pick.from, pick.to)}</span>
            <select className="select pf-format" aria-label={tx("Copy format")} value={format} onChange={(event) => setPref("format", event.target.value as CopyFormat)}>
              {formats.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" className="btn btn-primary pf-copy" onClick={copyReference}>
              {copied === "ref" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied === "ref" ? tx("Copied") : tx("Copy reference")}
            </button>
            <button type="button" className="icon-button" aria-label={tx("Clear selection")} title={tx("Clear selection")} onClick={() => { setPick(null); anchor.current = null; setManual(null); }}><X aria-hidden="true" /></button>
          </>}
      </footer>}
      {manual !== null && <textarea className="input pf-manual" readOnly value={manual} ref={(box) => { box?.focus(); box?.select(); }} />}
    </section>
  );
}
