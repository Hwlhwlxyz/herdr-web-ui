/**
 * Every piece of upstream code an extension uses, in one place. When upstream renames or moves
 * one of these, fix it here and nowhere else. Extensions import from this file (and from
 * src/slots/), never from ../components or ../lib directly.
 */
export { MachineContext, useMachineApi, useMachineId } from "../lib/machineContext.tsx";
export { ApiError } from "../lib/api.ts";
export { machinePath } from "../../shared/machines.ts";
export { copyText } from "../lib/clipboard.ts";
export { formatBytes } from "../lib/bridgeProgress.ts";
export { languageForPath, LINE_ELEMENT_LIMIT } from "../lib/highlight.ts";
export { readFilePreviewText } from "../lib/filePreviewText.ts";
export { useSettings } from "../lib/settings.ts";
export { currentLanguage } from "../lib/i18n.ts";
export { useMediaQuery } from "../lib/useMediaQuery.ts";
export { CodeLines, useHighlightedLines } from "../components/HighlightedCode.tsx";
export { FileGlyph } from "../components/FileGlyph.tsx";

export type { RowMenuItem } from "../components/RowMenu.tsx";
export type { DirectoryListing, FileInfo, HerdrPane } from "../../shared/protocol.ts";
