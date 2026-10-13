// The folder tree: each folder is listed (`/api/workspace/directories?files=1`) the first time it
// opens and kept until Refresh; nothing polls.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { ApiError, FileGlyph, useMachineApi, type DirectoryListing } from "../upstream.ts";
import { useTx } from "./i18n.ts";

/** Folders left out unless "show hidden and ignored" is on (dot folders are left out by the server). */
const IGNORED = new Set(["node_modules", "dist", "build", "target", "out", ".venv", "venv", "__pycache__", ".herdr-web-ui", "coverage", ".next", ".turbo"]);

type Node =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; listing: DirectoryListing };

interface Row {
  path: string;
  name: string;
  depth: number;
  kind: "dir" | "file" | "note";
  note?: string;
}

/** Joins with the separator the parent already uses (a Windows bridge may answer `C:\…`). */
export function childPath(parent: string, name: string): string {
  const separator = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
  return parent.endsWith(separator) ? `${parent}${name}` : `${parent}${separator}${name}`;
}

export interface TreeProps {
  root: string;
  paneId: string;
  showHidden: boolean;
  /** bumped by Refresh: every open folder is listed again */
  refresh: number;
  /** the folder or file picked last (highlighted) */
  selected: string | null;
  /** a row was picked: a folder (also folded or opened) or a file (also previewed) */
  onSelect: (path: string, kind: "dir" | "file") => void;
  /** the root's absolute path as the server answered it */
  onRootResolved: (listing: DirectoryListing) => void;
}

