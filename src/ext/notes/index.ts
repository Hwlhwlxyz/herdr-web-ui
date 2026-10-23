// Scratch notes: a drawer of plain-text notes kept in this browser (localStorage) to draft and tidy
// a message before copying it to an agent. Entry: header ⋯ → Scratch notes. Design: custom-docs/extensions.md.
import { NotebookPen } from "lucide-react";

import { registerMenuItems, registerSlot } from "../../slots/registry.tsx";
import { txNow } from "./i18n.ts";
import { ScratchNotes } from "./ScratchNotes.tsx";
import { setOpen } from "./store.ts";

registerMenuItems("header.more", "notes", () => [
  { id: "ext-notes", label: txNow("Scratch notes"), icon: NotebookPen, run: () => setOpen(true) },
]);

registerSlot("app.overlay", "notes", ScratchNotes);
