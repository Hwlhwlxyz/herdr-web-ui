/**
 * What App hands to every slot. Kept small and plain on purpose: an extension reads the app
 * through this object (and src/ext/upstream.ts), never through App's own state.
 */
import type { HerdrPane } from "../../shared/protocol.ts";

export interface AppSlotContext {
  /** the PC the selected pane lives on ("local" for this one) */
  machineId: string;
  /** the selected pane, or null when none is selected */
  pane: HerdrPane | null;
  /** opens the app's own file viewer (images, PDF, Markdown…) on the selected pane's PC */
  openFile: (path: string) => void;
}

/** Menus an extension can add rows to. */
export type MenuSlotName = "header.more";

/** Places an extension can draw into. */
export type ViewSlotName = "app.overlay";
