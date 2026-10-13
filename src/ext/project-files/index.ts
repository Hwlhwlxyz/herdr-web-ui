// Project files: a tree of the selected pane's folder and a read-only preview whose picked lines
// copy as `path:10-25` + code. Entry: header ⋯ → Project files. Design: custom-docs/extensions.md.
import { FolderTree } from "lucide-react";

import { registerMenuItems, registerSlot } from "../../slots/registry.tsx";
import { txNow } from "./i18n.ts";
import { ProjectFiles } from "./ProjectFiles.tsx";
import { setOpen } from "./store.ts";

registerMenuItems("header.more", "project-files", (ctx) => ctx.pane === null ? [] : [
  { id: "ext-project-files", label: txNow("Project files"), icon: FolderTree, run: () => setOpen(true) },
]);

registerSlot("app.overlay", "project-files", ProjectFiles);