export function Tree({ root, paneId, showHidden, refresh, selected, onSelect, onRootResolved }: TreeProps) {
  const tx = useTx();
  const { fetchDirectories } = useMachineApi();
  const [nodes, setNodes] = useState<Map<string, Node>>(() => new Map());
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState(0);
  const generation = useRef(0);
  const treeRef = useRef<HTMLUListElement>(null);

  const load = useCallback(async (path: string, isRoot: boolean) => {
    const asked = generation.current;
    setNodes((current) => new Map(current).set(path, { status: "loading" }));
    try {
      const listing = await fetchDirectories(path, showHidden, true, paneId);
      if (asked !== generation.current) return;
      // kept under the path asked and the path answered (`~` → `/home/me`), which children are joined to
      setNodes((current) => new Map(current).set(path, { status: "loaded", listing }).set(listing.path, { status: "loaded", listing }));
      if (isRoot) onRootResolved(listing);
    } catch (reason: unknown) {
      if (asked !== generation.current) return;
      const message = reason instanceof ApiError && reason.code === "invalid_cwd" ? tx("This folder cannot be opened.") : tx("Folders could not be loaded.");
      setNodes((current) => new Map(current).set(path, { status: "error", message }));
    }
  }, [fetchDirectories, showHidden, paneId, onRootResolved, tx]);

  // a new root or a change of hidden starts over; Refresh lists the open folders again
  useEffect(() => {
    generation.current += 1;
    setNodes(new Map());
    setExpanded(new Set());
    setActive(0);
    void load(root, true);
  }, [root, showHidden, paneId]);
  useEffect(() => {
    if (refresh === 0) return;
    generation.current += 1;
    void load(root, true);
    for (const path of expanded) void load(path, false);
  }, [refresh]);

  const toggle = (path: string): void => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else {
        next.add(path);
        if (!nodes.has(path)) void load(path, false);
      }
      return next;
    });
  };

  const rootListing = nodes.get(root);
  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (path: string, depth: number): void => {
      const node = nodes.get(path);
      if (node === undefined || node.status === "loading") { out.push({ path: `${path}#loading`, name: "", depth, kind: "note", note: tx("Loading…") }); return; }
      if (node.status === "error") { out.push({ path: `${path}#error`, name: "", depth, kind: "note", note: node.message }); return; }
      const { listing } = node;
      const base = listing.path;
      const dirs = listing.directories.filter((name) => showHidden || !IGNORED.has(name));
      const files = listing.files ?? [];
      if (dirs.length === 0 && files.length === 0) out.push({ path: `${base}#empty`, name: "", depth, kind: "note", note: tx("Empty folder") });
      for (const name of dirs) {
        const child = childPath(base, name);
        out.push({ path: child, name, depth, kind: "dir" });
        if (expanded.has(child)) walk(child, depth + 1);
      }
      for (const file of files) out.push({ path: childPath(base, file.name), name: file.name, depth, kind: "file" });
      if (listing.truncated) out.push({ path: `${base}#more`, name: "", depth, kind: "note", note: tx("More entries are not shown (over 500).") });
    };
    walk(rootListing?.status === "loaded" ? rootListing.listing.path : root, 0);
    return out;
  }, [nodes, expanded, root, rootListing, showHidden, tx]);

  const focusable = rows.filter((row) => row.kind !== "note");
  const current = focusable[Math.min(active, Math.max(0, focusable.length - 1))];

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>): void => {
    if (current === undefined) return;
    const index = focusable.indexOf(current);
    const move = (to: number): void => {
      const next = Math.max(0, Math.min(focusable.length - 1, to));
      setActive(next);
      treeRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    };
    switch (event.key) {
      case "ArrowDown": move(index + 1); break;
      case "ArrowUp": move(index - 1); break;
      case "Home": move(0); break;
      case "End": move(focusable.length - 1); break;
      case "ArrowRight": if (current.kind === "dir" && !expanded.has(current.path)) toggle(current.path); else move(index + 1); break;
      case "ArrowLeft":
        if (current.kind === "dir" && expanded.has(current.path)) toggle(current.path);
        else {
          // to the folder this row sits in
          const parent = focusable.slice(0, index).reverse().find((row) => row.kind === "dir" && row.depth === current.depth - 1);
          if (parent) move(focusable.indexOf(parent));
        }
        break;
      case "Enter": case " ":
        if (current.kind === "dir") toggle(current.path);
        onSelect(current.path, current.kind as "dir" | "file");
        break;
      default: return;
    }
    event.preventDefault();
  };

  let focusIndex = -1;
  return (
    <ul ref={treeRef} className="pf-tree" role="tree" aria-label={tx("Files")} tabIndex={0} onKeyDown={onKeyDown}
      aria-activedescendant={current ? `pf-row-${focusable.indexOf(current)}` : undefined}>
      {rows.map((row) => {
        if (row.kind === "note") return <li key={row.path} className="pf-tree-note" role="none" style={{ paddingInlineStart: `calc(${row.depth} * var(--pf-indent) + var(--space-3))` }}>{row.note}</li>;
        focusIndex += 1;
        const index = focusIndex;
        const open = row.kind === "dir" && expanded.has(row.path);
        return (
          <li key={row.path} id={`pf-row-${index}`} data-index={index} role="treeitem" aria-level={row.depth + 1}
            aria-expanded={row.kind === "dir" ? open : undefined} aria-selected={row.path === selected}
            className={`pf-tree-row${index === focusable.indexOf(current!) ? " is-active" : ""}${row.path === selected ? " is-selected" : ""}`}
            style={{ paddingInlineStart: `calc(${row.depth} * var(--pf-indent) + var(--space-2))` }} title={row.name}
            onClick={() => { setActive(index); if (row.kind === "dir") toggle(row.path); onSelect(row.path, row.kind as "dir" | "file"); }}>
            <span className="pf-tree-caret" aria-hidden="true">{row.kind === "dir" ? (open ? <ChevronDown /> : <ChevronRight />) : null}</span>
            <FileGlyph name={row.name} kind={row.kind === "dir" ? "directory" : "file"} className="pf-tree-glyph" />
            <span className="pf-tree-name">{row.name}</span>
          </li>
        );
      })}
    </ul>
  );
}
